
import { Schema, Type } from '@google/genai';
import { CardType } from '../types';

// Schema for a single card
const cardSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cardType: {
      type: Type.STRING,
      enum: [CardType.Basic, CardType.BasicReversed, CardType.Cloze],
      description: "The type of Anki card to generate."
    },
    front: { 
        type: Type.STRING,
        description: "The front of the card. For Cloze, this is ignored in final generation but should be filled for preview."
    },
    back: { 
        type: Type.STRING,
        description: "The back of the card. Contains the answer or definition."
    },
    cloze: { 
        type: Type.STRING, 
        description: "Required only for Cloze type cards. Contains {{c1::...}} syntax." 
    },
  },
  required: ['cardType', 'front', 'back'],
};

// Schema for the array response
export const flashcardResponseSchema: Schema = {
  type: Type.ARRAY,
  items: cardSchema,
};

// Schema for a single card response (used in Amendment)
export const singleFlashcardSchema: Schema = cardSchema;
