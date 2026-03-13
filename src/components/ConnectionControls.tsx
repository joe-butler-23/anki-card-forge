import React from 'react';
import { Moon, Settings, Sun, Wifi, WifiOff } from 'lucide-react';

interface ConnectionControlsProps {
  darkMode: boolean;
  isConnected: boolean;
  onOpenSettings: () => void;
  onToggleDarkMode: () => void;
}

export function ConnectionControls({
  darkMode,
  isConnected,
  onOpenSettings,
  onToggleDarkMode,
}: ConnectionControlsProps): React.JSX.Element {
  const connectionClassName = isConnected
    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onToggleDarkMode}
        className="p-2 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div
        className={`hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${connectionClassName}`}
      >
        {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
        {isConnected ? 'Connected' : 'Offline Mode'}
      </div>

      <button
        onClick={onOpenSettings}
        className={
          isConnected
            ? 'text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            : 'text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1'
        }
        title={isConnected ? 'Configure' : undefined}
      >
        {isConnected ? (
          <Settings size={14} />
        ) : (
          <>
            <Settings size={12} /> Connect
          </>
        )}
      </button>
    </div>
  );
}
