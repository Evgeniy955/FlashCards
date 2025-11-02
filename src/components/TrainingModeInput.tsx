import React from 'react';
import { Check, ArrowRight, X } from 'lucide-react';

export type AnswerState = 'idle' | 'correct' | 'incorrect';

interface TrainingModeInputProps {
  answer: string;
  setAnswer: (value: string) => void;
  onCheck: () => void;
  onNext: () => void;
  answerState: AnswerState;
  placeholder: string;
}

export const TrainingModeInput: React.FC<TrainingModeInputProps> = ({ answer, setAnswer, onCheck, onNext, answerState, placeholder }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answerState === 'idle') {
      onCheck();
    } else {
      onNext();
    }
  };

  const stateStyles = {
    idle: 'border-slate-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-500',
    correct: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-emerald-500',
    incorrect: 'border-rose-500 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-rose-500',
  };

  const buttonStyles = {
    idle: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    correct: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    incorrect: 'bg-rose-600 hover:bg-rose-700 text-white',
  };

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col items-center gap-4">
      <div className="w-full relative">
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={placeholder}
          disabled={answerState !== 'idle'}
          className={`w-full p-3 text-center text-lg bg-white dark:bg-slate-800 rounded-lg border-2 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 disabled:opacity-70 ${stateStyles[answerState]}`}
          autoFocus
          autoComplete="off"
        />
        {answerState === 'correct' && <Check className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 dark:text-emerald-400" />}
        {answerState === 'incorrect' && <X className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 dark:text-rose-400" />}
      </div>
      
      {answerState === 'idle' ? (
        <button type="submit" className={`w-full py-3 text-lg font-semibold rounded-lg transition-colors ${buttonStyles.idle}`}>
          Check
        </button>
      ) : (
        <button type="submit" className={`w-full py-3 text-lg font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${buttonStyles[answerState === 'correct' ? 'correct' : 'incorrect']}`}>
          {answerState === 'correct' ? 'Correct!' : 'Next'} <ArrowRight />
        </button>
      )}
    </form>
  );
};