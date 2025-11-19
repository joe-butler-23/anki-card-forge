import React, { useRef, useState } from 'react';
import { BrainCircuit, Layers, Wand2, XCircle, Paperclip, Sparkles, ArrowRight, Sun, Moon, Wifi, WifiOff, Settings, Edit, Save, X } from 'lucide-react';
import { Topic } from '../../types';
import { TOPIC_PROMPTS } from '../../prompts/topics';

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

export const SetupStep: React.FC<SetupStepProps> = ({
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
  onGenerate
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPromptEditorOpen, setIsPromptEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = (event) => {
          setSelectedImage(event.target?.result as string);
        };
        if (blob) reader.readAsDataURL(blob);
        return;
      }
    }
  };

  const handleSavePrompt = async (topic: Topic, newPrompt: string) => {
    try {
      if (window.electronAPI) {
        const success = await window.electronAPI.savePrompt(topic, newPrompt);
        if (success) {
          // Reload the prompts to get updated content
          window.location.reload();
        } else {
          throw new Error('Failed to save prompt');
        }
      } else {
        // Fallback for browser - use localStorage
        localStorage.setItem(`prompt_${topic}`, newPrompt);
        // Update the TOPIC_PROMPTS object in memory
        (TOPIC_PROMPTS as any)[topic] = newPrompt;
        alert('Prompt saved successfully (browser mode)');
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
      alert('Failed to save prompt. Please try again.');
    }
  };

  const renderConnectionBadge = () => (
    <div className="flex items-center gap-3">
      <button 
        onClick={() => setDarkMode(!darkMode)}
        className="p-2 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
          isConnected 
            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900' 
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
        }`}
      >
        {isConnected ? <Wifi size={12}/> : <WifiOff size={12}/>}
        {isConnected ? 'Connected' : 'Offline Mode'}
      </div>
      {!isConnected && (
        <button 
          onClick={onOpenSettings}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
        >
          <Settings size={12} /> Connect
        </button>
      )}
       {isConnected && (
        <button 
          onClick={onOpenSettings}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          title="Configure"
        >
          <Settings size={14} />
        </button>
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8">
      <header className="text-center space-y-2">
        <h1 className="text-m font-bold text-slate-900 dark:text-white tracking-tight">Anki Card Forge</h1>
        
        <div className="flex justify-center mt-4">
          {renderConnectionBadge()}
        </div>
      </header>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
        {/* Configuration Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Target Deck</label>
            <div className="relative">
              <Layers className="absolute left-3 top-3 text-slate-400" size={18} />
              <select 
                value={selectedDeck} 
                onChange={e => setSelectedDeck(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={!isConnected}
              >
                {decks.map(d => <option key={d} value={d}>{d}</option>)}
                {decks.length === 0 && <option>Default</option>}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Topic Model</label>
              <button
                onClick={() => {
                  setEditingPrompt(TOPIC_PROMPTS[selectedTopic]);
                  setIsPromptEditorOpen(true);
                }}
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
                onChange={e => setSelectedTopic(e.target.value as Topic)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none appearance-none transition-all"
              >
                {Object.values(Topic).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Inline Prompt Editor */}
        {isPromptEditorOpen && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Edit Prompt for {selectedTopic}</label>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await handleSavePrompt(selectedTopic, editingPrompt);
                    setIsPromptEditorOpen(false);
                  }}
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
              onChange={(e) => setEditingPrompt(e.target.value)}
              className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-sm font-mono"
              placeholder="Enter your custom prompt here..."
            />
          </div>
        )}
        
        {/* Unified Input Area */}
        <div className="space-y-2">
          
          <div className="relative w-full min-h-[240px] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all overflow-hidden flex flex-col">
            {/* Image Preview Area (if image exists) */}
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
              onChange={e => setNotes(e.target.value)}
              onPaste={handlePaste}
              className="w-full flex-grow p-4 bg-transparent outline-none resize-none text-slate-800 dark:text-slate-200 placeholder-slate-400"
            />

            {/* Action Bar in Input */}
            <div className="absolute bottom-3 right-3 flex gap-2">
               <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Attach Image File"
              >
                <Paperclip size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Thinking Toggle */}
        <div 
            onClick={() => setUseThinking(!useThinking)}
            className={`border rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all ${
              useThinking 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-500' 
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
        >
             <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  useThinking 
                    ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}>
                    <Sparkles size={18} />
                </div>
                <div>
                    <div className={`text-xs font-bold ${useThinking ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>Thinking Mode</div>
                </div>
             </div>
             <div className={`w-10 h-5 rounded-full relative transition-colors ${useThinking ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                 <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${useThinking ? 'translate-x-5' : ''}`} />
             </div>
        </div>

        <button
          onClick={onGenerate}
          disabled={(!notes.trim() && !selectedImage)}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          Generate Cards <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};
