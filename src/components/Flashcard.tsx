import React from 'react';
import { Volume2 } from 'lucide-react';
import type { Word, TranslationMode } from '../types';

interface FlashcardProps {
  word: Word;
  isFlipped: boolean;
  onFlip: () => void;
  exampleSentence?: string;
  isChanging?: boolean;
  isInstantChange?: boolean;
  translationMode: TranslationMode;
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, isFlipped, onFlip, exampleSentence, isChanging, isInstantChange, translationMode }) => {
  
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

  const handleFlipDuringChange = () => {
    // Prevent card from flipping while the word is changing via Know/Don't Know buttons.
    if (!isChanging) {
      onFlip();
    }
  };

  const isStandardMode = translationMode === 'standard';

  const frontContent = (
    <div 
        className={`absolute w-full h-full ${isStandardMode ? 'bg-slate-800' : 'bg-indigo-700'} rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center`}
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
    >
      <span className="text-4xl sm:text-5xl font-bold text-white">{isStandardMode ? word.ru : word.en}</span>
    </div>
  );

  const backContent = (
    <div 
        className={`absolute w-full h-full ${isStandardMode ? 'bg-indigo-700' : 'bg-slate-800'} rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center`}
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
    >
      <div>
        <span className="text-4xl sm:text-5xl font-bold text-white">{isStandardMode ? word.en : word.ru}</span>
        {exampleSentence && (
          <p className={`${isStandardMode ? 'text-indigo-200' : 'text-slate-300'} mt-4 text-sm sm:text-base italic`}>"{exampleSentence}"</p>
        )}
      </div>
      <button
        onClick={handlePlayAudioSequence}
        className={`absolute top-4 right-4 p-2 ${isStandardMode ? 'text-indigo-200 hover:text-white hover:bg-indigo-600' : 'text-slate-300 hover:text-white hover:bg-slate-700'} transition-colors rounded-full`}
        aria-label="Play English pronunciation"
      >
        <Volume2 size={24} />
      </button>
    </div>
  );

  return (
    // The perspective container for the 3D effect
    <div 
        className="w-full aspect-[3/2] cursor-pointer group" 
        style={{ perspective: '1000px' }}
        onClick={handleFlipDuringChange}
        role="button"
        tabIndex={0}
        aria-label={`Flashcard for ${word.ru}. Click to flip.`}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleFlipDuringChange()}
    >
      {/* The inner container that flips */}
      <div 
        className={`relative w-full h-full ${!isInstantChange ? 'transition-transform duration-500' : ''}`}
        style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        {frontContent}
        {backContent}
      </div>
    </div>
  );
};
