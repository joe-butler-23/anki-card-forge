
import React, { useState, useEffect, useCallback } from 'react';
import { 
  AppStep, 
  Topic, 
  Flashcard 
} from './types';
import { 
  getDeckNames, 
  checkConnection, 
  pingAnki,
  addNotesToAnki,
  setAnkiUrl 
} from './services/ankiConnectService';
import { 
  generateFlashcards, 
  amendFlashcard 
} from './services/geminiService';
import { AlertCircle } from 'lucide-react';

// Components
import { Header } from './components/Header';
import { SettingsModal } from './components/SettingsModal';
import { SetupStep } from './components/steps/SetupStep';
import { LoadingStep } from './components/steps/LoadingStep';
import { ReviewStep } from './components/steps/ReviewStep';
import { FinalizeStep } from './components/steps/FinalizeStep';
import { DoneStep } from './components/steps/DoneStep';

const App: React.FC = () => {
  // --- State ---
  const [step, setStep] = useState<AppStep>(AppStep.Setup);
  const [decks, setDecks] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // Theme
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Generation Inputs
  const [notes, setNotes] = useState<string>('');
  const [selectedDeck, setSelectedDeck] = useState<string>('Default');
  const [selectedTopic, setSelectedTopic] = useState<Topic>(Topic.General);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [useThinking, setUseThinking] = useState<boolean>(false);

  // Connection Settings
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [customUrl, setCustomUrlState] = useState<string>('http://127.0.0.1:8765');
  const [geminiApiKey, setGeminiApiKeyState] = useState<string>(() => localStorage.getItem('geminiApiKey') || '');
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);

  // Card Management
  const [generatedCards, setGeneratedCards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState<number>(0);
  
  // Processing/Loading
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  
  // Editing/Amending
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [amendInstruction, setAmendInstruction] = useState<string>('');
  const [isAmending, setIsAmending] = useState<boolean>(false);

  // --- Effects ---

  // Dark Mode Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Ctrl+wheel zoom via Electron IPC
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const electronAPI = (window as any).electronAPI;
      if (electronAPI) {
        if (event.deltaY < 0) {
          electronAPI.zoomIn();
        } else {
          electronAPI.zoomOut();
        }
      }
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, []);

  const setGeminiApiKey = (key: string) => {
    setGeminiApiKeyState(key);
    localStorage.setItem('geminiApiKey', key);
  };
  
  // Initial silent check
  const initialCheck = useCallback(async () => {
    setIsCheckingConnection(true);
    try {
      const connected = await checkConnection();
      setIsConnected(connected);
      if (connected) {
        const deckList = await getDeckNames();
        setDecks(deckList);
        if (deckList.length > 0 && selectedDeck === 'Default') {
          setSelectedDeck(deckList[0]);
        }
        setError(null);
      }
    } catch (e) {
      // Silent fail on initial load
      setIsConnected(false);
    } finally {
      setIsCheckingConnection(false);
    }
  }, [selectedDeck]);

  useEffect(() => {
    initialCheck();
  }, []);

  // --- Handlers ---

  const handleRetryConnection = async () => {
    setIsCheckingConnection(true);
    setError(null);
    try {
      await pingAnki(); // This will throw if connection fails, revealing the error
      setIsConnected(true);
      const deckList = await getDeckNames();
      setDecks(deckList);
      if (deckList.length > 0) setSelectedDeck(deckList[0]);
      setShowSettings(false); // Close settings on success
    } catch (e: any) {
      setIsConnected(false);
      setError(e.message || "Failed to connect to Anki.");
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const handleUrlUpdate = async () => {
    setAnkiUrl(customUrl);
    await handleRetryConnection();
  };

  const handleGenerate = async () => {
    if (!notes.trim() && !selectedImage) {
      setError("Please enter notes or upload an image.");
      return;
    }
    setError(null);
    setStep(AppStep.Generating);
    
    if (useThinking) {
        setLoadingMessage("Deep thinking in progress...");
    } else {
        setLoadingMessage("Consulting the Neural Forge...");
    }

    try {
      const cards = await generateFlashcards(notes, selectedTopic, geminiApiKey, 'gemini-3-pro-preview', selectedImage, useThinking);
      
      if (cards.length === 0) {
        setError("AI returned no cards. Try adding more detail to your notes.");
        setStep(AppStep.Setup);
        return;
      }
      setGeneratedCards(cards);
      setCurrentCardIndex(0);
      setStep(AppStep.Reviewing);
    } catch (e) {
      console.error(e);
      setError("Generation failed. Please check your API Key and network.");
      setStep(AppStep.Setup);
    }
  };

  const handleCardAction = (action: 'accept' | 'reject') => {
    if (isEditing) setIsEditing(false); // Close edit mode if open

    if (action === 'reject') {
      const updated = [...generatedCards];
      updated[currentCardIndex].isDeleted = true;
      setGeneratedCards(updated);
    }
    
    if (currentCardIndex < generatedCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    } else {
      setStep(AppStep.Finalizing);
    }
  };

  const handleAmend = async () => {
    if (!amendInstruction.trim()) return;
    setIsAmending(true);
    try {
      const currentCard = generatedCards[currentCardIndex];
      const newCard = await amendFlashcard(currentCard, amendInstruction, selectedTopic, geminiApiKey, 'gemini-3-pro-preview');
      
      const updated = [...generatedCards];
      updated[currentCardIndex] = newCard;
      setGeneratedCards(updated);
      
      setAmendInstruction('');
    } catch (e) {
      setError("Failed to amend card.");
    } finally {
      setIsAmending(false);
    }
  };

  const handleManualEdit = (field: keyof Flashcard, value: string) => {
    const updated = [...generatedCards];
    updated[currentCardIndex] = {
      ...updated[currentCardIndex],
      [field]: value
    };
    setGeneratedCards(updated);
  };

  const handleSendToAnki = async () => {
    if (!isConnected) {
        setError("Anki is not connected. Please connect via Settings or download the JSON.");
        return;
    }

    setStep(AppStep.Sending);
    setLoadingMessage("Forging cards into Anki...");
    try {
      const addedIds = await addNotesToAnki(generatedCards, selectedDeck);
      console.log(`Added ${addedIds.length} cards`);
      setStep(AppStep.Done);
    } catch (e: any) {
      setError(e.message || "Failed to sync with Anki. Is the app open?");
      setStep(AppStep.Finalizing);
    }
  };

  const handleDownloadJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(generatedCards, null, 2));
    const anchor = document.createElement('a');
    anchor.href = dataStr;
    anchor.download = `anki_forge_export_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleReset = () => {
    setNotes('');
    setSelectedImage(null);
    setGeneratedCards([]);
    setStep(AppStep.Setup);
    setError(null);
  };

  const handleGoHome = () => {
    if (step === AppStep.Generating || step === AppStep.Sending) return;
    setStep(AppStep.Setup);
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12 font-sans transition-colors duration-300">
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        customUrl={customUrl}
        setCustomUrl={setCustomUrlState}
        geminiApiKey={geminiApiKey}
        setGeminiApiKey={setGeminiApiKey}
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
        {error && (
          <div className="max-w-2xl mx-auto mb-6 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-200 dark:border-red-900/50 flex items-start gap-3 animate-in slide-in-from-top-2">
            <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
            <span className="whitespace-pre-wrap text-sm">{error}</span>
            <button onClick={() => setError(null)} className="ml-auto font-bold hover:underline text-sm">Dismiss</button>
          </div>
        )}

        {step === AppStep.Setup && (
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
        )}

        {(step === AppStep.Generating || step === AppStep.Sending) && (
          <LoadingStep message={loadingMessage} />
        )}

        {step === AppStep.Reviewing && (
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
        )}

        {step === AppStep.Finalizing && (
          <FinalizeStep 
             cards={generatedCards}
             isConnected={isConnected}
             onReset={handleReset}
             onDownload={handleDownloadJson}
             onSync={handleSendToAnki}
             onConnect={() => setShowSettings(true)}
          />
        )}

        {step === AppStep.Done && (
          <DoneStep 
            deckName={selectedDeck}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
};

export default App;
