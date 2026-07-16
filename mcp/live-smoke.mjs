#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverPath = fileURLToPath(new URL('./server.mjs', import.meta.url));
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [serverPath],
  stderr: 'pipe',
});
const client = new Client({ name: 'anki-card-forge-live-smoke', version: '1.0.0' });

try {
  await client.connect(transport);
  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name).sort();
  const expected = [
    'add_reviewed_cards',
    'check_anki_connection',
    'get_anki_decks',
    'validate_reviewed_cards',
  ];

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected tool list: ${names.join(', ')}`);
  }

  const connection = await client.callTool({ name: 'check_anki_connection', arguments: {} });
  if (connection.isError || connection.structuredContent?.version !== 6) {
    throw new Error('Anki connection check failed.');
  }

  const decksResult = await client.callTool({ name: 'get_anki_decks', arguments: {} });
  const decks = decksResult.structuredContent?.decks;
  if (decksResult.isError || !Array.isArray(decks) || decks.length === 0) {
    throw new Error('Anki deck lookup failed.');
  }

  const validation = await client.callTool({
    name: 'validate_reviewed_cards',
    arguments: {
      deckName: decks[0],
      cards: [
        {
          modelName: 'Basic',
          front: `Card Forge read-only smoke ${Date.now()}`,
          back: 'This payload is checked with canAddNotes and is never written.',
        },
      ],
    },
  });

  if (validation.isError || validation.structuredContent?.ok !== true) {
    throw new Error('Anki read-only card validation failed.');
  }

  if (typeof validation.structuredContent?.approvalToken !== 'string') {
    throw new Error('Reviewed-card validation did not return a one-time approval token.');
  }

  process.stdout.write(
    `${JSON.stringify({ tools: names, ankiVersion: 6, decks, dryRunOnly: true }, null, 2)}\n`,
  );
} finally {
  await client.close();
}
