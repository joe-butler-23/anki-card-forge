import { GoogleGenAI } from '@google/genai';
import { CardType, Flashcard, Topic } from '../types';
import { flashcardResponseSchema, singleFlashcardSchema } from '../models/schemas';
import { SYSTEM_INSTRUCTION } from '../prompts/system';
import { AMEND_SYSTEM_INSTRUCTION } from '../prompts/amend';
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

const normalizeCardType = (aiCardType: string): CardType => {
  console.log(`[Debug] Normalizing card type. Raw AI value: "${aiCardType}"`);

  // First, check for exact matches, which is the ideal case.
  if (aiCardType === CardType.BasicTyping) {
    console.log('[Debug] Normalized to: BasicTyping (exact match)');
    return CardType.BasicTyping;
  }
  if (aiCardType === CardType.Basic) {
    console.log('[Debug] Normalized to: Basic (exact match)');
    return CardType.Basic;
  }

  // If no exact match, log a warning and try to infer the correct type.
  console.warn(`Unexpected card type from AI: "${aiCardType}". Attempting to infer correct type.`);
  
  const lowerCaseType = aiCardType.toLowerCase();
  if (lowerCaseType.includes('type') || lowerCaseType.includes('typing')) {
    console.log('[Debug] Inferred type: BasicTyping');
    return CardType.BasicTyping;
  }

  if (lowerCaseType.includes('reverse') || lowerCaseType.includes('reversed')) {
    console.log('[Debug] Inferred type: BasicTyping (from reverse)');
    return CardType.BasicTyping;
  }
  
  // Default to Basic for any other case
  console.log('[Debug] Defaulting to type: Basic');
  return CardType.Basic;
};

// Helper to get the client
const getAiClient = (apiKey: string) => {
  if (!apiKey) {
    throw new Error("API Key is missing. Please check your environment configuration.");
  }
  return new GoogleGenAI({ apiKey });
};

export const generateFlashcards = async (
  notes: string,
  topic: Topic,
  apiKey: string,
  userProvidedModel: string,
  image?: string | null,
  useThinking?: boolean
): Promise<Flashcard[]> => {
  const ai = getAiClient(apiKey);

  // Determine model based on user preference, but upgrade if image or thinking mode is used
  let model = userProvidedModel;
  if (image || useThinking) {
    model = 'gemini-3-pro-preview';
  }

  const config: any = {
    systemInstruction: SYSTEM_INSTRUCTION,
    responseMimeType: 'application/json',
    responseSchema: flashcardResponseSchema,
  };

  // Configure Thinking Mode if requested
  if (useThinking) {
    config.thinkingConfig = { thinkingBudget: 32768 };
  } else {
    config.temperature = 0.3;
  }

  const fullPromptText = `
    ${TOPIC_PROMPTS[topic]}
    
    ---
    USER NOTES / INSTRUCTIONS:
    ${notes}
  `;

  console.log('[Debug] Sending the following prompt to the AI:', fullPromptText);

  // Construct contents (Text only or Multimodal)
  let contents: any;

  if (image) {
    const imagePart = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: image.split(',')[1] || image,
      },
    };
    const textPart = { text: fullPromptText };
    contents = { parts: [imagePart, textPart] };
  } else {
    contents = fullPromptText;
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config,
    });

    if (!response.text) {
      throw new GeminiAPIError('AI returned empty response');
    }

    // Parse JSON response
    let rawData: unknown;
    try {
      rawData = JSON.parse(response.text);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
      throw new JSONParseError('AI returned invalid JSON format');
    }

    console.log('[Debug] Raw data received from AI:', rawData);

    // Validate the response structure using Zod
    const validatedCards = validateFlashcardResponse(rawData);

    // Add IDs - cardType is already validated by Zod
    return validatedCards.map((card) => {
      console.log(`[Debug] Validated cardType for a card: "${card.cardType}"`);
      return {
        ...card,
        id: crypto.randomUUID(),
      };
    });
  } catch (error) {
    console.error("Gemini Generation Error:", error);

    // Re-throw known error types as-is
    if (error instanceof JSONParseError ||
        error instanceof AIResponseValidationError ||
        error instanceof GeminiAPIError) {
      throw error;
    }

    // Wrap unknown errors with more context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for common API errors
    if (errorMessage.includes('API_KEY') || errorMessage.includes('api key') || errorMessage.includes('401')) {
      throw new GeminiAPIError('Invalid API key');
    }
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
      throw new GeminiAPIError('Rate limited - please wait and try again');
    }
    if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch')) {
      throw new GeminiAPIError('Network error - check your connection');
    }

    throw new GeminiAPIError(`Generation failed: ${errorMessage}`, error instanceof Error ? error : undefined);
  }
};

export const amendFlashcard = async (
  card: Flashcard,
  instruction: string,
  topic: Topic,
  apiKey: string,
  model: string
): Promise<Flashcard> => {
  const ai = getAiClient(apiKey);

  const prompt = `
    Current Card JSON:
    ${JSON.stringify(card)}

    Topic Rules:
    ${TOPIC_PROMPTS[topic]}

    User Instruction to Change this Card:
    ${instruction}
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: AMEND_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: singleFlashcardSchema,
      },
    });

    if (!response.text) {
      throw new GeminiAPIError('AI returned empty response for amendment');
    }

    // Parse JSON response
    let rawData: unknown;
    try {
      rawData = JSON.parse(response.text);
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError);
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
    console.error("Gemini Amendment Error:", error);

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
