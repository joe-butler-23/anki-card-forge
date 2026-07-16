import type { ReviewStatus } from './reviewState';

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
  reviewStatus: ReviewStatus;
}

export enum Topic {
  General = 'General',
  MathScience = 'Math/Science',
  Vocabulary = 'Vocabulary',
  Programming = 'Programming',
}

// AnkiConnect Types
export interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

export interface PromptBackupVersion {
  timestamp: string;
  content: string;
}

export interface GenerateFlashcardsPayload {
  prompt: string;
  image?: string | null;
  useThinking?: boolean;
}

export interface AmendFlashcardPayload {
  prompt: string;
}

export interface CodexStatus {
  available: boolean;
  authenticated: boolean;
  version?: string;
  message?: string;
}

export interface ElectronAPI {
  savePrompt: (topic: Topic, content: string) => Promise<boolean>;
  loadPromptBackups: (topic: Topic) => Promise<PromptBackupVersion[]>;
  refreshPromptOverrides: () => Promise<Record<string, string>>;
  zoomIn: () => Promise<void>;
  zoomOut: () => Promise<void>;
  checkCodex: () => Promise<CodexStatus>;
  generateFlashcards: (payload: GenerateFlashcardsPayload) => Promise<string>;
  amendFlashcard: (payload: AmendFlashcardPayload) => Promise<string>;
}

export interface MathJaxWindowApi {
  [key: string]: unknown;
  typesetPromise?: (elements: HTMLElement[]) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
    customPromptOverrides?: Record<string, string>;
    MathJax?: MathJaxWindowApi;
  }
}
