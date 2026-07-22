import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const CARD_PACKET_MODELS = Object.freeze([
  'Basic',
  'Basic (type in the answer)',
]);

export const CARD_PACKET_MAX_CARDS = 20;
export const CARD_PACKET_MAX_FIELD_LENGTH = 20_000;
export const CARD_PACKET_MAX_TAGS = 50;
export const CARD_PACKET_MAX_TAG_LENGTH = 100;
export const CARD_PACKET_PROTOCOL_VERSION = 1;

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function validateString(value, label, maxLength) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  if (value.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters.`);
  }
  return value;
}

function validateTags(value, label) {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > CARD_PACKET_MAX_TAGS) {
    throw new Error(`${label} must be an array of at most ${CARD_PACKET_MAX_TAGS} tags.`);
  }
  return value.map((tag, tagIndex) => {
    const validated = validateString(tag, `${label}[${tagIndex}]`, CARD_PACKET_MAX_TAG_LENGTH).trim();
    if (/\s/.test(validated)) {
      throw new Error(`${label}[${tagIndex}] cannot contain whitespace.`);
    }
    return validated;
  });
}

export function validateCardPacketCard(card, index = 0) {
  assertPlainObject(card, `cards[${index}]`);
  const modelName = card.modelName ?? 'Basic';
  if (!CARD_PACKET_MODELS.includes(modelName)) {
    throw new Error(`cards[${index}].modelName is unsupported.`);
  }
  return {
    modelName,
    front: validateString(card.front, `cards[${index}].front`, CARD_PACKET_MAX_FIELD_LENGTH),
    back: validateString(card.back, `cards[${index}].back`, CARD_PACKET_MAX_FIELD_LENGTH),
    tags: validateTags(card.tags, `cards[${index}].tags`),
  };
}

export function validateCardPacket(packet) {
  assertPlainObject(packet, 'packet');
  if (packet.protocolVersion !== undefined && packet.protocolVersion !== CARD_PACKET_PROTOCOL_VERSION) {
    throw new Error(`Unsupported packet protocol version ${String(packet.protocolVersion)}.`);
  }
  const id = validateString(packet.id, 'packet.id', 100);
  const deckName = validateString(packet.deckName, 'packet.deckName', 200);
  if (!Array.isArray(packet.cards) || packet.cards.length < 1 || packet.cards.length > CARD_PACKET_MAX_CARDS) {
    throw new Error(`packet.cards must contain between 1 and ${CARD_PACKET_MAX_CARDS} cards.`);
  }
  const createdAt = validateString(packet.createdAt, 'packet.createdAt', 100);
  if (!Number.isFinite(Date.parse(createdAt))) {
    throw new Error('packet.createdAt must be an ISO date string.');
  }
  return {
    protocolVersion: CARD_PACKET_PROTOCOL_VERSION,
    id,
    deckName,
    cards: packet.cards.map(validateCardPacketCard),
    createdAt,
  };
}

export function createCardPacket(cards, {
  deckName = 'prob',
  id = randomUUID(),
  now = () => Date.now(),
} = {}) {
  return validateCardPacket({
    id,
    deckName,
    cards,
    createdAt: new Date(now()).toISOString(),
  });
}

export function getCardPacketSocketPath({
  env = process.env,
  platform = process.platform,
  tmpdir = os.tmpdir,
  uid = typeof process.getuid === 'function' ? process.getuid() : 'user',
} = {}) {
  const configuredRuntimeDir = typeof env.XDG_RUNTIME_DIR === 'string' && path.isAbsolute(env.XDG_RUNTIME_DIR)
    ? env.XDG_RUNTIME_DIR
    : null;
  const runtimeDir = configuredRuntimeDir
    ?? (platform === 'linux' && uid !== 'user'
      ? path.join('/run/user', String(uid))
      : path.join(tmpdir(), `anki-card-forge-${uid}`));
  return path.join(runtimeDir, 'anki-card-forge', 'card-packets.sock');
}

export function publicPacketStatus(record) {
  return {
    packetId: record.packet.id,
    deckName: record.packet.deckName,
    cardCount: record.packet.cards.length,
    status: record.status,
    createdAt: record.packet.createdAt,
    queuedAt: record.queuedAt,
    ...(record.deliveredAt ? { deliveredAt: record.deliveredAt } : {}),
    ...(record.visibleAt ? { visibleAt: record.visibleAt } : {}),
    ...(Number.isFinite(record.deliveryLatencyMs) ? { deliveryLatencyMs: record.deliveryLatencyMs } : {}),
    ...(record.completedAt ? { completedAt: record.completedAt } : {}),
    ...(record.noteIds ? { noteIds: [...record.noteIds] } : {}),
    ...(record.error ? { error: record.error } : {}),
  };
}
