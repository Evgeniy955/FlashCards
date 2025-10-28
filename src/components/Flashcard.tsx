import React from 'react';
import { Volume2 } from 'lucide-react';
import type { Word } from '../types';

interface FlashcardProps {
  word: Word;
  isFlipped: boolean;
  onFlip: () => void;
  exampleSentence?: string;
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, isFlipped, onFlip, exampleSentence }) => {
  
  const handlePlayAudio = (e: React.MouseEvent, text: string, lang: string) => {
    e.stopPropagation(); // Prevent card from flipping when clicking the button
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      // Cancel any ongoing speech to prevent overlap
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Sorry, your browser does not support text-to-speech.');
    }
  };

  return (
    // The perspective container for the 3D effect
    <div 
        className="w-full aspect-[3/2] cursor-pointer group" 
        style={{ perspective: '1000px' }}
        onClick={onFlip}
        role="button"
        tabIndex={0}
        aria-label={`Flashcard for ${word.ru}. Click to flip.`}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onFlip()}
    >
      {/* The inner container that flips */}
      <div 
        className="relative w-full h-full transition-transform duration-500"
        style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {/* Front of the card (Russian) */}
        <div 
            className="absolute w-full h-full bg-slate-800 rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          <span className="text-4xl sm:text-5xl font-bold text-white">{word.ru}</span>
          <button
            onClick={(e) => handlePlayAudio(e, word.ru, 'ru-RU')}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors rounded-full hover:bg-slate-700"
            aria-label="Play Russian pronunciation"
          >
            <Volume2 size={24} />
          </button>
        </div>

        {/* Back of the card (English) */}
        <div 
            className="absolute w-full h-full bg-indigo-700 rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div>
            <span className="text-4xl sm:text-5xl font-bold text-white">{word.en}</span>
            {exampleSentence && (
              <p className="text-indigo-200 mt-4 text-sm sm:text-base italic">"{exampleSentence}"</p>
            )}
          </div>
          <button
            onClick={(e) => handlePlayAudio(e, word.en, 'en-US')}
            className="absolute top-4 right-4 p-2 text-indigo-200 hover:text-white transition-colors rounded-full hover:bg-indigo-600"
            aria-label="Play English pronunciation"
          >
            <Volume2 size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
