import { Flashcard, Topic } from '../types';
import { TOPIC_PROMPTS } from '../prompts/topics';
import {
  validateFlashcardResponse,
  validateSingleFlashcard,
  AIResponseValidationError
} from '../validation/flashcardSchema';

// Custom error classes for different failure modes
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

const getElectronApi = () => {
  const api = (window as any).electronAPI;
  if (!api?.generateFlashcards || !api?.amendFlashcard) {
    throw new GeminiAPIError('Gemini generation is only available in the Electron app.');
  }
  return api;
};

const estimateBase64Bytes = (dataUrl: string) => {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const padding = (base64.match(/=+$/) || [''])[0].length;
  return Math.max(0, (base64.length * 3) / 4 - padding);
};

const enforceLimits = (notes: string, image?: string | null) => {
  if (notes.length > MAX_NOTES_CHARS) {
    throw new GeminiAPIError(`Notes are too long. Please keep them under ${MAX_NOTES_CHARS.toLocaleString()} characters.`);
  }
  if (image) {
    const bytes = estimateBase64Bytes(image);
    if (bytes > MAX_IMAGE_BYTES) {
      throw new GeminiAPIError('Image is too large. Please use an image under 5 MB.');
    }
  }
};

export const generateFlashcards = async (
  notes: string,
  topic: Topic,
  userProvidedModel: string,
  image?: string | null,
  useThinking?: boolean
): Promise<Flashcard[]> => {
  enforceLimits(notes, image);
  const electronAPI = getElectronApi();

  // Determine model based on user preference, but upgrade if image or thinking mode is used
  let model = userProvidedModel;
  if (image || useThinking) {
    model = 'gemini-3-pro-preview';
  }

  const fullPromptText = `
    ${TOPIC_PROMPTS[topic]}
    
    ---
    USER NOTES / INSTRUCTIONS:
    ${notes}
  `;

  try {
    const responseText = await electronAPI.generateFlashcards({
      prompt: fullPromptText,
      model,
      image,
      useThinking: !!useThinking
    });

    if (!responseText) {
      throw new GeminiAPIError('AI returned empty response');
    }

    // Parse JSON response
    let rawData: unknown;
    try {
      rawData = JSON.parse(responseText);
    } catch (parseError) {
      if (import.meta.env.DEV) {
        console.error('JSON Parse Error:', parseError);
      }
      throw new JSONParseError('AI returned invalid JSON format');
    }

    // Validate the response structure using Zod
    const validatedCards = validateFlashcardResponse(rawData);

    // Add IDs - cardType is already validated by Zod
    return validatedCards.map((card) => ({
      ...card,
      id: crypto.randomUUID(),
    }));
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Gemini Generation Error:', error);
    }

    // Re-throw known error types as-is
    if (error instanceof JSONParseError ||
        error instanceof AIResponseValidationError ||
        error instanceof GeminiAPIError) {
      throw error;
    }

    // Wrap unknown errors with more context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.toLowerCase().includes('api key') || errorMessage.includes('401')) {
      throw new GeminiAPIError('Missing or invalid API key.');
    }
    if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota')) {
      throw new GeminiAPIError('Rate limited - please wait and try again.');
    }
    if (errorMessage.toLowerCase().includes('network') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch')) {
      throw new GeminiAPIError('Network error - check your connection.');
    }

    throw new GeminiAPIError(`Generation failed: ${errorMessage}`, error instanceof Error ? error : undefined);
  }
};

export const amendFlashcard = async (
  card: Flashcard,
  instruction: string,
  topic: Topic,
  model: string
): Promise<Flashcard> => {
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    throw new GeminiAPIError(`Amendment instructions are too long. Please keep them under ${MAX_INSTRUCTION_CHARS.toLocaleString()} characters.`);
  }

  const electronAPI = getElectronApi();

  const prompt = `
    Current Card JSON:
    ${JSON.stringify(card)}

    Topic Rules:
    ${TOPIC_PROMPTS[topic]}

    User Instruction to Change this Card:
    ${instruction}
  `;

  try {
    const responseText = await electronAPI.amendFlashcard({
      prompt,
      model
    });

    if (!responseText) {
      throw new GeminiAPIError('AI returned empty response for amendment');
    }

    // Parse JSON response
    let rawData: unknown;
    try {
      rawData = JSON.parse(responseText);
    } catch (parseError) {
      if (import.meta.env.DEV) {
        console.error('JSON Parse Error:', parseError);
      }
      throw new JSONParseError('AI returned invalid JSON format for amendment');
    }

    // Validate the response structure using Zod
    const validatedCard = validateSingleFlashcard(rawData);

    // Preserve the original ID - cardType is already validated by Zod
    return {
      ...validatedCard,
      id: card.id,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Gemini Amendment Error:', error);
    }

    // Re-throw known error types as-is
    if (error instanceof JSONParseError ||
        error instanceof AIResponseValidationError ||
        error instanceof GeminiAPIError) {
      throw error;
    }

    // Wrap unknown errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new GeminiAPIError(`Amendment failed: ${errorMessage}`, error instanceof Error ? error : undefined);
  }
};
