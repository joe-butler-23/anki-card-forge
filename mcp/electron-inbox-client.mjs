import net from 'node:net';
import { createCardPacket, getCardPacketSocketPath } from '../electron/card-packet-protocol.mjs';

const MAX_RESPONSE_BYTES = 1_000_000;

function connectionError(error) {
  if (error && ['ENOENT', 'ECONNREFUSED'].includes(error.code)) {
    return new Error('The Card Forge Electron inbox is offline. Open Anki Card Forge and try again.');
  }
  return error instanceof Error ? error : new Error(String(error));
}

export function requestElectronInbox(message, {
  socketPath = getCardPacketSocketPath(),
  timeoutMs = 1_500,
} = {}) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ path: socketPath });
    let settled = false;
    let response = '';

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      callback(value);
    };

    socket.setEncoding('utf8');
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => socket.write(`${JSON.stringify(message)}\n`));
    socket.on('data', (chunk) => {
      response += chunk;
      if (response.length > MAX_RESPONSE_BYTES) {
        finish(reject, new Error('Card Forge Electron inbox returned an oversized response.'));
        return;
      }
      const newlineIndex = response.indexOf('\n');
      if (newlineIndex < 0) return;
      try {
        const parsed = JSON.parse(response.slice(0, newlineIndex));
        if (!parsed.ok) {
          finish(reject, new Error(parsed.error || 'Card Forge Electron inbox rejected the request.'));
          return;
        }
        finish(resolve, parsed);
      } catch (error) {
        finish(reject, error instanceof Error ? error : new Error(String(error)));
      }
    });
    socket.on('timeout', () => finish(reject, new Error('Card Forge Electron inbox timed out.')));
    socket.on('error', (error) => finish(reject, connectionError(error)));
    socket.on('end', () => {
      if (!settled) finish(reject, new Error('Card Forge Electron inbox closed without a response.'));
    });
  });
}

export function createElectronInboxClient(options = {}) {
  return {
    async ping() {
      return requestElectronInbox({ type: 'ping' }, options);
    },
    async submit(cards, deckName = 'prob') {
      const packet = createCardPacket(cards, { deckName });
      return requestElectronInbox({ type: 'submit', packet }, options);
    },
    async status(packetId) {
      return requestElectronInbox({ type: 'status', packetId }, options);
    },
  };
}
