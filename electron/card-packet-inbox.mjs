import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {
  CARD_PACKET_PROTOCOL_VERSION,
  getCardPacketSocketPath,
  publicPacketStatus,
  validateCardPacket,
} from './card-packet-protocol.mjs';

const MAX_REQUEST_BYTES = 1_000_000;

function isoTime(now) {
  return new Date(now()).toISOString();
}

async function socketIsLive(socketPath) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ path: socketPath });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(250, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export function createCardPacketInbox({
  socketPath = getCardPacketSocketPath(),
  now = () => Date.now(),
  deliver = () => {},
} = {}) {
  const records = new Map();
  const queue = [];
  let server = null;
  let rendererReady = false;
  let currentPacketId = null;
  let ownsSocket = false;

  function dispatchNext() {
    if (!rendererReady || currentPacketId || queue.length === 0) return;
    const packetId = queue.shift();
    const record = records.get(packetId);
    if (!record || record.status !== 'queued') return;
    currentPacketId = packetId;
    rendererReady = false;
    record.status = 'reviewing';
    record.deliveredAt = isoTime(now);
    deliver(record.packet);
  }

  function submit(rawPacket) {
    const packet = validateCardPacket(rawPacket);
    if (records.has(packet.id)) {
      throw new Error(`Packet ${packet.id} already exists.`);
    }
    const record = {
      packet,
      status: 'queued',
      queuedAt: isoTime(now),
    };
    records.set(packet.id, record);
    queue.push(packet.id);
    dispatchNext();
    return publicPacketStatus(record);
  }

  function getStatus(packetId) {
    const record = records.get(packetId);
    if (!record) throw new Error(`Unknown packet ${packetId}.`);
    return publicPacketStatus(record);
  }

  function setRendererReady(ready) {
    rendererReady = Boolean(ready);
    dispatchNext();
    return { ready: rendererReady, queuedPackets: queue.length };
  }

  function markVisible(packetId) {
    if (packetId !== currentPacketId) throw new Error(`Packet ${packetId} is not the active packet.`);
    const record = records.get(packetId);
    if (!record) throw new Error(`Unknown packet ${packetId}.`);
    const visibleMs = now();
    record.visibleAt = new Date(visibleMs).toISOString();
    record.deliveryLatencyMs = Math.max(0, visibleMs - Date.parse(record.packet.createdAt));
    record.status = 'reviewing';
    record.completedAt = undefined;
    record.error = undefined;
    return publicPacketStatus(record);
  }

  function updateActive(packetId, update) {
    if (packetId !== currentPacketId) throw new Error(`Packet ${packetId} is not the active packet.`);
    const record = records.get(packetId);
    if (!record) throw new Error(`Unknown packet ${packetId}.`);
    const status = update.status;
    if (!['failed', 'sent', 'cancelled'].includes(status)) {
      throw new Error(`Unsupported packet status ${status}.`);
    }
    record.status = status;
    record.completedAt = isoTime(now);
    if (status === 'sent') {
      if (!Array.isArray(update.noteIds) || update.noteIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        throw new Error('Sent packet receipts require positive integer noteIds.');
      }
      record.noteIds = [...update.noteIds];
      record.error = undefined;
      currentPacketId = null;
    } else if (status === 'cancelled') {
      currentPacketId = null;
    } else {
      record.error = typeof update.error === 'string' && update.error.trim()
        ? update.error
        : 'The Anki send failed.';
    }
    dispatchNext();
    return publicPacketStatus(record);
  }

  function handleMessage(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new Error('Request must be an object.');
    }
    if (message.type === 'ping') {
      return {
        protocolVersion: CARD_PACKET_PROTOCOL_VERSION,
        status: 'ready',
        rendererReady,
        activePacketId: currentPacketId,
        queuedPackets: queue.length,
      };
    }
    if (message.type === 'submit') return submit(message.packet);
    if (message.type === 'status') return getStatus(message.packetId);
    throw new Error(`Unsupported request type ${String(message.type)}.`);
  }

  function handleConnection(socket) {
    socket.setEncoding('utf8');
    let request = '';
    let answered = false;
    const respond = (payload) => {
      if (answered) return;
      answered = true;
      socket.end(`${JSON.stringify(payload)}\n`);
    };
    socket.setTimeout(1_500, () => respond({ ok: false, error: 'Request timed out.' }));
    socket.on('data', (chunk) => {
      request += chunk;
      if (request.length > MAX_REQUEST_BYTES) {
        respond({ ok: false, error: 'Request is too large.' });
        return;
      }
      const newlineIndex = request.indexOf('\n');
      if (newlineIndex < 0) return;
      try {
        respond({ ok: true, ...handleMessage(JSON.parse(request.slice(0, newlineIndex))) });
      } catch (error) {
        respond({ ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    });
    socket.on('error', () => {});
  }

  async function start() {
    if (server) return;
    const socketDir = path.dirname(socketPath);
    await fsPromises.mkdir(socketDir, { recursive: true, mode: 0o700 });
    await fsPromises.chmod(socketDir, 0o700);
    try {
      const stat = await fsPromises.lstat(socketPath);
      if (!stat.isSocket()) throw new Error(`Refusing to replace non-socket path ${socketPath}.`);
      if (await socketIsLive(socketPath)) throw new Error('Another Card Forge Electron inbox is already running.');
      await fsPromises.unlink(socketPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    server = net.createServer(handleConnection);
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(socketPath, () => {
        server.off('error', reject);
        resolve();
      });
    });
    ownsSocket = true;
    await fsPromises.chmod(socketPath, 0o600);
  }

  async function stop() {
    const activeServer = server;
    server = null;
    if (activeServer) {
      await new Promise((resolve) => activeServer.close(resolve));
    }
    if (ownsSocket) {
      ownsSocket = false;
      await fsPromises.unlink(socketPath).catch((error) => {
        if (error?.code !== 'ENOENT') throw error;
      });
    }
  }

  function stopSync() {
    server?.close();
    server = null;
    if (ownsSocket) {
      ownsSocket = false;
      try {
        fs.unlinkSync(socketPath);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
  }

  return {
    get socketPath() { return socketPath; },
    start,
    stop,
    stopSync,
    submit,
    getStatus,
    setRendererReady,
    markVisible,
    updateActive,
  };
}
