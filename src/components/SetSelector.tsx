import React, { useMemo } from 'react';
import type { WordSet, WordProgress } from '../types';
import { getWordId } from '../utils/dictionaryUtils';

interface SetSelectorProps {
  sets: WordSet[];
  selectedSetIndex: number | null;
  onSelectSet: (index: number) => void;
  learnedWords: Map<string, WordProgress>;
}

export const SetSelector: React.FC<SetSelectorProps> = ({ sets, selectedSetIndex, onSelectSet, learnedWords }) => {
  if (sets.length <= 1) {
    return null; 
  }

  return (
    <div className="flex flex-wrap justify-center gap-3 mb-8 w-full px-2">
      {sets.map((set, index) => {
        const isSelected = selectedSetIndex === index;
        
        // Calculate Mastery
        const totalWords = set.words.length;
        const learnedCount = set.words.filter(w => learnedWords.has(getWordId(w))).length;
        const progressPercent = totalWords > 0 ? (learnedCount / totalWords) * 100 : 0;
        
        // Determine Status Color
        const isMastered = progressPercent === 100;
        
        // Dynamic styles
        let borderColor = 'border-slate-200 dark:border-slate-700';
        let textColor = 'text-slate-600 dark:text-slate-300';
        let progressColor = 'bg-indigo-500 dark:bg-indigo-400';
        
        if (isSelected) {
            borderColor = 'border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20';
            textColor = 'text-indigo-700 dark:text-white font-bold';
        } else if (isMastered) {
            borderColor = 'border-amber-400 dark:border-amber-500';
            textColor = 'text-amber-600 dark:text-amber-400 font-medium';
            progressColor = 'bg-amber-400 dark:bg-amber-500';
        }

        return (
          <button
            key={set.name}
            onClick={() => onSelectSet(index)}
            className={`relative group overflow-hidden flex flex-col items-center justify-center px-4 py-2.5 rounded-xl border-2 transition-all duration-200 ${borderColor} ${isSelected ? 'bg-white dark:bg-slate-800 shadow-md scale-105' : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'}`}
          >
            {/* Progress Bar Background */}
            <div 
                className={`absolute bottom-0 left-0 h-1 transition-all duration-500 ${progressColor}`}
                style={{ width: `${progressPercent}%` }}
            />
            
            <span className={`relative z-10 text-sm transition-colors ${textColor}`}>
                {set.name}
            </span>
            
            {/* Mini stats on hover or if selected */}
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                {learnedCount}/{totalWords}
            </span>
          </button>
        );
      })}
    </div>
  );
};