import React from 'react';
import { Volume2, Check, Sparkles, Loader2, RefreshCw } from 'lucide-react';
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
    knowAttempts: number;
    totalAttempts: number;
    onGenerateContext?: () => void;
    isGeneratingContext?: boolean;
}

export const Flashcard: React.FC<FlashcardProps> = ({
                                                        word,
                                                        isFlipped,
                                                        onFlip,
                                                        exampleSentence,
                                                        isChanging,
                                                        isInstantChange,
                                                        translationMode,
                                                        lang1,
                                                        knowAttempts,
                                                        totalAttempts,
                                                        onGenerateContext,
                                                        isGeneratingContext
                                                    }) => {

    const handlePlayAudioSequence = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card from flipping when clicking the button

        if (!('speechSynthesis' in globalThis)) {
            alert('Sorry, your browser does not support text-to-speech.');
            return;
        }

        globalThis.speechSynthesis.cancel(); // Stop any ongoing speech to prevent overlap

        // Always speak the English word (lang2)
        const wordToSpeak = word.lang2;
        const wordUtterance = new SpeechSynthesisUtterance(wordToSpeak);
        wordUtterance.lang = 'en-US';

        if (exampleSentence) {
            wordUtterance.onend = () => {
                setTimeout(() => {
                    const sentenceUtterance = new SpeechSynthesisUtterance(exampleSentence);
                    sentenceUtterance.lang = 'en-US';
                    globalThis.speechSynthesis.speak(sentenceUtterance);
                }, 500);
            };
        }

        globalThis.speechSynthesis.speak(wordUtterance);
    };

    const handleGenerateClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onGenerateContext) {
            onGenerateContext();
        }
    };

    const handleFlipDuringChange = () => {
        if (isChanging) {
            return;
        }
        onFlip();
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
            {totalAttempts > 0 && (
                <div className={`absolute top-4 left-4 flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full ${isStandardMode ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-emerald-400/50 text-white'}`}>
                    <Check size={14} />
                    <span>{knowAttempts}/{totalAttempts}</span>
                </div>
            )}
            <span className={`${getFontSizeClass(frontWord)} font-bold ${isStandardMode ? 'text-slate-900 dark:text-white' : 'text-white'}`}>{frontWord}</span>
        </div>
    );

    const backContent = (
        <div
            className={`absolute w-full h-full ${isStandardMode ? 'bg-indigo-500 dark:bg-indigo-700' : 'bg-white dark:bg-slate-800'} rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center`}
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                    type="button"
                    onClick={handlePlayAudioSequence}
                    className={`p-2 ${isStandardMode ? 'text-indigo-100 dark:text-indigo-200 hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-600' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'} transition-colors rounded-full`}
                    aria-label="Play English pronunciation"
                >
                    <Volume2 size={24} />
                </button>
            </div>
            {totalAttempts > 0 && (
                <div className={`absolute top-4 left-4 flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full ${isStandardMode ? 'bg-emerald-400/50 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'}`}>
                    <Check size={14} />
                    <span>{knowAttempts}/{totalAttempts}</span>
                </div>
            )}
            <div className="flex flex-col items-center w-full">
                <span className={`${getFontSizeClass(backWord)} font-bold ${isStandardMode ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{backWord}</span>

                <div className="mt-4 flex flex-col items-center w-full px-4">
                    {exampleSentence ? (
                        <div className="flex flex-col items-center gap-2">
                            <p className={`${isStandardMode ? 'text-indigo-100 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-300'} text-sm sm:text-base italic max-w-xs mx-auto`}>
                                "{exampleSentence}"
                            </p>
                            {onGenerateContext && (
                                <button
                                    onClick={handleGenerateClick}
                                    disabled={isGeneratingContext}
                                    className={`p-1.5 rounded-full transition-all duration-300 opacity-60 hover:opacity-100 ${
                                        isStandardMode
                                            ? 'text-indigo-200 hover:bg-indigo-600 hover:text-white'
                                            : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-500 dark:hover:text-white'
                                    }`}
                                    title="Regenerate example with AI"
                                >
                                    {isGeneratingContext ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                </button>
                            )}
                        </div>
                    ) : (
                        onGenerateContext && (
                            <button
                                onClick={handleGenerateClick}
                                disabled={isGeneratingContext}
                                className={`mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
                                    isStandardMode
                                        ? 'bg-indigo-600/50 text-indigo-100 hover:bg-indigo-600 hover:text-white'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                } hover:scale-105 active:scale-95`}
                            >
                                {isGeneratingContext ? (
                                    <>
                                        <Loader2 size={12} className="animate-spin" /> Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={12} /> Magic Example
                                    </>
                                )}
                            </button>
                        )
                    )}
                </div>
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
