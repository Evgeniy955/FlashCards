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
  cardNumber: string;
}

export const Flashcard: React.FC<FlashcardProps> = ({ word, isFlipped, onFlip, exampleSentence, isChanging, isInstantChange, translationMode, lang1, lang2, cardNumber }) => {
  
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

  const getFontSizeClass = (text: string) => {
    const len = text.length;
    if (len > 25) {
      return 'text-2xl sm:text-3xl';
    }
    if (len > 15) {
      return 'text-3xl sm:text-4xl';
    }
    return 'text-4xl sm:text-5xl';
  };


  const frontContent = (
    <div 
        className={`absolute w-full h-full ${isStandardMode ? 'bg-white dark:bg-slate-800' : 'bg-indigo-500 dark:bg-indigo-700'} rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center`}
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
    >
      <span className={`absolute top-4 right-4 text-xs font-mono ${isStandardMode ? 'text-slate-400 dark:text-slate-500' : 'text-indigo-200 dark:text-indigo-300'}`}>{cardNumber}</span>
      <span className={`${getFontSizeClass(frontWord)} font-bold ${isStandardMode ? 'text-slate-900 dark:text-white' : 'text-white'}`}>{frontWord}</span>
    </div>
  );

  const backContent = (
    <div 
        className={`absolute w-full h-full ${isStandardMode ? 'bg-indigo-500 dark:bg-indigo-700' : 'bg-white dark:bg-slate-800'} rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center`}
        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <span className={`text-xs font-mono ${isStandardMode ? 'text-indigo-200 dark:text-indigo-300' : 'text-slate-400 dark:text-slate-500'}`}>{cardNumber}</span>
        <button
          onClick={handlePlayAudioSequence}
          className={`p-2 ${isStandardMode ? 'text-indigo-100 dark:text-indigo-200 hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-600' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'} transition-colors rounded-full`}
          aria-label="Play English pronunciation"
        >
          <Volume2 size={24} />
        </button>
      </div>
      <div>
        <span className={`${getFontSizeClass(backWord)} font-bold ${isStandardMode ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{backWord}</span>
        {exampleSentence && (
          <p className={`${isStandardMode ? 'text-indigo-100 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-300'} mt-4 text-sm sm:text-base italic`}>"{exampleSentence}"</p>
        )}
      </div>
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