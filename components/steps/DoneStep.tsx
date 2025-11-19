
import React from 'react';
import { CheckCircle2, RotateCw } from 'lucide-react';

interface DoneStepProps {
  deckName: string;
  onReset: () => void;
}

export const DoneStep: React.FC<DoneStepProps> = ({ deckName, onReset }) => {
  return (
    <div className="max-w-md mx-auto text-center space-y-8 py-12 animate-in zoom-in duration-500">
      <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 size={48} />
      </div>
      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Success!</h2>
        <p className="text-slate-500 dark:text-slate-400">Your new cards are waiting for you in the <strong>{deckName}</strong> deck.</p>
      </div>
      <button 
        onClick={onReset}
        className="px-8 py-3 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2 mx-auto"
      >
        <RotateCw size={18} /> Create More
      </button>
    </div>
  );
};
