import React, { useEffect, useRef } from 'react';
import { CardType, Flashcard } from '../types';

interface CardPreviewProps {
  card: Flashcard;
  isEditing: boolean;
  onUpdate: (field: keyof Flashcard, value: string) => void;
}

export const CardPreview: React.FC<CardPreviewProps> = ({ card, isEditing, onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Logic to determine what to show based on card type
  const frontContent = card.cardType === CardType.Cloze ? (card.cloze || card.front) : card.front;
  const backContent = card.cardType === CardType.Cloze 
    ? (card.back ? `<div class="mb-2 text-xs text-slate-400 dark:text-slate-500">Extra Info:</div>${card.back}` : card.cloze || card.front) 
    : card.back;

  // Effect to trigger MathJax typesetting when card content changes or when switching out of edit mode
  useEffect(() => {
    if (isEditing) return; // Don't render math while editing text

    if (typeof (window as any).MathJax !== 'undefined' && (window as any).MathJax.typesetPromise) {
      const typeset = () => {
        if (containerRef.current) {
           (window as any).MathJax.typesetPromise([containerRef.current])
            .catch((err: any) => console.debug('MathJax error:', err));
        }
      };
      
      // Immediate attempt
      typeset();
      
      // Retry to handle potential race conditions
      const timer1 = setTimeout(typeset, 50);
      const timer2 = setTimeout(typeset, 200);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [card.front, card.back, card.cloze, isEditing]); 
  
  const renderContent = (
    isFront: boolean,
    label: string, 
    content: string, 
    editField: keyof Flashcard,
    headerColorClass: string
  ) => (
    <div className={`flex flex-col h-full rounded-xl p-6 border shadow-sm overflow-hidden transition-colors ${
      isFront 
        ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' 
        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
    }`}>
      <div className={`text-xs font-bold uppercase tracking-wider mb-3 border-b border-slate-200/60 dark:border-slate-700 pb-2 ${headerColorClass}`}>
        {label} {isEditing && <span className="ml-2 opacity-50 normal-case font-normal text-slate-400">(Editing...)</span>}
      </div>
      
      {isEditing ? (
        <textarea
          value={card.cardType === CardType.Cloze && isFront ? (card.cloze || '') : (isFront ? card.front : card.back)}
          onChange={(e) => {
             const val = e.target.value;
             if (card.cardType === CardType.Cloze && isFront) {
                 onUpdate('cloze', val);
             } else {
                 onUpdate(editField, val);
             }
          }}
          className="w-full h-full bg-transparent resize-none outline-none text-sm sm:text-base font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400"
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      ) : (
        <div 
          className="prose prose-slate dark:prose-invert max-w-none flex-grow overflow-y-auto prose-p:my-1 prose-headings:my-2 text-sm sm:text-base"
          dangerouslySetInnerHTML={{ __html: content || '<span class="text-slate-300 dark:text-slate-600 italic">Empty</span>' }}
        />
      )}
    </div>
  );

  return (
    <div ref={containerRef} className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-[400px]">
      {/* Front Panel */}
      <div className="h-full">
         {renderContent(true, "Front / Question", frontContent, 'front', "text-indigo-600 dark:text-indigo-400")}
      </div>

      {/* Back Panel */}
      <div className="h-full">
         {renderContent(false, "Back / Answer", backContent, 'back', "text-emerald-600 dark:text-emerald-400")}
      </div>
    </div>
  );
};