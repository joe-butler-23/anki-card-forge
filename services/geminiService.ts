import { GoogleGenAI } from '@google/genai';
import { CardType, Flashcard, Topic } from '../types';
import { flashcardResponseSchema, singleFlashcardSchema } from '../models/schemas';
import { SYSTEM_INSTRUCTION } from '../prompts/system';
import { AMEND_SYSTEM_INSTRUCTION } from '../prompts/amend';
import { TOPIC_PROMPTS } from '../prompts/topics';

const normalizeCardType = (aiCardType: string): CardType => {
  // First, check for exact matches, which is the ideal case.
  if (aiCardType === CardType.BasicTyping) {
    return CardType.BasicTyping;
  }
  if (aiCardType === CardType.Basic) {
    return CardType.Basic;
  }

  // If no exact match, log a warning and try to infer the correct type.
  // This makes the system more robust to minor AI deviations.
  console.warn(`Unexpected card type from AI: "${aiCardType}". Defaulting to an inferred type.`);
  
  const lowerCaseType = aiCardType.toLowerCase();
  if (lowerCaseType.includes('type in') || lowerCaseType.includes('typing')) {
    return CardType.BasicTyping;
  }
  
  // Default to Basic for any other case (e.g., "Basic (and reversed card)")
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
      // Add IDs and normalize the card type
      return rawData.map((card: any) => ({
        ...card,
        id: crypto.randomUUID(),
        cardType: normalizeCardType(card.cardType),
      }));
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
