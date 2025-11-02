import React from 'react';
import { Edit, ListChecks } from 'lucide-react';

type TrainingMode = 'write' | 'guess';

interface TrainingModeToggleProps {
  mode: TrainingMode;
  onModeChange: (mode: TrainingMode) => void;
}

export const TrainingModeToggle: React.FC<TrainingModeToggleProps> = ({ mode, onModeChange }) => {
  return (
    <div className="flex items-center justify-center p-1 bg-slate-200 dark:bg-slate-800 rounded-lg">
      <button
        onClick={() => onModeChange('write')}
        aria-pressed={mode === 'write'}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
          mode === 'write' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        <Edit size={14} /> Write
      </button>
      <button
        onClick={() => onModeChange('guess')}
        aria-pressed={mode === 'guess'}
        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
          mode === 'guess' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700'
        }`}
      >
        <ListChecks size={14} /> Guess
      </button>
    </div>
  );
};