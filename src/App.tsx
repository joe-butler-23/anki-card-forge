import React, { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ANKI_CONNECT_URL_PRIMARY, DEFAULT_ANKI_DECK, DEFAULT_GEMINI_MODEL } from './constants';
import { DoneStep } from './components/steps/DoneStep';
import { FinalizeStep } from './components/steps/FinalizeStep';
import { Header } from './components/Header';
import { LoadingStep } from './components/steps/LoadingStep';
import { ReviewStep } from './components/steps/ReviewStep';
import { SettingsModal } from './components/SettingsModal';
import { SetupStep } from './components/steps/SetupStep';
import { addNotesToAnki, checkConnection, getDeckNames, pingAnki, setAnkiUrl } from './services/ankiConnectService';
import { AIResponseValidationError, amendFlashcard, generateFlashcards, GeminiAPIError, JSONParseError } from './services/geminiService';
import { AppStep, Flashcard, Topic } from './types';

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

function getGeminiErrorMessage(
  error: unknown,
  options: {
    validationPrefix: string;
    invalidJsonMessage: string;
    fallbackMessage: string;
  },
): string {
  if (error instanceof AIResponseValidationError) {
    return `${options.validationPrefix}:\n${error.details.join('\n')}`;
  }

  if (error instanceof JSONParseError) {
    return options.invalidJsonMessage;
  }

  if (error instanceof GeminiAPIError || error instanceof Error) {
    return error.message;
  }

  return options.fallbackMessage;
}

function updateCardAtIndex(
  cards: Flashcard[],
  index: number,
  updater: (card: Flashcard) => Flashcard,
): Flashcard[] {
  return cards.map((card, cardIndex) => (cardIndex === index ? updater(card) : card));
}

function getLoadingMessage(useThinking: boolean): string {
  return useThinking ? 'Deep thinking in progress...' : 'Consulting the Neural Forge...';
}

function App(): React.JSX.Element {
  const [step, setStep] = useState<AppStep>(AppStep.Setup);
  const [decks, setDecks] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedDeck, setSelectedDeck] = useState(DEFAULT_ANKI_DECK);
  const [selectedTopic, setSelectedTopic] = useState<Topic>(Topic.General);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [useThinking, setUseThinking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [customUrl, setCustomUrlState] = useState(ANKI_CONNECT_URL_PRIMARY);
  const [hasGeminiApiKey, setHasGeminiApiKey] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [generatedCards, setGeneratedCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [amendInstruction, setAmendInstruction] = useState('');
  const [isAmending, setIsAmending] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    function handleWheel(event: WheelEvent): void {
      if (!event.ctrlKey) {
        return;
      }

      event.preventDefault();

      if (!window.electronAPI) {
        return;
      }

      if (event.deltaY < 0) {
        void window.electronAPI.zoomIn();
      } else {
        void window.electronAPI.zoomOut();
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    async function checkApiKey(): Promise<void> {
      try {
        const hasApiKey = await window.electronAPI?.hasApiKey?.();
        setHasGeminiApiKey(Boolean(hasApiKey));
      } catch (error) {
        console.error('Failed to check API key:', error);
        setHasGeminiApiKey(false);
      } finally {
        setIsCheckingApiKey(false);
      }
    }

    void checkApiKey();
  }, []);

  async function saveGeminiApiKey(key: string): Promise<boolean> {
    if (!window.electronAPI?.setApiKey) {
      return false;
    }

    try {
      const saved = await window.electronAPI.setApiKey(key);

      if (saved) {
        setHasGeminiApiKey(true);
        return true;
      }
    } catch (error) {
      console.error('Failed to save API key to secure storage:', error);
    }

    return false;
  }

  async function clearGeminiApiKey(): Promise<void> {
    if (!window.electronAPI?.clearApiKey) {
      return;
    }

    try {
      const cleared = await window.electronAPI.clearApiKey();

      if (cleared) {
        setHasGeminiApiKey(false);
      }
    } catch (error) {
      console.error('Failed to clear API key:', error);
    }
  }

  async function refreshConnection(showErrors: boolean): Promise<void> {
    setIsCheckingConnection(true);

    if (showErrors) {
      setError(null);
    }

    try {
      const connected = showErrors ? true : await checkConnection();

      if (!connected) {
        setIsConnected(false);
        return;
      }

      if (showErrors) {
        await pingAnki();
      }

      const deckList = await getDeckNames();

      setIsConnected(true);
      setDecks(deckList);
      setSelectedDeck((currentDeck) => {
        if (deckList.length === 0) {
          return currentDeck;
        }

        if (!showErrors && currentDeck !== DEFAULT_ANKI_DECK) {
          return currentDeck;
        }

        return deckList[0];
      });
      setError(null);

      if (showErrors) {
        setShowSettings(false);
      }
    } catch (error) {
      setIsConnected(false);

      if (showErrors) {
        setError(getErrorMessage(error, 'Failed to connect to Anki.'));
      }
    } finally {
      setIsCheckingConnection(false);
    }
  }

  useEffect(() => {
    void refreshConnection(false);
  }, []);

  async function handleUrlUpdate(url?: string): Promise<void> {
    const urlToUse = url ?? customUrl;

    try {
      setAnkiUrl(urlToUse);
      await refreshConnection(true);
    } catch (error) {
      setError(getErrorMessage(error, 'Invalid AnkiConnect URL.'));
    }
  }

  async function handleGenerate(): Promise<void> {
    if (!notes.trim() && !selectedImage) {
      setError('Please enter notes or upload an image.');
      return;
    }

    if (!hasGeminiApiKey && !isCheckingApiKey) {
      setError('Please add your Gemini API key in Settings before generating.');
      return;
    }

    setError(null);
    setStep(AppStep.Generating);
    setLoadingMessage(getLoadingMessage(useThinking));

    try {
      const cards = await generateFlashcards(notes, selectedTopic, DEFAULT_GEMINI_MODEL, selectedImage, useThinking);

      if (cards.length === 0) {
        setError('AI returned no cards. Try adding more detail to your notes.');
        setStep(AppStep.Setup);
        return;
      }

      setGeneratedCards(cards);
      setCurrentCardIndex(0);
      setStep(AppStep.Reviewing);
    } catch (error) {
      console.error(error);
      setError(
        getGeminiErrorMessage(error, {
          validationPrefix: 'AI response validation failed',
          invalidJsonMessage: 'AI returned an invalid response format. Please try again.',
          fallbackMessage: 'Generation failed. Please try again.',
        }),
      );
      setStep(AppStep.Setup);
    }
  }

  function handleCardAction(action: 'accept' | 'reject'): void {
    if (isEditing) {
      setIsEditing(false);
    }

    if (action === 'reject') {
      setGeneratedCards((cards) =>
        updateCardAtIndex(cards, currentCardIndex, (card) => ({
          ...card,
          isDeleted: true,
        })),
      );
    }

    if (currentCardIndex < generatedCards.length - 1) {
      setCurrentCardIndex((index) => index + 1);
    } else {
      setStep(AppStep.Finalizing);
    }
  }

  async function handleAmend(): Promise<void> {
    if (!amendInstruction.trim()) {
      return;
    }

    const currentCard = generatedCards[currentCardIndex];

    if (!currentCard) {
      return;
    }

    setIsAmending(true);

    try {
      const amendedCard = await amendFlashcard(currentCard, amendInstruction, selectedTopic, DEFAULT_GEMINI_MODEL);

      setGeneratedCards((cards) => updateCardAtIndex(cards, currentCardIndex, () => amendedCard));
      setAmendInstruction('');
    } catch (error) {
      console.error(error);
      setError(
        getGeminiErrorMessage(error, {
          validationPrefix: 'Card amendment validation failed',
          invalidJsonMessage: 'AI returned an invalid response. Please try again.',
          fallbackMessage: 'Failed to amend card.',
        }),
      );
    } finally {
      setIsAmending(false);
    }
  }

  function handleManualEdit(field: keyof Flashcard, value: string): void {
    setGeneratedCards((cards) =>
      updateCardAtIndex(cards, currentCardIndex, (card) => ({
        ...card,
        [field]: value,
      })),
    );
  }

  async function handleSendToAnki(): Promise<void> {
    if (!isConnected) {
      setError('Anki is not connected. Please connect via Settings or download the JSON.');
      return;
    }

    setStep(AppStep.Sending);
    setLoadingMessage('Forging cards into Anki...');

    try {
      const addedIds = await addNotesToAnki(generatedCards, selectedDeck);

      if (import.meta.env.DEV) {
        console.log(`Added ${addedIds.length} cards`);
      }

      setStep(AppStep.Done);
    } catch (error) {
      setError(getErrorMessage(error, 'Failed to sync with Anki. Is the app open?'));
      setStep(AppStep.Finalizing);
    }
  }

  function handleDownloadJson(): void {
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(generatedCards, null, 2))}`;
    const anchor = document.createElement('a');

    anchor.href = dataStr;
    anchor.download = `anki_forge_export_${new Date().toISOString().slice(0, 10)}.json`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  function handleReset(): void {
    setNotes('');
    setSelectedImage(null);
    setGeneratedCards([]);
    setStep(AppStep.Setup);
    setError(null);
  }

  function handleGoHome(): void {
    if (step === AppStep.Generating || step === AppStep.Sending) {
      return;
    }

    setStep(AppStep.Setup);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12 font-sans transition-colors duration-300">
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        customUrl={customUrl}
        setCustomUrl={setCustomUrlState}
        hasGeminiApiKey={hasGeminiApiKey}
        onSaveApiKey={saveGeminiApiKey}
        onClearApiKey={clearGeminiApiKey}
        isCheckingApiKey={isCheckingApiKey}
        isChecking={isCheckingConnection}
        onSave={handleUrlUpdate}
      />

      <Header
        step={step}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        isConnected={isConnected}
        onGoHome={handleGoHome}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="container mx-auto px-4">
        {error ? (
          <div className="max-w-2xl mx-auto mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-900/50 flex items-start gap-3 animate-in slide-in-from-top-2">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <span className="whitespace-pre-wrap text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto font-bold hover:underline text-sm">
              Dismiss
            </button>
          </div>
        ) : null}

        {step === AppStep.Setup ? (
          <SetupStep
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            isConnected={isConnected}
            onOpenSettings={() => setShowSettings(true)}
            decks={decks}
            selectedDeck={selectedDeck}
            setSelectedDeck={setSelectedDeck}
            selectedTopic={selectedTopic}
            setSelectedTopic={setSelectedTopic}
            notes={notes}
            setNotes={setNotes}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            useThinking={useThinking}
            setUseThinking={setUseThinking}
            onGenerate={handleGenerate}
          />
        ) : null}

        {step === AppStep.Generating || step === AppStep.Sending ? <LoadingStep message={loadingMessage} /> : null}

        {step === AppStep.Reviewing ? (
          <ReviewStep
            card={generatedCards[currentCardIndex]}
            totalCards={generatedCards.length}
            currentIndex={currentCardIndex}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            onManualUpdate={handleManualEdit}
            onAction={handleCardAction}
            onNavigate={setCurrentCardIndex}
            amendInstruction={amendInstruction}
            setAmendInstruction={setAmendInstruction}
            onAmend={handleAmend}
            isAmending={isAmending}
          />
        ) : null}

        {step === AppStep.Finalizing ? (
          <FinalizeStep
            cards={generatedCards}
            isConnected={isConnected}
            onReset={handleReset}
            onDownload={handleDownloadJson}
            onSync={handleSendToAnki}
            onConnect={() => setShowSettings(true)}
          />
        ) : null}

        {step === AppStep.Done ? <DoneStep deckName={selectedDeck} onReset={handleReset} /> : null}
      </main>
    </div>
  );
}

export default App;
