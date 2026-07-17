import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createCardPacketInbox } from '../electron/card-packet-inbox.mjs';
import { createCardPacket, getCardPacketSocketPath } from '../electron/card-packet-protocol.mjs';
import { createElectronInboxClient } from '../mcp/electron-inbox-client.mjs';

const sampleCards = [
  { modelName: 'Basic', front: '<b>bold</b><br>line two', back: 'Test back.' },
  { modelName: 'Basic (type in the answer)', front: 'Typed front', back: 'Typed back' },
];

test('uses the per-user Linux runtime directory when XDG_RUNTIME_DIR is missing', () => {
  const expected = '/run/user/1000/anki-card-forge/card-packets.sock';
  assert.equal(
    getCardPacketSocketPath({
      env: { XDG_RUNTIME_DIR: '/run/user/1000' },
      platform: 'linux',
      tmpdir: () => '/tmp',
      uid: 1000,
    }),
    expected,
  );
  assert.equal(
    getCardPacketSocketPath({
      env: {},
      platform: 'linux',
      tmpdir: () => '/tmp',
      uid: 1000,
    }),
    expected,
  );
  assert.equal(
    getCardPacketSocketPath({
      env: {},
      platform: 'darwin',
      tmpdir: () => '/tmp',
      uid: 1000,
    }),
    '/tmp/anki-card-forge-1000/anki-card-forge/card-packets.sock',
  );
});

test('validates a packet without changing its card content', () => {
  const packet = createCardPacket(sampleCards, {
    id: 'packet-exact-content',
    deckName: 'prob',
    now: () => 1_700_000_000_000,
  });
  assert.deepEqual(packet.cards, sampleCards);
  assert.equal(packet.createdAt, '2023-11-14T22:13:20.000Z');
  assert.throws(
    () => createCardPacket([{ modelName: 'Cloze', front: 'x', back: 'y' }]),
    /unsupported/,
  );
});

test('delivers packets over a private Unix socket and queues them FIFO', async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acf-inbox-test-'));
  const socketPath = path.join(tmpDir, 'runtime', 'inbox.sock');
  const delivered = [];
  const inbox = createCardPacketInbox({
    socketPath,
    deliver: (packet) => delivered.push(packet.id),
  });
  const client = createElectronInboxClient({ socketPath, timeoutMs: 1_000 });

  t.after(async () => {
    await inbox.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  await inbox.start();
  assert.equal((await fs.stat(socketPath)).mode & 0o777, 0o600);
  assert.equal((await client.ping()).status, 'ready');

  const first = await client.submit(sampleCards, 'prob');
  const second = await client.submit([sampleCards[0]], 'prob');
  assert.equal(first.status, 'queued');
  assert.equal(second.status, 'queued');
  assert.deepEqual(delivered, []);

  inbox.setRendererReady(true);
  assert.deepEqual(delivered, [first.packetId]);
  assert.equal((await client.status(first.packetId)).status, 'reviewing');
  assert.equal((await client.status(second.packetId)).status, 'queued');

  const visible = inbox.markVisible(first.packetId);
  assert.equal(visible.status, 'reviewing');
  assert.ok(Number.isFinite(visible.deliveryLatencyMs));

  inbox.updateActive(first.packetId, { status: 'sent', noteIds: [111, 222] });
  assert.deepEqual((await client.status(first.packetId)).noteIds, [111, 222]);
  assert.deepEqual(delivered, [first.packetId]);

  inbox.setRendererReady(true);
  assert.deepEqual(delivered, [first.packetId, second.packetId]);
  inbox.updateActive(second.packetId, { status: 'cancelled' });
  assert.equal((await client.status(second.packetId)).status, 'cancelled');
});
