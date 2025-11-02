import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

export type GuessState = 'idle' | 'correct' | 'incorrect';

interface TrainingModeGuessProps {
  options: string[];
  correctAnswer: string;
  onGuess: (isCorrect: boolean) => void;
  onNext: () => void;
}

export const TrainingModeGuess: React.FC<TrainingModeGuessProps> = ({ options, correctAnswer, onGuess, onNext }) => {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [guessState, setGuessState] = useState<GuessState>('idle');

  // Reset state when options change (i.e., new word)
  useEffect(() => {
    setSelectedAnswer(null);
    setGuessState('idle');
  }, [options, correctAnswer]);

  const handleOptionClick = (option: string) => {
    if (guessState !== 'idle') return;

    const isCorrect = option === correctAnswer;
    setSelectedAnswer(option);
    setGuessState(isCorrect ? 'correct' : 'incorrect');
    onGuess(isCorrect);
  };

  const getButtonClass = (option: string) => {
    if (guessState === 'idle') {
      return 'bg-indigo-500 hover:bg-indigo-600 text-white dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-white';
    }
    // If an answer is selected, highlight correct and incorrect choices
    if (option === correctAnswer) {
      return 'bg-emerald-600 ring-2 ring-emerald-400 text-white';
    }
    if (option === selectedAnswer && option !== correctAnswer) {
      return 'bg-rose-600 ring-2 ring-rose-400 text-white';
    }
    // Fade out other options
    return 'bg-indigo-500 text-white opacity-50 dark:bg-slate-700 dark:opacity-50';
  };

  return (
      <div className="w-full flex flex-col items-center gap-4">
        <div className="w-full space-y-3">
          {options.map((option, index) => (
              <button
                  key={`${option}-${index}`}
                  onClick={() => handleOptionClick(option)}
                  disabled={guessState !== 'idle'}
                  className={`w-full p-3 text-lg font-semibold rounded-lg transition-all duration-300 ${getButtonClass(option)}`}
              >
                {option}
              </button>
          ))}
        </div>
        {guessState !== 'idle' && (
            <button
                onClick={onNext}
                className="w-full mt-2 py-3 text-lg font-semibold text-white rounded-lg transition-colors flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700"
            >
              Next <ArrowRight />
            </button>
        )}
      </div>
  );
};
