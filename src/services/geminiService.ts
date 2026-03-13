import { DEFAULT_GEMINI_MODEL } from '../constants';
import { Flashcard, GenerateFlashcardsPayload, Topic } from '../types';
import { TOPIC_PROMPTS } from '../prompts/topics';
import { AIResponseValidationError, validateFlashcardResponse, validateSingleFlashcard } from '../validation/flashcardSchema';

export class GeminiAPIError extends Error {
  constructor(message: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'GeminiAPIError';
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
    throw new GeminiAPIError('Gemini generation is only available in the Electron app.');
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
    throw new GeminiAPIError(`Notes are too long. Please keep them under ${MAX_NOTES_CHARS.toLocaleString()} characters.`);
  }

  if (image && estimateBase64Bytes(image) > MAX_IMAGE_BYTES) {
    throw new GeminiAPIError('Image is too large. Please use an image under 5 MB.');
  }
}

function enforceInstructionLimit(instruction: string): void {
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    throw new GeminiAPIError(`Amendment instructions are too long. Please keep them under ${MAX_INSTRUCTION_CHARS.toLocaleString()} characters.`);
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

function resolveGenerationModel(userProvidedModel: string, image?: string | null, useThinking?: boolean): string {
  return image || useThinking ? DEFAULT_GEMINI_MODEL : userProvidedModel;
}

function parseJsonResponse(responseText: string, emptyMessage: string, invalidJsonMessage: string): unknown {
  if (!responseText) {
    throw new GeminiAPIError(emptyMessage);
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

function throwGeminiError(error: unknown, fallbackPrefix: string, useFriendlyMappings: boolean): never {
  if (
    error instanceof JSONParseError ||
    error instanceof AIResponseValidationError ||
    error instanceof GeminiAPIError
  ) {
    throw error;
  }

  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  if (useFriendlyMappings) {
    const lowerCaseMessage = errorMessage.toLowerCase();

    if (lowerCaseMessage.includes('api key') || errorMessage.includes('401')) {
      throw new GeminiAPIError('Missing or invalid API key.');
    }

    if (errorMessage.includes('429') || lowerCaseMessage.includes('quota')) {
      throw new GeminiAPIError('Rate limited - please wait and try again.');
    }

    if (lowerCaseMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || lowerCaseMessage.includes('fetch')) {
      throw new GeminiAPIError('Network error - check your connection.');
    }
  }

  throw new GeminiAPIError(`${fallbackPrefix}: ${errorMessage}`, error instanceof Error ? error : undefined);
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
  userProvidedModel: string,
  image?: string | null,
  useThinking?: boolean,
): Promise<Flashcard[]> {
  enforceNotesLimits(notes, image);

  const electronAPI = getElectronApi();
  const payload: GenerateFlashcardsPayload = {
    prompt: buildGenerationPrompt(notes, topic),
    model: resolveGenerationModel(userProvidedModel, image, useThinking),
    image,
    useThinking: Boolean(useThinking),
  };

  try {
    const responseText = await electronAPI.generateFlashcards(payload);
    const rawData = parseJsonResponse(responseText, 'AI returned empty response', 'AI returned invalid JSON format');

    return withFlashcardIds(validateFlashcardResponse(rawData));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Gemini Generation Error:', error);
    }

    throwGeminiError(error, 'Generation failed', true);
  }
}

export async function amendFlashcard(
  card: Flashcard,
  instruction: string,
  topic: Topic,
  model: string,
): Promise<Flashcard> {
  enforceInstructionLimit(instruction);

  const electronAPI = getElectronApi();

  try {
    const responseText = await electronAPI.amendFlashcard({
      prompt: buildAmendPrompt(card, instruction, topic),
      model,
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
      console.error('Gemini Amendment Error:', error);
    }

    throwGeminiError(error, 'Amendment failed', false);
  }
}
