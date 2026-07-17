import assert from 'node:assert/strict';
import test from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { CARD_REVIEW_WIDGET_URI, createServer } from '../mcp/server.mjs';
import { createReviewApprovalStore } from '../mcp/review-approval.mjs';

async function connectTestClient(options = {}) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(options);
  const client = new Client({ name: 'anki-card-forge-test', version: '1.0.0' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

test('registers the Card Forge review widget and render tool', async (t) => {
  const { client, server } = await connectTestClient();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const listed = await client.listTools();
  const reviewTool = listed.tools.find((tool) => tool.name === 'review_cards');
  assert.equal(CARD_REVIEW_WIDGET_URI, 'ui://anki-card-forge/card-review-v2.html');
  assert.equal(reviewTool?._meta?.ui?.resourceUri, CARD_REVIEW_WIDGET_URI);
  assert.equal(reviewTool?._meta?.['openai/outputTemplate'], CARD_REVIEW_WIDGET_URI);

  const resource = await client.readResource({ uri: CARD_REVIEW_WIDGET_URI });
  const widget = resource.contents[0];
  assert.equal(widget.mimeType, 'text/html;profile=mcp-app');
  assert.equal(widget._meta?.ui?.prefersBorder, true);
  assert.match(widget.text, /rpcRequest\("tools\/call"/);
  assert.match(widget.text, /callTool\("validate_reviewed_cards"/);
  assert.match(widget.text, /callTool\("add_reviewed_cards"/);
  assert.doesNotMatch(widget.text, /sendFollowUpMessage/);

  assert.match(widget.text, /const allowedCardTags = new Set/);
  for (const tag of ['B', 'I', 'EM', 'STRONG', 'CODE', 'PRE', 'SUP', 'SUB', 'BR', 'HR', 'P', 'DIV', 'SPAN', 'UL', 'OL', 'LI']) {
    assert.match(widget.text, new RegExp(`"${tag}"`));
  }
  assert.match(widget.text, /const blockedCardTags = new Set/);
  for (const tag of ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEMPLATE']) {
    assert.match(widget.text, new RegExp(`"${tag}"`));
  }
  assert.match(widget.text, /sourceTemplate\.innerHTML = source/);

  const sanitizer = widget.text.match(/function appendSanitizedNode[\s\S]*?(?=\n\s+function renderCard)/)?.[0];
  assert.ok(sanitizer);
  assert.doesNotMatch(sanitizer, /\.attributes|setAttribute|innerHTML/);
});

test('queues cards in desktop Card Forge and returns packet receipts', async (t) => {
  const calls = [];
  const electronInboxClient = {
    async ping() {
      calls.push(['ping']);
      return { ok: true, status: 'ready', queuedPackets: 0, rendererReady: true };
    },
    async submit(cards, deckName) {
      calls.push(['submit', cards, deckName]);
      return {
        ok: true,
        packetId: 'packet-123',
        deckName,
        cardCount: cards.length,
        status: 'reviewing',
      };
    },
    async status(packetId) {
      calls.push(['status', packetId]);
      return {
        ok: true,
        packetId,
        deckName: 'prob',
        cardCount: 1,
        status: 'sent',
        noteIds: [987654321],
      };
    },
  };
  const { client, server } = await connectTestClient({ electronInboxClient });
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const cards = [{ modelName: 'Basic', front: 'Fast?', back: 'Yes.' }];
  const listed = await client.listTools();
  for (const name of ['check_electron_inbox', 'send_cards_to_electron', 'get_electron_packet_status']) {
    assert.ok(listed.tools.some((tool) => tool.name === name));
  }

  const readiness = await client.callTool({ name: 'check_electron_inbox', arguments: {} });
  assert.equal(readiness.structuredContent?.status, 'ready');

  const queued = await client.callTool({ name: 'send_cards_to_electron', arguments: { cards } });
  assert.equal(queued.structuredContent?.packetId, 'packet-123');
  assert.match(queued.content[0].text, /Nothing has been added to Anki/);

  const receipt = await client.callTool({
    name: 'get_electron_packet_status',
    arguments: { packetId: 'packet-123' },
  });
  assert.deepEqual(receipt.structuredContent?.noteIds, [987654321]);
  assert.deepEqual(calls, [
    ['ping'],
    ['submit', cards, 'prob'],
    ['status', 'packet-123'],
  ]);
});

test('renders cards for prob and accepts the unchanged reviewed payload once', async (t) => {
  const writes = [];
  const ankiClient = {
    async canAddNotes(cards, deckName) {
      assert.equal(deckName, 'prob');
      return cards.map(() => true);
    },
    async addReviewedNotes(cards, deckName) {
      writes.push({ cards, deckName });
      return [111, 222].slice(0, cards.length);
    },
  };
  const approvalStore = createReviewApprovalStore({
    createToken: () => '00000000-0000-4000-8000-000000000001',
  });
  const { client, server } = await connectTestClient({ ankiClient, approvalStore });
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const cards = [
    { modelName: 'Basic', front: 'What is an event?', back: 'A set of outcomes.' },
    { modelName: 'Basic', front: 'What is an outcome?', back: 'One possible result.' },
  ];
  const rendered = await client.callTool({ name: 'review_cards', arguments: { cards } });
  assert.deepEqual(rendered.structuredContent, { ok: true, deckName: 'prob', cards });

  const reviewedPayload = { deckName: 'prob', cards };
  const validated = await client.callTool({
    name: 'validate_reviewed_cards',
    arguments: reviewedPayload,
  });
  assert.equal(validated.structuredContent?.ok, true);

  const added = await client.callTool({
    name: 'add_reviewed_cards',
    arguments: {
      ...reviewedPayload,
      approvalToken: validated.structuredContent.approvalToken,
    },
  });
  assert.deepEqual(added.structuredContent?.noteIds, [111, 222]);
  assert.deepEqual(writes, [{ cards, deckName: 'prob' }]);

  const repeated = await client.callTool({
    name: 'add_reviewed_cards',
    arguments: {
      ...reviewedPayload,
      approvalToken: validated.structuredContent.approvalToken,
    },
  });
  assert.equal(repeated.isError, true);
  assert.equal(writes.length, 1);
});
