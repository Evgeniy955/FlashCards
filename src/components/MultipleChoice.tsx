import React from 'react';
import type { Word } from '../types';

export type ChoiceState = 'idle' | 'correct' | 'incorrect';

interface MultipleChoiceProps {
  questionWord: Word;
  options: Word[];
  onSelectOption: (selectedWord: Word) => void;
  selectedOption: Word | null;
  correctOption: Word;
}

export const MultipleChoice: React.FC<MultipleChoiceProps> = ({
  options,
  onSelectOption,
  selectedOption,
  correctOption,
}) => {
  const getButtonClass = (option: Word) => {
    if (!selectedOption) {
      return 'bg-slate-700 hover:bg-slate-600';
    }
    if (option.en === correctOption.en) {
      return 'bg-emerald-600 ring-2 ring-emerald-400 scale-105';
    }
    if (option.en === selectedOption.en) {
      return 'bg-rose-600 ring-2 ring-rose-400';
    }
    return 'bg-slate-700 opacity-50';
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option.en}
            onClick={() => onSelectOption(option)}
            disabled={!!selectedOption}
            className={`p-4 rounded-lg text-white font-semibold transition-all duration-300 text-center ${getButtonClass(option)} disabled:cursor-not-allowed`}
          >
            {option.en}
          </button>
        ))}
      </div>
    </div>
  );
};
