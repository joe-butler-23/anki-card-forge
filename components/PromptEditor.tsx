import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Clock } from 'lucide-react';
import { Topic } from '../types';

// Type declaration for Electron API
declare global {
  interface Window {
    electronAPI?: {
      loadPromptBackups: (topic: Topic) => Promise<Array<{ timestamp: string; content: string }>>;
      savePrompt: (topic: Topic, content: string) => Promise<boolean>;
      refreshPromptOverrides: () => Promise<Record<string, string>>;
    };
    customPromptOverrides?: Record<string, string>;
  }
}

interface PromptEditorProps {
  isOpen: boolean;
  onClose: () => void;
  topic: Topic;
  currentPrompt: string;
  onSave: (topic: Topic, newPrompt: string) => Promise<boolean>;
}

interface BackupVersion {
  timestamp: string;
  content: string;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  isOpen,
  onClose,
  topic,
  currentPrompt,
  onSave
}) => {
  const [prompt, setPrompt] = useState(currentPrompt);
  const [backups, setBackups] = useState<BackupVersion[]>([]);
  const [showBackups, setShowBackups] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setPrompt(currentPrompt);
    loadBackups();
  }, [currentPrompt, topic]);

  const loadBackups = async () => {
    try {
      // In Electron, we'll use IPC to load backups
      if (window.electronAPI) {
        const backupList = await window.electronAPI.loadPromptBackups(topic);
        setBackups(backupList);
      }
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await onSave(topic, prompt);
      if (saved) {
        onClose();
      } else {
        alert('Unable to save prompt. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
      alert('Unable to save prompt. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreBackup = (backup: BackupVersion) => {
    setPrompt(backup.content);
    setShowBackups(false);
  };

  const handleReset = () => {
    // Reset to default prompt
    const defaultPrompts = {
      [Topic.General]: "Create concise cards. Break down complex lists into multiple cards.",
      [Topic.MathScience]: "Enforce MathJax syntax.\n- Inline math: \\( ... \\)\n- Display math: \\[ ... \\] or $$ ... $$\nEnsure variables are clearly defined.",
      [Topic.Vocabulary]: "You assist students with their study of vocabulary for the GRE.",
      [Topic.Programming]: "Enforce <pre><code>...</code></pre> for code blocks.\nUse a monospace font style for function names in text.\nFront: A coding concept or \"What is the output of...?\"\nBack: The explanation or code solution."
    };
    setPrompt(defaultPrompts[topic]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Edit Prompt: {topic}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Customize the prompt for {topic.toLowerCase()} cards
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 p-4 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setShowBackups(!showBackups)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Clock size={16} />
            Version History ({backups.length})
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RotateCcw size={16} />
            Reset to Default
          </button>
          <div className="ml-auto text-sm text-slate-500 dark:text-slate-400">
            {prompt.length} characters
          </div>
        </div>

        {/* Backups Panel */}
        {showBackups && (
          <div className="border-b border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-800/50">
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Previous Versions
            </h3>
            {backups.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No previous versions found</p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {backups.map((backup, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700"
                  >
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {new Date(backup.timestamp).toLocaleString()}
                    </div>
                    <button
                      onClick={() => handleRestoreBackup(backup)}
                      className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors"
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 p-6 overflow-hidden">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg resize-none font-mono text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            placeholder="Enter your prompt here..."
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || prompt.trim() === ''}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
