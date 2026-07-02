import { Flashcard, GenerateFlashcardsPayload, Topic } from '../types';
import { TOPIC_PROMPTS } from '../prompts/topics';
import { AIResponseValidationError, validateFlashcardResponse, validateSingleFlashcard } from '../validation/flashcardSchema';

export class CodexAPIError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'CodexAPIError';
  }
}

export class JSONParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JSONParseError';
  }
}

export { AIResponseValidationError };

const MAX_NOTES_CHARS = 20000;
const MAX_INSTRUCTION_CHARS = 8000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function getElectronApi() {
  const api = window.electronAPI;

  if (!api?.generateFlashcards || !api?.amendFlashcard) {
    throw new CodexAPIError('Codex generation is only available in the Electron app.');
  }

  return api;
}

function estimateBase64Bytes(dataUrl: string): number {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const padding = (base64.match(/=+$/) || [''])[0].length;

  return Math.max(0, (base64.length * 3) / 4 - padding);
}

function enforceNotesLimits(notes: string, image?: string | null): void {
  if (notes.length > MAX_NOTES_CHARS) {
    throw new CodexAPIError(`Notes are too long. Please keep them under ${MAX_NOTES_CHARS.toLocaleString()} characters.`);
  }

  if (image && estimateBase64Bytes(image) > MAX_IMAGE_BYTES) {
    throw new CodexAPIError('Image is too large. Please use an image under 5 MB.');
  }
}

function enforceInstructionLimit(instruction: string): void {
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    throw new CodexAPIError(`Amendment instructions are too long. Please keep them under ${MAX_INSTRUCTION_CHARS.toLocaleString()} characters.`);
  }
}

function buildGenerationPrompt(notes: string, topic: Topic): string {
  return `
    ${TOPIC_PROMPTS[topic]}
    
    ---
    USER NOTES / INSTRUCTIONS:
    ${notes}
  `;
}

function buildAmendPrompt(card: Flashcard, instruction: string, topic: Topic): string {
  return `
    Current Card JSON:
    ${JSON.stringify(card)}

    Topic Rules:
    ${TOPIC_PROMPTS[topic]}

    User Instruction to Change this Card:
    ${instruction}
  `;
}

function parseJsonResponse(responseText: string, emptyMessage: string, invalidJsonMessage: string): unknown {
  if (!responseText) {
    throw new CodexAPIError(emptyMessage);
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('JSON Parse Error:', error);
    }

    throw new JSONParseError(invalidJsonMessage);
  }
}

function throwCodexError(error: unknown, fallbackPrefix: string, useFriendlyMappings: boolean): never {
  if (
    error instanceof JSONParseError ||
    error instanceof AIResponseValidationError ||
    error instanceof CodexAPIError
  ) {
    throw error;
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  if (useFriendlyMappings) {
    const lowerCaseMessage = errorMessage.toLowerCase();

    if (lowerCaseMessage.includes('not authenticated') || lowerCaseMessage.includes('run codex login')) {
      throw new CodexAPIError('Codex CLI is not authenticated. Run codex login, then try again.');
    }

    if (lowerCaseMessage.includes('not installed') || lowerCaseMessage.includes('not on path')) {
      throw new CodexAPIError('Codex CLI is not installed or not on PATH.');
    }

    if (errorMessage.includes('429') || lowerCaseMessage.includes('quota')) {
      throw new CodexAPIError('Rate limited - please wait and try again.');
    }

    if (lowerCaseMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || lowerCaseMessage.includes('fetch')) {
      throw new CodexAPIError('Network error - check your connection.');
    }
  }

  throw new CodexAPIError(`${fallbackPrefix}: ${errorMessage}`, error instanceof Error ? error : undefined);
}

function withFlashcardIds(cards: ReturnType<typeof validateFlashcardResponse>): Flashcard[] {
  return cards.map((card) => ({
    ...card,
    id: crypto.randomUUID(),
  }));
}

export async function generateFlashcards(
  notes: string,
  topic: Topic,
  image?: string | null,
  useThinking?: boolean,
): Promise<Flashcard[]> {
  enforceNotesLimits(notes, image);

  const electronAPI = getElectronApi();
  const payload: GenerateFlashcardsPayload = {
    prompt: buildGenerationPrompt(notes, topic),
    image,
    useThinking: Boolean(useThinking),
  };

  try {
    const responseText = await electronAPI.generateFlashcards(payload);
    const rawData = parseJsonResponse(responseText, 'AI returned empty response', 'AI returned invalid JSON format');

    return withFlashcardIds(validateFlashcardResponse(rawData));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Codex Generation Error:', error);
    }

    throwCodexError(error, 'Generation failed', true);
  }
}

export async function amendFlashcard(
  card: Flashcard,
  instruction: string,
  topic: Topic,
): Promise<Flashcard> {
  enforceInstructionLimit(instruction);

  const electronAPI = getElectronApi();

  try {
    const responseText = await electronAPI.amendFlashcard({
      prompt: buildAmendPrompt(card, instruction, topic),
    });
    const rawData = parseJsonResponse(
      responseText,
      'AI returned empty response for amendment',
      'AI returned invalid JSON format for amendment',
    );
    const validatedCard = validateSingleFlashcard(rawData);

    return {
      ...validatedCard,
      id: card.id,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Codex Amendment Error:', error);
    }

    throwCodexError(error, 'Amendment failed', false);
  }
}
