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
  tags: string[];
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

export interface ElectronCardPacketCard {
  modelName: CardType;
  front: string;
  back: string;
  tags?: string[];
}

export interface ElectronCardPacket {
  protocolVersion: 1;
  id: string;
  deckName: string;
  cards: ElectronCardPacketCard[];
  createdAt: string;
}

export type ElectronCardPacketUpdate =
  | { status: 'sent'; noteIds: number[] }
  | { status: 'failed'; error: string }
  | { status: 'cancelled' };

export interface ElectronAPI {
  savePrompt: (topic: Topic, content: string) => Promise<boolean>;
  loadPromptBackups: (topic: Topic) => Promise<PromptBackupVersion[]>;
  refreshPromptOverrides: () => Promise<Record<string, string>>;
  zoomIn: () => Promise<void>;
  zoomOut: () => Promise<void>;
  checkCodex: () => Promise<CodexStatus>;
  generateFlashcards: (payload: GenerateFlashcardsPayload) => Promise<string>;
  amendFlashcard: (payload: AmendFlashcardPayload) => Promise<string>;
  onCardPacket: (callback: (packet: ElectronCardPacket) => void) => () => void;
  setCardPacketReady: (ready: boolean) => Promise<unknown>;
  markCardPacketVisible: (packetId: string) => Promise<unknown>;
  updateCardPacket: (packetId: string, update: ElectronCardPacketUpdate) => Promise<unknown>;
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
