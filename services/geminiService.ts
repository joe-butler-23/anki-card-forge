import { GoogleGenAI } from '@google/genai';
import { CardType, Flashcard, Topic } from '../types';
import { flashcardResponseSchema, singleFlashcardSchema } from '../models/schemas';
import { SYSTEM_INSTRUCTION } from '../prompts/system';
import { AMEND_SYSTEM_INSTRUCTION } from '../prompts/amend';
import { TOPIC_PROMPTS } from '../prompts/topics';

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

    if (response.text) {
      const rawData = JSON.parse(response.text);
      console.log('[Debug] Raw data received from AI:', rawData);

      // Add IDs and normalize the card type
      return rawData.map((card: any) => {
        console.log(`[Debug] Raw cardType from AI for a card: "${card.cardType}"`);
        return {
          ...card,
          id: crypto.randomUUID(),
          cardType: normalizeCardType(card.cardType),
        };
      });
    }
    return [];
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
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

    if (response.text) {
      const modifiedCard = JSON.parse(response.text);
      // Preserve the original ID and normalize the type
      return {
        ...modifiedCard,
        id: card.id,
        cardType: normalizeCardType(modifiedCard.cardType),
      };
    }
    throw new Error("No response text from AI for amendment");
  } catch (error) {
    console.error("Gemini Amendment Error:", error);
    throw error;
  }
};
