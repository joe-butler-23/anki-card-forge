import { z } from 'zod';
import { CardType } from '../types';

// Schema for validating a single flashcard from AI response
export const FlashcardSchema = z.object({
  cardType: z.enum([CardType.Basic, CardType.BasicTyping]),
  front: z.string().min(1, 'Card front cannot be empty'),
  back: z.string().min(1, 'Card back cannot be empty'),
});

// Schema for validating array of flashcards
export const FlashcardArraySchema = z.array(FlashcardSchema).min(1, 'Response must contain at least one card');

// Type exports for use elsewhere
export type ValidatedFlashcard = z.infer<typeof FlashcardSchema>;

// Custom error class for AI response validation failures
export class AIResponseValidationError extends Error {
  constructor(
    message: string,
    public readonly details: string[]
  ) {
    super(message);
    this.name = 'AIResponseValidationError';
  }
}

// Validate and parse AI response for flashcard generation
export function validateFlashcardResponse(data: unknown): ValidatedFlashcard[] {
  // First check if it's an array
  if (!Array.isArray(data)) {
    throw new AIResponseValidationError(
      'AI returned invalid response format',
      ['Expected an array of flashcards but received: ' + typeof data]
    );
  }

  const result = FlashcardArraySchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });

    throw new AIResponseValidationError(
      'AI response failed validation',
      errors
    );
  }

  return result.data;
}

// Validate single flashcard (for amend operation)
export function validateSingleFlashcard(data: unknown): ValidatedFlashcard {
  if (typeof data !== 'object' || data === null) {
    throw new AIResponseValidationError(
      'AI returned invalid card format',
      ['Expected a flashcard object but received: ' + typeof data]
    );
  }

  const result = FlashcardSchema.safeParse(data);

  if (!result.success) {
    const errors = result.error.issues.map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });

    throw new AIResponseValidationError(
      'AI returned invalid card data',
      errors
    );
  }

  return result.data;
}
