import React from 'react';
import { Volume2, RefreshCw } from 'lucide-react';
import type { Word } from '../types';

interface FlashcardProps {
  word: Word;
  sentence: string | null;
  isFlipped: boolean;
  onFlip: () => void;
  onPronounce: () => void;
  isPronouncing: boolean;
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, sentence, isFlipped, onFlip, onPronounce, isPronouncing }) => {
  const frontContent = word.ru;
  const backContent = word.en;

  return (
    <div className="w-full max-w-lg mx-auto perspective-1000">
      <div
        className={`relative w-full h-64 md:h-80 transition-transform duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}
        onClick={onFlip}
        role="button"
        aria-label={`Flashcard: ${isFlipped ? backContent : frontContent}. Click to flip.`}
        tabIndex={0}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && onFlip()}
      >
        {/* Front of the card */}
        <div className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center p-6 bg-slate-800 border-2 border-slate-700 rounded-2xl shadow-2xl cursor-pointer">
          <p className="text-4xl md:text-5xl font-bold text-center text-white break-all">{frontContent}</p>
        </div>

        {/* Back of the card */}
        <div className="absolute w-full h-full backface-hidden flex flex-col items-center justify-center p-6 bg-slate-700 border-2 border-slate-600 rounded-2xl shadow-2xl cursor-pointer rotate-y-180">
          <div className="text-center">
            <p className="text-4xl md:text-5xl font-bold text-indigo-400 break-all">{backContent}</p>
            {sentence && (
              <p className="mt-4 text-sm md:text-base text-slate-300 italic">"{sentence}"</p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPronounce();
            }}
            disabled={isPronouncing}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            aria-label={`Pronounce "${backContent}"`}
          >
            {isPronouncing ? <RefreshCw className="animate-spin" /> : <Volume2 />}
          </button>
        </div>
      </div>
    </div>
  );
};
