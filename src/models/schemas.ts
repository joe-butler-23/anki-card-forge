import { Schema, Type } from '@google/genai';
import { CardType } from '../types';

// Schema for a single card
const cardSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cardType: {
      type: Type.STRING,
      enum: [
        "Basic",
        "Basic (type in the answer)"
      ],
      description: "The type of Anki card to generate."
    },
    front: { 
      type: Type.STRING
    },
    back: {
      type: Type.STRING
    },
  },
  required: ["cardType", "front", "back"]
};

// Schema for the array response
export const flashcardResponseSchema: Schema = {
  type: Type.ARRAY,
  items: cardSchema,
};

// Schema for a single card response (used in Amendment)
export const singleFlashcardSchema: Schema = cardSchema;
