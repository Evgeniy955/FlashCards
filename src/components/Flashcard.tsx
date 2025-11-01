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
  lang1: string;
  lang2: string;
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, isFlipped, onFlip, exampleSentence, isChanging, isInstantChange, translationMode, lang1, lang2 }) => {
  
  const handlePlayAudioSequence = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card from flipping when clicking the button
    
    if (!('speechSynthesis' in window)) {
      alert('Sorry, your browser does not support text-to-speech.');
      return;
    }

    window.speechSynthesis.cancel(); // Stop any ongoing speech to prevent overlap

    // Always speak the English word (lang2)
    const wordToSpeak = word.lang2;
    const wordUtterance = new SpeechSynthesisUtterance(wordToSpeak);
    wordUtterance.lang = 'en-US';

    if (exampleSentence) {
      wordUtterance.onend = () => {
        setTimeout(() => {
          const sentenceUtterance = new SpeechSynthesisUtterance(exampleSentence);
          sentenceUtterance.lang = 'en-US';
          window.speechSynthesis.speak(sentenceUtterance);
        }, 500);
      };
    }

    window.speechSynthesis.speak(wordUtterance);
  };

  const handleFlipDuringChange = () => {
    if (!isChanging) {
      onFlip();
    }
  };

  const isStandardMode = translationMode === 'standard';
  const frontWord = isStandardMode ? word.lang1 : word.lang2;
  const backWord = isStandardMode ? word.lang2 : word.lang1;

  const frontContent = (
    <div 
        className={`absolute w-full h-full ${isStandardMode ? 'bg-slate-800' : 'bg-indigo-700'} rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center`}
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
    >
      <span className="text-4xl sm:text-5xl font-bold text-white">{frontWord}</span>
    </div>
  );

  const backContent = (
    <div 
        className={`absolute w-full h-full ${isStandardMode ? 'bg-indigo-700' : 'bg-slate-800'} rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center`}
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
    >
      <div>
        <span className="text-4xl sm:text-5xl font-bold text-white">{backWord}</span>
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
    <div 
        className="w-full aspect-[3/2] cursor-pointer group" 
        style={{ perspective: '1000px' }}
        onClick={handleFlipDuringChange}
        role="button"
        tabIndex={0}
        aria-label={`Flashcard for ${lang1} word ${word.lang1}. Click to flip.`}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleFlipDuringChange()}
    >
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
