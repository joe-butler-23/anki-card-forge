const DEFAULT_ANKI_CONNECT_URL = 'http://127.0.0.1:8765';
const SUPPORTED_MODELS = new Set(['Basic', 'Basic (type in the answer)']);

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function normalizeAnkiConnectUrl(value = DEFAULT_ANKI_CONNECT_URL) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error('ANKI_CONNECT_URL must be a valid URL.');
  }

  if (url.protocol !== 'http:') {
    throw new Error('AnkiConnect must use HTTP on localhost.');
  }

  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('AnkiConnect must be hosted on localhost.');
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('AnkiConnect URL must not include credentials, a query, or a fragment.');
  }

  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('AnkiConnect URL must not include a path.');
  }

  return url.toString().replace(/\/$/, '');
}

export function escapeCardText(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(/\r\n?|\n/g, '<br>');
}

export function validateCard(card, index = 0) {
  if (!SUPPORTED_MODELS.has(card.modelName)) {
    throw new Error(`Card ${index + 1} uses unsupported model "${card.modelName}".`);
  }

  for (const field of ['front', 'back']) {
    const value = card[field];

    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Card ${index + 1} has an empty ${field}.`);
    }

    if (value.length > 20_000) {
      throw new Error(`Card ${index + 1} ${field} exceeds 20,000 characters.`);
    }
  }
}

function reviewedCardIdentity(card) {
  return JSON.stringify([card.modelName, escapeCardText(card.front).trim()]);
}

function rejectDuplicateCards(cards) {
  const seen = new Map();

  for (const [index, card] of cards.entries()) {
    const identity = reviewedCardIdentity(card);
    const firstIndex = seen.get(identity);

    if (firstIndex !== undefined) {
      throw new Error(
        `Reviewed batch contains duplicate cards at indexes ${firstIndex + 1} and ${index + 1}.`,
      );
    }

    seen.set(identity, index);
  }
}

export function createNote(card, deckName) {
  validateCard(card);

  if (typeof deckName !== 'string' || deckName.trim().length === 0) {
    throw new Error('A non-empty Anki deck name is required.');
  }

  return {
    deckName: deckName.trim(),
    modelName: card.modelName,
    fields: {
      Front: escapeCardText(card.front),
      Back: escapeCardText(card.back),
    },
    options: {
      allowDuplicate: false,
    },
  };
}

export function createAnkiConnectClient({
  url = process.env.ANKI_CONNECT_URL ?? DEFAULT_ANKI_CONNECT_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  const endpoint = normalizeAnkiConnectUrl(url);

  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.');
  }

  async function invoke(action, params = {}) {
    let response;

    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, version: 6, params }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch (error) {
      throw new Error(`Could not reach AnkiConnect at ${endpoint}: ${errorMessage(error)}`);
    }

    if (!response.ok) {
      throw new Error(`AnkiConnect returned HTTP ${response.status}.`);
    }

    let payload;

    try {
      payload = await response.json();
    } catch {
      throw new Error('AnkiConnect returned invalid JSON.');
    }

    if (
      payload === null ||
      typeof payload !== 'object' ||
      !Object.hasOwn(payload, 'result') ||
      !Object.hasOwn(payload, 'error')
    ) {
      throw new Error('AnkiConnect returned an invalid response envelope.');
    }

    if (payload.error !== null) {
      throw new Error(`AnkiConnect error: ${String(payload.error)}`);
    }

    return payload.result;
  }

  return {
    async checkConnection() {
      const version = await invoke('version');

      if (version !== 6) {
        throw new Error(`Unsupported AnkiConnect API version: ${String(version)}.`);
      }

      return version;
    },

    async getDeckNames() {
      const decks = await invoke('deckNames');

      if (!Array.isArray(decks) || decks.some((deck) => typeof deck !== 'string')) {
        throw new Error('AnkiConnect returned an invalid deck list.');
      }

      return decks;
    },

    async getModelNames() {
      const models = await invoke('modelNames');

      if (!Array.isArray(models) || models.some((model) => typeof model !== 'string')) {
        throw new Error('AnkiConnect returned an invalid model list.');
      }

      return models;
    },

    async prepareNotes(cards, deckName) {
      if (!Array.isArray(cards) || cards.length === 0 || cards.length > 20) {
        throw new Error('Provide between 1 and 20 reviewed cards.');
      }

      cards.forEach(validateCard);
      rejectDuplicateCards(cards);
      const normalizedDeck = deckName.trim();
      const [decks, models] = await Promise.all([this.getDeckNames(), this.getModelNames()]);

      if (!decks.includes(normalizedDeck)) {
        throw new Error(`Anki deck "${normalizedDeck}" does not exist.`);
      }

      const missingModel = cards.find((card) => !models.includes(card.modelName))?.modelName;
      if (missingModel) {
        throw new Error(`Anki note model "${missingModel}" is not installed.`);
      }

      return cards.map((card) => createNote(card, normalizedDeck));
    },

    async canAddNotes(cards, deckName) {
      const notes = await this.prepareNotes(cards, deckName);
      const canAdd = await invoke('canAddNotes', { notes });

      if (!Array.isArray(canAdd) || canAdd.length !== notes.length || canAdd.some((item) => typeof item !== 'boolean')) {
        throw new Error('AnkiConnect returned an invalid canAddNotes result.');
      }

      return canAdd;
    },

    async addReviewedNotes(cards, deckName) {
      const notes = await this.prepareNotes(cards, deckName);
      const canAdd = await invoke('canAddNotes', { notes });

      if (!Array.isArray(canAdd) || canAdd.length !== notes.length || canAdd.some((item) => typeof item !== 'boolean')) {
        throw new Error('AnkiConnect returned an invalid canAddNotes result.');
      }

      const blockedIndexes = canAdd.flatMap((allowed, index) => (allowed ? [] : [index]));
      if (blockedIndexes.length > 0) {
        throw new Error(
          `No notes were added. Anki rejected card indexes ${blockedIndexes.join(', ')} during preflight.`,
        );
      }

      const noteIds = await invoke('addNotes', { notes });

      if (
        !Array.isArray(noteIds) ||
        noteIds.length !== notes.length ||
        noteIds.some((noteId) => !Number.isInteger(noteId) || noteId <= 0)
      ) {
        throw new Error(
          'AnkiConnect returned an unexpected addNotes result. The operation may have partially succeeded; inspect Anki before retrying.',
        );
      }

      return noteIds;
    },
  };
}
