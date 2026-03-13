import { ANKI_CONNECT_URL_FALLBACK, ANKI_CONNECT_URL_PRIMARY } from '../constants';
import { AnkiConnectResponse, CardType, Flashcard } from '../types';
import { sanitizeCardHtml } from '../utils/sanitizeHtml';

const isDev = import.meta.env.DEV;

const ANKI_MODEL_BY_CARD_TYPE: Record<CardType, string> = {
  [CardType.Basic]: 'Basic',
  [CardType.BasicTyping]: CardType.BasicTyping,
};

type AnkiParams = Record<string, unknown>;
type AnkiNote = {
  deckName: string;
  modelName: string;
  fields: Record<'Front' | 'Back', string>;
  options: {
    allowDuplicate: boolean;
  };
};

let customAnkiUrl: string | null = null;

function isLocalhostHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function getCandidateUrls(): string[] {
  return customAnkiUrl ? [customAnkiUrl] : [ANKI_CONNECT_URL_PRIMARY, ANKI_CONNECT_URL_FALLBACK];
}

function getNetworkErrorMessage(): string {
  return (
    'Network Error: Could not reach Anki.\n' +
    '1. Is Anki running?\n' +
    '2. Is AnkiConnect installed?\n' +
    "3. Is your 'webCorsOriginList' configured correctly?"
  );
}

function normalizeAnkiUrl(url: string): string | null {
  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return null;
  }

  const formattedUrl = trimmedUrl.startsWith('http') ? trimmedUrl : `http://${trimmedUrl}`;
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(formattedUrl);
  } catch {
    throw new Error('Invalid AnkiConnect URL.');
  }

  if (!isLocalhostHost(parsedUrl.hostname)) {
    throw new Error('AnkiConnect must be hosted on localhost.');
  }

  return parsedUrl.toString().replace(/\/$/, '');
}

function createNote(card: Flashcard, deckName: string): AnkiNote {
  const modelName = ANKI_MODEL_BY_CARD_TYPE[card.cardType];
  const fields = {
    Front: sanitizeCardHtml(card.front),
    Back: sanitizeCardHtml(card.back),
  };

  if (isDev) {
    console.log(`[Debug] Processing card. Internal type: "${card.cardType}"`);
    console.log(`[Debug] Mapped to Anki modelName: "${modelName}"`);
  }

  return {
    deckName,
    modelName,
    fields,
    options: {
      allowDuplicate: false,
    },
  };
}

export function setAnkiUrl(url: string): void {
  customAnkiUrl = normalizeAnkiUrl(url);
}

async function invokeAnki<T>(action: string, params: AnkiParams = {}): Promise<T> {
  const payload = { action, version: 6, params };
  const errors: string[] = [];

  for (const url of getCandidateUrls()) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = (await response.json()) as AnkiConnectResponse<T>;

      if (json.error) {
        throw new Error(json.error);
      }

      return json.result;
    } catch (error) {
      if (isDev) {
        console.warn(`Connection attempt to ${url} failed:`, error);
      }

      errors.push(`${url}: ${getErrorMessage(error)}`);
    }
  }

  if (errors.some((error) => error.includes('Failed to fetch'))) {
    throw new Error(getNetworkErrorMessage());
  }

  throw new Error(`Anki Connection Failed:\n${errors.join('\n')}`);
}

export async function getDeckNames(): Promise<string[]> {
  return invokeAnki<string[]>('deckNames');
}

export async function checkConnection(): Promise<boolean> {
  try {
    await invokeAnki('version');
    return true;
  } catch {
    return false;
  }
}

export async function pingAnki(): Promise<void> {
  await invokeAnki('version');
}

export async function addNotesToAnki(cards: Flashcard[], deckName: string): Promise<number[]> {
  if (isDev) {
    console.log('[Debug] Preparing to add notes to Anki. Processing cards...');
  }

  const notes = cards.filter((card) => !card.isDeleted).map((card) => createNote(card, deckName));

  if (notes.length === 0) {
    if (isDev) {
      console.log('[Debug] No valid notes to add.');
    }

    return [];
  }

  if (isDev) {
    console.log('[Debug] Sending final notes payload to AnkiConnect:', notes);
  }

  return invokeAnki<number[]>('addNotes', { notes });
}
