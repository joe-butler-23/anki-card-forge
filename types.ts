export enum AppStep {
  Setup = 'setup',
  Generating = 'generating',
  Reviewing = 'reviewing',
  Finalizing = 'finalizing',
  Sending = 'sending',
  Done = 'done',
}

export enum CardType {
  Basic = 'Basic',
  BasicTyping = 'Basic (type in the answer)',
}

export interface Flashcard {
  id: string;
  cardType: CardType;
  front: string;
  back: string;
  isDeleted?: boolean;
}

export enum Topic {
  General = 'General',
  MathScience = 'Math/Science',
  Vocabulary = 'Vocabulary',
  Programming = 'Programming',
}

export interface AnkiDeck {
  name: string;
  id?: number;
}

export interface GenerationParams {
  notes: string;
  topic: Topic;
  deckName: string;
}

// AnkiConnect Types
export interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}
