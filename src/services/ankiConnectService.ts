import { ANKI_CONNECT_URL_PRIMARY, ANKI_CONNECT_URL_FALLBACK } from '../constants';
import { AnkiConnectResponse, Flashcard, CardType } from '../types';
import { sanitizeCardHtml } from '../utils/sanitizeHtml';

const isDev = import.meta.env.DEV;

let customAnkiUrl: string | null = null;

const isLocalhostHost = (host: string) =>
  host === 'localhost' || host === '127.0.0.1' || host === '::1';

export const setAnkiUrl = (url: string) => {
  if (!url.trim()) {
    customAnkiUrl = null;
    return;
  }
  // Ensure valid format
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http')) {
    formattedUrl = `http://${formattedUrl}`;
  }
  let parsed: URL;
  try {
    parsed = new URL(formattedUrl);
  } catch {
    throw new Error('Invalid AnkiConnect URL.');
  }
  if (!isLocalhostHost(parsed.hostname)) {
    throw new Error('AnkiConnect must be hosted on localhost.');
  }
  // Remove trailing slash
  customAnkiUrl = parsed.toString().replace(/\/$/, "");
};

// Helper for the fetch strategy
async function invokeAnki<T>(action: string, params: any = {}): Promise<T> {
  const payload = { action, version: 6, params };
  
  // Determine which URLs to try
  const candidateUrls = customAnkiUrl 
    ? [customAnkiUrl] 
    : [ANKI_CONNECT_URL_PRIMARY, ANKI_CONNECT_URL_FALLBACK];

  const errors: string[] = [];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
          // Note: Browsers automatically attach the 'Origin' header.
          // AnkiConnect must have this origin in 'webCorsOriginList'.
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json() as AnkiConnectResponse<T>;

      if (json.error) {
        throw new Error(json.error);
      }

      return json.result;

    } catch (e: any) {
      if (isDev) {
        console.warn(`Connection attempt to ${url} failed:`, e);
      }
      errors.push(`${url}: ${e.message || 'Unknown error'}`);
      // Continue to next candidate
    }
  }

  // If we get here, all candidates failed.
  // Check if it was a likely CORS/Network error (Failed to fetch)
  const isNetworkError = errors.some(err => err.includes("Failed to fetch"));

  if (isNetworkError) {
    throw new Error(
      "Network Error: Could not reach Anki.\n" +
      "1. Is Anki running?\n" +
      "2. Is AnkiConnect installed?\n" +
      "3. Is your 'webCorsOriginList' configured correctly?"
    );
  }
  
  throw new Error(`Anki Connection Failed:\n${errors.join('\n')}`);
}

export const getDeckNames = async (): Promise<string[]> => {
  return invokeAnki<string[]>('deckNames');
};

// Returns true/false safely without throwing, for initial status checks
export const checkConnection = async (): Promise<boolean> => {
  try {
    await invokeAnki('version');
    return true;
  } catch (e) {
    return false;
  }
};

// Explicitly throws error if connection fails, for manual retry actions
export const pingAnki = async (): Promise<void> => {
  await invokeAnki('version');
};

export const addNotesToAnki = async (cards: Flashcard[], deckName: string): Promise<number[]> => {
  if (isDev) {
    console.log('[Debug] Preparing to add notes to Anki. Processing cards...');
  }
  const notes = cards
    .filter(c => !c.isDeleted)
    .map(card => {
      if (isDev) {
        console.log(`[Debug] Processing card. Internal type: "${card.cardType}"`);
      }
      // Map internal types to AnkiConnect types
      let modelName = 'Basic';
      const fields: Record<string, string> = {};
      const sanitizedFront = sanitizeCardHtml(card.front);
      const sanitizedBack = sanitizeCardHtml(card.back);

      if (card.cardType === CardType.Basic) {
        modelName = 'Basic';
        fields['Front'] = sanitizedFront;
        fields['Back'] = sanitizedBack;
      } else if (card.cardType === CardType.BasicTyping) {
        modelName = 'Basic (type in the answer)';
        fields['Front'] = sanitizedFront;
        fields['Back'] = sanitizedBack;
      }
      
      if (isDev) {
        console.log(`[Debug] Mapped to Anki modelName: "${modelName}"`);
      }

      return {
        deckName,
        modelName,
        fields,
        options: {
          allowDuplicate: false,
        }
      };
    });

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
};
