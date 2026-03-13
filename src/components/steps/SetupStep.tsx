import React, { useRef, useState } from 'react';
import { ArrowRight, Edit, Layers, Paperclip, Save, Sparkles, Wand2, X, XCircle } from 'lucide-react';
import { DEFAULT_ANKI_DECK } from '../../constants';
import { Topic } from '../../types';
import { TOPIC_PROMPTS } from '../../prompts/topics';
import { ConnectionControls } from '../ConnectionControls';

interface SetupStepProps {
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  isConnected: boolean;
  onOpenSettings: () => void;
  decks: string[];
  selectedDeck: string;
  setSelectedDeck: (val: string) => void;
  selectedTopic: Topic;
  setSelectedTopic: (val: Topic) => void;
  notes: string;
  setNotes: (val: string) => void;
  selectedImage: string | null;
  setSelectedImage: (val: string | null) => void;
  useThinking: boolean;
  setUseThinking: (val: boolean) => void;
  onGenerate: () => void;
}

function readImageAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Unable to read image.'));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read image.'));
    };

    reader.readAsDataURL(file);
  });
}

export function SetupStep({
  darkMode,
  setDarkMode,
  isConnected,
  onOpenSettings,
  decks,
  selectedDeck,
  setSelectedDeck,
  selectedTopic,
  setSelectedTopic,
  notes,
  setNotes,
  selectedImage,
  setSelectedImage,
  useThinking,
  setUseThinking,
  onGenerate,
}: SetupStepProps): React.JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState('');

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setSelectedImage(await readImageAsDataUrl(file));
    } catch (error) {
      console.error('Failed to read uploaded image:', error);
    }
  }

  async function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>): Promise<void> {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith('image/'));
    const file = imageItem?.getAsFile();

    if (!file) {
      return;
    }

    event.preventDefault();

    try {
      setSelectedImage(await readImageAsDataUrl(file));
    } catch (error) {
      console.error('Failed to read pasted image:', error);
    }
  }

  async function handleSavePrompt(topic: Topic, newPrompt: string): Promise<boolean> {
    const savePrompt = window.electronAPI?.savePrompt;

    try {
      if (savePrompt) {
        const saved = await savePrompt(topic, newPrompt);

        if (!saved) {
          throw new Error('Prompt persistence failed');
        }
      } else {
        localStorage.setItem(`prompt_${topic}`, newPrompt);
      }

      TOPIC_PROMPTS[topic] = newPrompt;
      setEditingPrompt(newPrompt);
      alert('Prompt saved successfully');

      return true;
    } catch (error) {
      console.error('Failed to save prompt:', error);
      alert('Failed to save prompt. Please try again.');

      return false;
    }
  }

  function openPromptEditor(): void {
    setEditingPrompt(TOPIC_PROMPTS[selectedTopic]);
    setIsPromptEditorOpen(true);
  }

  async function saveAndClosePromptEditor(): Promise<void> {
    const saved = await handleSavePrompt(selectedTopic, editingPrompt);

    if (saved) {
      setIsPromptEditorOpen(false);
    }
  }

  function toggleDarkMode(): void {
    setDarkMode(!darkMode);
  }

  function toggleThinkingMode(): void {
    setUseThinking(!useThinking);
  }

  function openFilePicker(): void {
    fileInputRef.current?.click();
  }

  function handleTopicChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    setSelectedTopic(event.target.value as Topic);
  }

  function handleDeckChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    setSelectedDeck(event.target.value);
  }

  function handleNotesChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    setNotes(event.target.value);
  }

  function handlePromptChange(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    setEditingPrompt(event.target.value);
  }

  const canGenerate = Boolean(notes.trim() || selectedImage);
  const thinkingModeClassName = useThinking
    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
    : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50';
  const thinkingModeIconClassName = useThinking
    ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-500';
  const thinkingModeTextClassName = useThinking
    ? 'text-indigo-900 dark:text-indigo-300'
    : 'text-slate-700 dark:text-slate-300';
  const thinkingModeToggleClassName = useThinking ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600';
  const thinkingModeThumbClassName = useThinking ? 'translate-x-5' : '';

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8">
      <header className="text-center space-y-2">
        <h1 className="text-m font-bold text-slate-900 dark:text-white tracking-tight">Anki Card Forge</h1>

        <div className="flex justify-center mt-4">
          <ConnectionControls
            darkMode={darkMode}
            isConnected={isConnected}
            onOpenSettings={onOpenSettings}
            onToggleDarkMode={toggleDarkMode}
          />
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Target Deck</label>
            <div className="relative">
              <Layers className="absolute left-3 top-3 text-slate-400" size={18} />
              <select
                value={selectedDeck}
                onChange={handleDeckChange}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!isConnected}
              >
                {decks.length === 0 ? <option>{DEFAULT_ANKI_DECK}</option> : null}
                {decks.map((deck) => (
                  <option key={deck} value={deck}>
                    {deck}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Topic Model</label>
              <button
                onClick={openPromptEditor}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                title="Edit prompt"
              >
                <Edit size={14} />
                Edit
              </button>
            </div>
            <div className="relative">
              <Wand2 className="absolute left-3 top-3 text-slate-400" size={18} />
              <select
                value={selectedTopic}
                onChange={handleTopicChange}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none transition-all"
              >
                {Object.values(Topic).map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {isPromptEditorOpen && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Edit Prompt for {selectedTopic}</label>
              <div className="flex gap-2">
                <button
                  onClick={saveAndClosePromptEditor}
                  className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Save size={14} />
                  Save
                </button>
                <button
                  onClick={() => setIsPromptEditorOpen(false)}
                  className="flex items-center gap-1 text-xs bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <X size={14} />
                  Cancel
                </button>
              </div>
            </div>
            <textarea
              value={editingPrompt}
              onChange={handlePromptChange}
              className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-sm font-mono"
              placeholder="Enter your custom prompt here..."
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="relative w-full min-h-[240px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all overflow-hidden flex flex-col">
            {selectedImage && (
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 flex items-center gap-3 animate-in fade-in">
                <div className="relative group">
                  <img src={selectedImage} alt="Pasted" className="h-20 rounded-lg border border-slate-300 dark:border-slate-600 shadow-sm object-cover" />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  <p className="font-bold text-slate-700 dark:text-slate-200">Image attached</p>
                  <p>This image will be analyzed along with your notes.</p>
                </div>
              </div>
            )}

            <textarea
              value={notes}
              onChange={handleNotesChange}
              onPaste={handlePaste}
              className="w-full flex-grow p-4 bg-transparent outline-none resize-none text-slate-800 dark:text-slate-200 placeholder-slate-400"
            />

            <div className="absolute bottom-3 right-3 flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
              <button
                onClick={openFilePicker}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Attach Image File"
              >
                <Paperclip size={18} />
              </button>
            </div>
          </div>
        </div>

        <div onClick={toggleThinkingMode} className={`border rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all ${thinkingModeClassName}`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${thinkingModeIconClassName}`}>
              <Sparkles size={18} />
            </div>
            <div>
              <div className={`text-xs font-bold ${thinkingModeTextClassName}`}>Thinking Mode</div>
            </div>
          </div>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${thinkingModeToggleClassName}`}>
            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${thinkingModeThumbClassName}`} />
          </div>
        </div>

        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Generate Cards <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
