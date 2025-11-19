
import React from 'react';
import { CheckCircle2, Trash2, Edit2, Wand2, Loader2 } from 'lucide-react';
import { Flashcard } from '../../types';
import { CardPreview } from '../CardPreview';

interface ReviewStepProps {
  card: Flashcard;
  totalCards: number;
  currentIndex: number;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  onManualUpdate: (field: keyof Flashcard, value: string) => void;
  onAction: (action: 'accept' | 'reject') => void;
  amendInstruction: string;
  setAmendInstruction: (val: string) => void;
  onAmend: () => void;
  isAmending: boolean;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({
  card,
  totalCards,
  currentIndex,
  isEditing,
  setIsEditing,
  onManualUpdate,
  onAction,
  amendInstruction,
  setAmendInstruction,
  onAmend,
  isAmending
}) => {
  const progress = ((currentIndex + 1) / totalCards) * 100;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in slide-in-from-right-8 duration-300">
      {/* Header / Progress */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">Reviewing Card {currentIndex + 1} / {totalCards}</h2>
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <span>Progress</span>
          <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Main: Card Preview (Split View) with Inline Editing */}
        <div className="lg:col-span-8 h-full flex flex-col gap-6">
          <div className="flex-grow">
              <CardPreview 
                card={card} 
                isEditing={isEditing}
                onUpdate={onManualUpdate}
              />
          </div>
        </div>

        {/* Right: Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Primary Actions */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-3">
            <button 
              onClick={() => onAction('accept')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-sm flex items-center justify-center gap-2 transition-all"
            >
              <CheckCircle2 size={18} /> Approve & Next
            </button>
            <button 
              onClick={() => onAction('reject')}
              className="w-full py-3 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 rounded-xl font-medium shadow-sm flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 size={18} /> Reject Card
            </button>
          </div>

          {/* Editing Tools */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4 flex-grow">
            <h3 className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-2">
              <Edit2 size={16} /> Refine
            </h3>
            
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all border ${
                isEditing 
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {isEditing ? 'Finish Editing' : 'Manual Edit'}
            </button>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">AI Amendment Instruction</label>
              <div className="flex items-center h-10">
                <input 
                  type="text" 
                  value={amendInstruction}
                  onChange={e => setAmendInstruction(e.target.value)}
                  placeholder="e.g., Make definitions shorter"
                  className="flex-1 h-full px-3 text-sm border border-r-0 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-l-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:z-10 placeholder-slate-400 dark:placeholder-slate-600"
                />
                <button 
                  onClick={onAmend}
                  disabled={isAmending || !amendInstruction}
                  className="w-10 h-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-r-lg hover:bg-indigo-200 dark:hover:bg-indigo-900 disabled:opacity-50 transition-colors focus:z-10"
                  title="Apply Amendment"
                >
                  {isAmending ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
