#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { createAnkiConnectClient } from './anki-connect.mjs';
import { createReviewApprovalStore } from './review-approval.mjs';

const cardSchema = z.object({
  modelName: z.enum(['Basic', 'Basic (type in the answer)']).default('Basic'),
  front: z.string().min(1).max(20_000),
  back: z.string().min(1).max(20_000),
});

const cardsInputSchema = {
  deckName: z.string().trim().min(1).max(200),
  cards: z.array(cardSchema).min(1).max(20),
};

function toolResult(structuredContent, summary, isError = false) {
  return {
    content: [{ type: 'text', text: summary }],
    structuredContent,
    ...(isError ? { isError: true } : {}),
  };
}

function failure(error) {
  const message = error instanceof Error ? error.message : String(error);
  return toolResult({ ok: false, error: message }, message, true);
}

export function createServer({
  ankiClient = createAnkiConnectClient(),
  approvalStore = createReviewApprovalStore(),
} = {}) {
  const server = new McpServer(
    { name: 'anki-card-forge', version: '1.0.0' },
    {
      instructions:
        'Generate and review cards in the conversation or Card Forge UI. After the user approves the exact deck, model, front, and back fields, call validate_reviewed_cards, then pass its one-time token with the unchanged payload to add_reviewed_cards. This server never syncs AnkiWeb.',
    },
  );

  server.registerTool(
    'check_anki_connection',
    {
      title: 'Check Anki connection',
      description: 'Check the local AnkiConnect API version without changing Anki.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const version = await ankiClient.checkConnection();
        return toolResult({ ok: true, version }, `AnkiConnect is available (API version ${version}).`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'get_anki_decks',
    {
      title: 'List Anki decks',
      description: 'List local Anki deck names without changing Anki.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const decks = await ankiClient.getDeckNames();
        return toolResult({ ok: true, decks }, `Available Anki decks: ${decks.join(', ')}`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'validate_reviewed_cards',
    {
      title: 'Validate reviewed cards',
      description:
        'Dry-run the exact reviewed cards against AnkiConnect. This checks deck, models, fields, and duplicates without adding notes.',
      inputSchema: cardsInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ deckName, cards }) => {
      try {
        const canAdd = await ankiClient.canAddNotes(cards, deckName);
        const structured = {
          ok: canAdd.every(Boolean),
          deckName,
          cardCount: cards.length,
          canAdd,
        };
        if (structured.ok) {
          const approval = approvalStore.issue(deckName, cards);
          Object.assign(structured, {
            approvalToken: approval.token,
            approvalExpiresAt: new Date(approval.expiresAt).toISOString(),
          });
        }
        const summary = structured.ok
          ? `All ${cards.length} reviewed card(s) can be added to ${deckName}. The one-time approval token expires in 15 minutes.`
          : `Validation failed for card indexes ${canAdd.flatMap((allowed, index) => (allowed ? [] : [index])).join(', ')}.`;
        return toolResult(structured, summary, !structured.ok);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'add_reviewed_cards',
    {
      title: 'Add reviewed cards to Anki',
      description:
        'Add the exact cards the user has already reviewed and approved. Never call this for drafts or inferred content. This is a non-idempotent local write and does not run AnkiWeb sync.',
      inputSchema: {
        ...cardsInputSchema,
        approvalToken: z.string().uuid().describe('One-time token returned by validate_reviewed_cards.'),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ deckName, cards, approvalToken }) => {
      try {
        approvalStore.consume(approvalToken, deckName, cards);
        const noteIds = await ankiClient.addReviewedNotes(cards, deckName);
        return toolResult(
          { ok: true, deckName, cardCount: cards.length, noteIds },
          `Added ${noteIds.length} reviewed card(s) to ${deckName}. Note IDs: ${noteIds.join(', ')}.`,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  return server;
}

export async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
