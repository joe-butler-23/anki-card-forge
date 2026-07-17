#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { createAnkiConnectClient } from './anki-connect.mjs';
import { createReviewApprovalStore } from './review-approval.mjs';
import { createElectronInboxClient } from './electron-inbox-client.mjs';

export const CARD_REVIEW_WIDGET_URI = 'ui://anki-card-forge/card-review-v2.html';

const cardReviewWidgetHtml = readFileSync(
  new URL('./card-review-widget.html', import.meta.url),
  'utf8',
);

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
  electronInboxClient = createElectronInboxClient(),
} = {}) {
  const server = new McpServer(
    { name: 'anki-card-forge', version: '1.1.0' },
    {
      instructions:
        'After the learner understands a topic, create the smallest useful card set. Use send_cards_to_electron when the learner wants the persistent desktop Card Forge; use review_cards for the embedded review panel. Both paths require learner review before any Anki write. This server never syncs AnkiWeb.',
    },
  );

  server.registerResource(
    'anki-card-forge-review',
    CARD_REVIEW_WIDGET_URI,
    {
      title: 'Anki Card Forge review',
      description: 'Review, edit, reject, and add approved cards to the prob Anki deck.',
      mimeType: 'text/html;profile=mcp-app',
    },
    async () => ({
      contents: [
        {
          uri: CARD_REVIEW_WIDGET_URI,
          mimeType: 'text/html;profile=mcp-app',
          text: cardReviewWidgetHtml,
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [],
              },
            },
            'openai/widgetDescription':
              'Card Forge review. The learner can edit or reject each proposed card, then add the exact approved cards directly to Anki.',
            'openai/widgetPrefersBorder': true,
          },
        },
      ],
    }),
  );

  server.registerTool(
    'check_electron_inbox',
    {
      title: 'Check desktop Card Forge',
      description: 'Check whether the local Card Forge Electron inbox is running and ready for card packets.',
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const status = await electronInboxClient.ping();
        return toolResult(status, `Desktop Card Forge is online with ${status.queuedPackets} queued packet(s).`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'send_cards_to_electron',
    {
      title: 'Send cards to desktop Card Forge',
      description:
        'Queue candidate cards in the already-running desktop Card Forge for learner review. This does not add anything to Anki.',
      inputSchema: {
        cards: cardsInputSchema.cards,
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async ({ cards }) => {
      try {
        const status = await electronInboxClient.submit(cards, 'prob');
        return toolResult(
          status,
          `Queued ${cards.length} candidate card(s) in desktop Card Forge as packet ${status.packetId}. Nothing has been added to Anki.`,
        );
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'get_electron_packet_status',
    {
      title: 'Get desktop card packet status',
      description: 'Get the review or send receipt for a packet previously sent to desktop Card Forge.',
      inputSchema: {
        packetId: z.string().trim().min(1).max(100),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ packetId }) => {
      try {
        const status = await electronInboxClient.status(packetId);
        const noteSummary = status.noteIds?.length ? ` Note IDs: ${status.noteIds.join(', ')}.` : '';
        return toolResult(status, `Packet ${packetId} is ${status.status}.${noteSummary}`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  server.registerTool(
    'review_cards',
    {
      title: 'Review Anki cards',
      description:
        'Use this when the learner understands a topic and should review a proposed minimal card set before anything is added to Anki.',
      inputSchema: {
        cards: cardsInputSchema.cards,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: CARD_REVIEW_WIDGET_URI },
        'openai/outputTemplate': CARD_REVIEW_WIDGET_URI,
        'openai/widgetAccessible': true,
        'openai/toolInvocation/invoking': 'Opening Card Forge review…',
        'openai/toolInvocation/invoked': 'Card Forge review ready',
      },
    },
    async ({ cards }) =>
      toolResult(
        { ok: true, deckName: 'prob', cards },
        `Prepared ${cards.length} candidate card(s) for learner review. Nothing has been added to Anki yet.`,
      ),
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
