import React from 'react';
import { Volume2 } from 'lucide-react';
import type { Word } from '../types';

interface FlashcardProps {
  word: Word;
  isFlipped: boolean;
  onFlip: () => void;
  exampleSentence?: string;
  isTransitioning?: boolean;
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, isFlipped, onFlip, exampleSentence, isTransitioning }) => {
  
  const handlePlayAudioSequence = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card from flipping when clicking the button
    
    if (!('speechSynthesis' in window)) {
      alert('Sorry, your browser does not support text-to-speech.');
      return;
    }

    window.speechSynthesis.cancel(); // Stop any ongoing speech to prevent overlap

    // 1. Create utterance for the word
    const wordUtterance = new SpeechSynthesisUtterance(word.en);
    wordUtterance.lang = 'en-US';

    // 2. If an example sentence exists, queue it to play after the word
    if (exampleSentence) {
      wordUtterance.onend = () => {
        // Use setTimeout to create a pause. Reduced from 1000ms to 500ms as requested.
        setTimeout(() => {
          const sentenceUtterance = new SpeechSynthesisUtterance(exampleSentence);
          sentenceUtterance.lang = 'en-US';
          window.speechSynthesis.speak(sentenceUtterance);
        }, 500); // 500ms = 0.5s
      };
    }

    // 3. Start speaking the word
    window.speechSynthesis.speak(wordUtterance);
  };

  const handleFlipWithTransitionCheck = () => {
    // Prevent card from flipping while the "Know" button transition is active.
    if (!isTransitioning) {
      onFlip();
    }
  };

  return (
    // The perspective container for the 3D effect
    <div 
        className="w-full aspect-[3/2] cursor-pointer group" 
        style={{ perspective: '1000px' }}
        onClick={handleFlipWithTransitionCheck}
        role="button"
        tabIndex={0}
        aria-label={`Flashcard for ${word.ru}. Click to flip.`}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleFlipWithTransitionCheck()}
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
          {/* Russian audio button has been removed as requested */}
        </div>

        {/* Back of the card (English) */}
        <div 
            className="absolute w-full h-full bg-indigo-700 rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center"
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* The CSS transition for blur has been removed to make it appear instantly. */}
          <div className={isTransitioning ? 'blur-md' : ''}>
            <span className="text-4xl sm:text-5xl font-bold text-white">{word.en}</span>
            {exampleSentence && (
              <p className="text-indigo-200 mt-4 text-sm sm:text-base italic">"{exampleSentence}"</p>
            )}
          </div>
          <button
            onClick={handlePlayAudioSequence}
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