
import React from 'react';
import { Download, Send, Settings } from 'lucide-react';
import { Flashcard, CardType } from '../../types';

interface FinalizeStepProps {
  cards: Flashcard[];
  isConnected: boolean;
  onReset: () => void;
  onDownload: () => void;
  onSync: () => void;
  onConnect: () => void;
}

export const FinalizeStep: React.FC<FinalizeStepProps> = ({
  cards,
  isConnected,
  onReset,
  onDownload,
  onSync,
  onConnect
}) => {
  const validCards = cards.filter(c => !c.isDeleted);

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Ready to Sync</h2>
        <p className="text-slate-500 dark:text-slate-400">You have forged <span className="font-bold text-indigo-600 dark:text-indigo-400">{validCards.length}</span> cards.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="max-h-[50vh] overflow-y-auto">
          {validCards.map((card, i) => (
            <div key={card.id} className="p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <span className="text-xs font-bold text-slate-300 dark:text-slate-600 mt-1">#{i + 1}</span>
              <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold">Front</span>
                  <div className="text-sm text-slate-800 dark:text-slate-200 line-clamp-2" dangerouslySetInnerHTML={{ __html: card.cardType === CardType.Cloze ? (card.cloze || '') : card.front }} />
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-400 dark:text-slate-500 font-bold">Back</span>
                  <div className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2" dangerouslySetInnerHTML={{ __html: card.back }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <button 
          onClick={onReset}
          className="flex-1 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
        >
          Discard
        </button>
        
        <button 
           onClick={onDownload}
           className="flex-1 py-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all flex items-center justify-center gap-2"
        >
          <Download size={20} /> Download JSON
        </button>

        <button 
          onClick={onSync}
          disabled={!isConnected}
          className="flex-[2] py-4 bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
        >
          <Send size={20} /> Sync to Anki
        </button>
      </div>
      {!isConnected && (
          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            Anki is disconnected. <button onClick={onConnect} className="text-indigo-600 dark:text-indigo-400 underline font-semibold">Connect</button> to sync or download JSON.
          </div>
      )}
    </div>
  );
};
