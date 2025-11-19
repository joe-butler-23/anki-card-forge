
import React from 'react';
import { Home, BrainCircuit, Sun, Moon, Wifi, WifiOff, Settings } from 'lucide-react';
import { AppStep } from '../types';

interface HeaderProps {
  step: AppStep;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  isConnected: boolean;
  onGoHome: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  step, 
  darkMode, 
  setDarkMode, 
  isConnected, 
  onGoHome, 
  onOpenSettings 
}) => {
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
           {isConnected && (
            <button 
              onClick={onOpenSettings}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              title="Configure"
            >
              <Settings size={14} />
            </button>
          )}
           {!isConnected && (
            <button 
              onClick={onOpenSettings}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Settings size={12} /> Connect
            </button>
          )}
        </div>
         <div className="text-sm font-medium text-slate-400 capitalize border-l border-slate-200 dark:border-slate-800 pl-4">
            {step.replace('-', ' ')}
         </div>
      </div>
    </div>
  );
};
