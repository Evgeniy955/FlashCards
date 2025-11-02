import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

interface TrainingModeGuessProps {
  options: string[];
  correctAnswer: string;
  onGuess: (isCorrect: boolean) => void;
  onNext: () => void;
}

export const TrainingModeGuess: React.FC<TrainingModeGuessProps> = ({ options, correctAnswer, onGuess, onNext }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  // Reset state when the correct answer changes (i.e., new word)
  useEffect(() => {
    setSelectedAnswer(null);
    setIsAnswered(false);
  }, [correctAnswer]);

  const handleOptionClick = (option: string) => {
    if (isAnswered) return;

    setSelectedAnswer(option);
    setIsAnswered(true);
    const isCorrect = option === correctAnswer;
    onGuess(isCorrect);
  };

  const getButtonClass = (option: string) => {
    if (!isAnswered) {
      return 'bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border-slate-300 dark:border-slate-600';
    }

    const isCorrect = option === correctAnswer;
    const isSelected = option === selectedAnswer;

    if (isCorrect) {
      return 'bg-emerald-500/20 dark:bg-emerald-500/30 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500';
    }
    if (isSelected && !isCorrect) {
      return 'bg-rose-500/20 dark:bg-rose-500/30 border-rose-500 text-rose-700 dark:text-rose-300';
    }
    
    return 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 opacity-60';
  };

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => handleOptionClick(option)}
            disabled={isAnswered}
            className={`w-full p-3 text-lg font-semibold rounded-lg border-2 transition-colors duration-200 disabled:cursor-not-allowed ${getButtonClass(option)}`}
          >
            {option}
          </button>
        ))}
      </div>
      
      {isAnswered && (
        <button 
          onClick={onNext} 
          className="w-full mt-2 py-3 text-lg font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          Next <ArrowRight />
        </button>
      )}
    </div>
  );
};
