
import React, { useState, useEffect } from 'react';
import { Settings, XCircle, AlertCircle, Copy, Loader2, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customUrl: string;
  setCustomUrl: (url: string) => void;
  hasGeminiApiKey: boolean;
  onSaveApiKey: (key: string) => Promise<boolean>;
  onClearApiKey: () => void;
  isCheckingApiKey: boolean;
  isChecking: boolean;
  onSave: (url?: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  customUrl,
  setCustomUrl,
  hasGeminiApiKey,
  onSaveApiKey,
  onClearApiKey,
  isCheckingApiKey,
  isChecking,
  onSave
}) => {
  // Local state for inputs - only save when user clicks "Save & Connect"
  const [localApiKey, setLocalApiKey] = useState('');
  const [localUrl, setLocalUrl] = useState(customUrl);

  // Sync local state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setLocalApiKey('');
      setLocalUrl(customUrl);
    }
  }, [isOpen, customUrl]);

  if (!isOpen) return null;

  const isHttps = window.location.protocol === 'https:';

  const handleSave = async () => {
    // Save API key and URL before connecting
    if (localApiKey.trim()) {
      const saved = await onSaveApiKey(localApiKey.trim());
      if (!saved) {
        alert('Unable to save API key. Please try again.');
        return;
      }
    }
    setCustomUrl(localUrl);
    onSave(localUrl);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
            <h3 className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Settings size={18} /> Connection Settings
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              <XCircle size={20}/>
            </button>
        </div>
        
        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Gemini API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                className="flex-grow px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder={hasGeminiApiKey ? "Leave blank to keep existing key" : "Enter your Gemini API Key"}
              />
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              {isCheckingApiKey ? 'Checking key status...' : (hasGeminiApiKey ? 'Key saved on this device.' : 'No key saved yet.')}
              {hasGeminiApiKey && (
                <button
                  type="button"
                  onClick={onClearApiKey}
                  className="text-red-600 dark:text-red-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">AnkiConnect URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                className="flex-grow px-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="http://127.0.0.1:8765"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              For security, the app only connects to AnkiConnect on localhost.
            </p>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <AlertCircle size={14} className="text-indigo-600 dark:text-indigo-400"/> Troubleshooting
            </p>
            <ul className="list-disc list-inside space-y-1.5 ml-1">
              <li>Ensure <strong>Anki</strong> is running.</li>
              <li>Ensure <strong>AnkiConnect</strong> add-on is installed (Code: 2055492159).</li>
              <li>
                Add this origin to <code className="font-mono bg-white dark:bg-slate-950 border dark:border-slate-700 px-1 rounded">webCorsOriginList</code> in AnkiConnect Config:
                <div className="mt-1.5 flex items-center gap-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-2 rounded-lg shadow-sm">
                  <code className="font-mono text-indigo-600 dark:text-indigo-400 flex-grow truncate select-all">{window.location.origin}</code>
                  <button 
                    onClick={() => navigator.clipboard.writeText(window.location.origin)}
                    className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 hover:bg-slate-50 dark:hover:bg-slate-900 rounded"
                    title="Copy to clipboard"
                  >
                    <Copy size={14}/>
                  </button>
                </div>
              </li>
              <li>Restart Anki to apply changes.</li>
            </ul>
            
            {isHttps && (
                <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-red-600 dark:text-red-400 font-medium">
                  Warning: You are on HTTPS. Browsers block HTTP connections to localhost. Use HTTP or allow "Insecure Content".
                </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
              <button 
                onClick={onClose}
                className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isChecking}
                className="flex-[2] py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 flex justify-center items-center gap-2"
              >
                {isChecking ? <Loader2 size={16} className="animate-spin"/> : <RefreshCw size={16}/>}
                Save & Connect
              </button>
          </div>
        </div>
      </div>
    </div>
  );
};
