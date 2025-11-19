
import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStepProps {
  message: string;
}

export const LoadingStep: React.FC<LoadingStepProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full"></div>
        <Loader2 className="w-16 h-16 text-indigo-600 dark:text-indigo-400 animate-spin relative z-10" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{message}</h2>
      <p className="text-slate-500 dark:text-slate-400">This may take a moment, especially with Thinking Mode active.</p>
    </div>
  );
};
