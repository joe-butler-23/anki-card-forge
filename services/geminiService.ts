import { GoogleGenAI } from '@google/genai';
import { Flashcard, Topic } from '../types';
import { flashcardResponseSchema, singleFlashcardSchema } from '../models/schemas';
import { SYSTEM_INSTRUCTION } from '../prompts/system';
import { AMEND_SYSTEM_INSTRUCTION } from '../prompts/amend';
import { TOPIC_PROMPTS } from '../prompts/topics';

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
  image?: string | null,
  useThinking?: boolean
): Promise<Flashcard[]> => {
  const ai = getAiClient(apiKey);

  // Determine model and config based on features used
  let model = 'gemini-2.5-flash';
  
  // If image analysis or thinking mode is required, upgrade to Gemini 3 Pro
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
      // Add IDs to the generated cards
      return rawData.map((card: any) => ({
        ...card,
        id: crypto.randomUUID(),
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
  apiKey: string
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
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: AMEND_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: singleFlashcardSchema,
      },
    });

    if (response.text) {
      const modifiedCard = JSON.parse(response.text);
      // Preserve the original ID
      return {
        ...modifiedCard,
        id: card.id,
      };
    }
    throw new Error("No response text from AI for amendment");
  } catch (error) {
    console.error("Gemini Amendment Error:", error);
    throw error;
  }
};
