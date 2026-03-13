import React, { useEffect, useRef } from 'react';
import { ensureMathJaxReady } from '../services/mathjax';
import { Flashcard } from '../types';
import { sanitizeCardHtml } from '../utils/sanitizeHtml';

interface CardPreviewProps {
  card: Flashcard;
  isEditing: boolean;
  onUpdate: (field: keyof Flashcard, value: string) => void;
}

function renderCardPanel(
  card: Flashcard,
  isEditing: boolean,
  onUpdate: (field: keyof Flashcard, value: string) => void,
  config: {
    field: 'front' | 'back';
    label: string;
    containerClassName: string;
    headerColorClassName: string;
  },
): React.JSX.Element {
  const content = card[config.field];

  return (
    <div className={`flex flex-col h-full rounded-xl p-6 border shadow-sm overflow-hidden transition-colors ${config.containerClassName}`}>
      <div className={`text-xs font-bold uppercase tracking-wider mb-3 border-b border-slate-200/60 dark:border-slate-700 pb-2 ${config.headerColorClassName}`}>
        {config.label}
        {isEditing ? <span className="ml-2 opacity-50 normal-case font-normal text-slate-400">(Editing...)</span> : null}
      </div>

      {isEditing ? (
        <textarea
          value={content}
          onChange={(event) => onUpdate(config.field, event.target.value)}
          className="w-full h-full bg-transparent resize-none outline-none text-sm sm:text-base font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400"
          placeholder={`Enter ${config.label.toLowerCase()}...`}
        />
      ) : (
        <div
          className="prose prose-slate dark:prose-invert max-w-none flex-grow overflow-y-auto prose-p:my-1 prose-headings:my-2 text-sm sm:text-base"
          dangerouslySetInnerHTML={{
            __html: content ? sanitizeCardHtml(content) : '<span class="text-slate-300 dark:text-slate-600 italic">Empty</span>',
          }}
        />
      )}
    </div>
  );
}

export function CardPreview({ card, isEditing, onUpdate }: CardPreviewProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) {
      return;
    }

    let cancelled = false;

    async function typeset(): Promise<void> {
      try {
        await ensureMathJaxReady();

        if (cancelled || !containerRef.current || !window.MathJax?.typesetPromise) {
          return;
        }

        await window.MathJax.typesetPromise([containerRef.current]);
      } catch (error) {
        if (import.meta.env.DEV) {
          console.debug('MathJax error:', error);
        }
      }
    }

    typeset();

    const timers = [50, 200].map((delay) => window.setTimeout(typeset, delay));

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [card.back, card.front, isEditing]);

  return (
    <div ref={containerRef} className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-[400px]">
      <div className="h-full">
        {renderCardPanel(card, isEditing, onUpdate, {
          field: 'front',
          label: 'Front / Question',
          containerClassName: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800',
          headerColorClassName: 'text-indigo-600 dark:text-indigo-400',
        })}
      </div>

      <div className="h-full">
        {renderCardPanel(card, isEditing, onUpdate, {
          field: 'back',
          label: 'Back / Answer',
          containerClassName: 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800',
          headerColorClassName: 'text-emerald-600 dark:text-emerald-400',
        })}
      </div>
    </div>
  );
}
