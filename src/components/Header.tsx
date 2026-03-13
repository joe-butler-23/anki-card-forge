import React from 'react';
import { Home } from 'lucide-react';
import { AppStep } from '../types';
import { ConnectionControls } from './ConnectionControls';

interface HeaderProps {
  step: AppStep;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  isConnected: boolean;
  onGoHome: () => void;
  onOpenSettings: () => void;
}

export function Header({
  step,
  darkMode,
  setDarkMode,
  isConnected,
  onGoHome,
  onOpenSettings,
}: HeaderProps): React.JSX.Element | null {
  if (step === AppStep.Setup) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 mb-8 flex justify-between items-center sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-4">
          <button 
            onClick={onGoHome} 
            className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
            title="Home / Reset"
          >
            <Home size={20} />
          </button>
          <div className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
            Anki Card Forge
          </div>
      </div>
      <div className="flex items-center gap-4">
        <ConnectionControls
          darkMode={darkMode}
          isConnected={isConnected}
          onOpenSettings={onOpenSettings}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
        />
        <div className="text-sm font-medium text-slate-400 capitalize border-l border-slate-200 dark:border-slate-800 pl-4">
          {step.replace('-', ' ')}
        </div>
      </div>
    </div>
  );
}
