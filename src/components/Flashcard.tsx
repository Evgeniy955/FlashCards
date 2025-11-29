import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Check, Sparkles, Loader2, RefreshCw, AlertCircle, Settings, X } from 'lucide-react';
import type { Word, TranslationMode } from '../types';
import { Tooltip } from './Tooltip';

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
    generationError?: string | null;
    onSwipeLeft?: () => void; // Action for "Don't Know"
    onSwipeRight?: () => void; // Action for "Know"
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
                                                        isGeneratingContext,
                                                        generationError,
                                                        onSwipeLeft,
                                                        onSwipeRight
                                                    }) => {
    const [speechRate, setSpeechRate] = useState<number>(1);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
    const [showSettings, setShowSettings] = useState(false);

    // Swipe Logic States
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // Load voices on mount
    useEffect(() => {
        const loadVoices = () => {
            if (!('speechSynthesis' in globalThis)) return;

            const allVoices = globalThis.speechSynthesis.getVoices();
            // Filter primarily for English voices, but keep others just in case
            const sortedVoices = allVoices.sort((a, b) => {
                // Prioritize English
                if (a.lang.startsWith('en') && !b.lang.startsWith('en')) return -1;
                if (!a.lang.startsWith('en') && b.lang.startsWith('en')) return 1;
                return a.name.localeCompare(b.name);
            });

            setVoices(sortedVoices);

            // Auto-select a default English voice if none selected
            if (!selectedVoiceURI && sortedVoices.length > 0) {
                const preferred = sortedVoices.find(v => v.lang.startsWith('en-US') && !v.name.includes('Google'))
                    || sortedVoices.find(v => v.lang.startsWith('en'))
                    || sortedVoices[0];
                setSelectedVoiceURI(preferred.voiceURI);
            }
        };

        loadVoices();
        if ('speechSynthesis' in globalThis) {
            globalThis.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, [selectedVoiceURI]);

    // Reset drag state when word changes
    useEffect(() => {
        setDragOffset({ x: 0, y: 0 });
        setIsDragging(false);
        // Close settings when card changes
        setShowSettings(false);
    }, [word]);

    const handlePlayAudioSequence = (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!('speechSynthesis' in globalThis)) {
            alert('Sorry, your browser does not support text-to-speech.');
            return;
        }

        globalThis.speechSynthesis.cancel();

        const wordToSpeak = word.lang2;
        const wordUtterance = new SpeechSynthesisUtterance(wordToSpeak);
        wordUtterance.lang = 'en-US';
        wordUtterance.rate = speechRate;

        // Set specific voice if selected
        const voice = voices.find(v => v.voiceURI === selectedVoiceURI);
        if (voice) wordUtterance.voice = voice;

        if (exampleSentence) {
            wordUtterance.onend = () => {
                setTimeout(() => {
                    // Strip out markdown/emoji for cleaner speech if needed, or rely on browser smarts.
                    // Simple cleanup: remove lines starting with emoji
                    const cleanText = exampleSentence.replace(/[*📖🔗✍️]/g, '');

                    const sentenceUtterance = new SpeechSynthesisUtterance(cleanText);
                    sentenceUtterance.lang = 'en-US';
                    sentenceUtterance.rate = speechRate;
                    if (voice) sentenceUtterance.voice = voice;
                    globalThis.speechSynthesis.speak(sentenceUtterance);
                }, 300);
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

    const toggleSettings = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowSettings(prev => !prev);
    }

    // --- Touch / Swipe Handlers ---

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        // Don't trigger swipe on button clicks or inputs
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('select')) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        setDragStart({ x: clientX, y: clientY });
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging || !dragStart) return;

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - dragStart.x;
        const deltaY = clientY - dragStart.y;

        // Only move if it looks like a horizontal swipe
        if (Math.abs(deltaX) > 10) {
            setDragOffset({ x: deltaX, y: deltaY * 0.3 }); // Dampen Y movement
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;

        const threshold = 100; // px to trigger action
        if (dragOffset.x > threshold && onSwipeRight) {
            onSwipeRight(); // Swipe Right -> Know
        } else if (dragOffset.x < -threshold && onSwipeLeft) {
            onSwipeLeft(); // Swipe Left -> Don't Know
        }

        // Reset
        setIsDragging(false);
        setDragStart(null);
        setDragOffset({ x: 0, y: 0 });
    };

    // Prevent clicking to flip if we were dragging or in settings mode
    const handleFlipDuringChange = (e: React.MouseEvent) => {
        // If interacting with settings, don't flip
        if (showSettings) return;

        if (isChanging || Math.abs(dragOffset.x) > 5) {
            return;
        }
        onFlip();
    };

    const isStandardMode = translationMode === 'standard';
    const frontWord = isStandardMode ? word.lang1 : word.lang2;
    const backWord = isStandardMode ? word.lang2 : word.lang1;

    const getFontSizeClass = (text: string) => {
        const len = text.length;
        if (len > 25) return 'text-2xl sm:text-3xl';
        if (len > 15) return 'text-3xl sm:text-4xl';
        return 'text-4xl sm:text-5xl';
    };

    // Dynamic style for dragging
    const cardStyle = {
        perspective: '1000px',
        transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${dragOffset.x * 0.05}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s',
        opacity: isChanging ? 0 : 1 - Math.abs(dragOffset.x) / 500 // Fade out slightly on far drags
    };

    // Overlay for swipe feedback
    const swipeOverlay = (
        <>
            <div
                className="absolute inset-0 bg-emerald-500 z-20 rounded-2xl flex items-center justify-center transition-opacity pointer-events-none"
                style={{ opacity: dragOffset.x > 50 ? Math.min(dragOffset.x / 200, 0.4) : 0 }}
            >
                <Check className="text-white w-24 h-24" />
            </div>
            <div
                className="absolute inset-0 bg-rose-500 z-20 rounded-2xl flex items-center justify-center transition-opacity pointer-events-none"
                style={{ opacity: dragOffset.x < -50 ? Math.min(Math.abs(dragOffset.x) / 200, 0.4) : 0 }}
            >
                <div className="text-white font-bold text-4xl">Don't Know</div>
            </div>
        </>
    );

    const frontContent = (
        <div
            className={`absolute w-full h-full ${isStandardMode ? 'bg-white dark:bg-slate-800' : 'bg-indigo-500 dark:bg-indigo-700'} rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center overflow-hidden`}
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
            {swipeOverlay}
            {totalAttempts > 0 && (
                <div className={`absolute top-4 left-4 flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full ${isStandardMode ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-emerald-400/50 text-white'}`}>
                    <Check size={14} />
                    <span>{knowAttempts}/{totalAttempts}</span>
                </div>
            )}
            <span className={`${getFontSizeClass(frontWord)} font-bold ${isStandardMode ? 'text-slate-900 dark:text-white' : 'text-white'}`}>{frontWord}</span>
        </div>
    );

    // Settings Overlay Content
    const settingsContent = (
        <div className="flex flex-col items-center w-full h-full justify-center p-4 animate-fade-in">
            <h3 className={`text-lg font-semibold mb-4 ${isStandardMode ? 'text-white' : 'text-slate-800 dark:text-white'}`}>Voice Settings</h3>

            <div className="w-full max-w-xs space-y-4">
                <div>
                    <label className={`block text-xs mb-1 ${isStandardMode ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>Voice</label>
                    <select
                        value={selectedVoiceURI}
                        onChange={(e) => setSelectedVoiceURI(e.target.value)}
                        className="w-full p-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {voices.map(v => (
                            <option key={v.voiceURI} value={v.voiceURI}>
                                {v.name.length > 30 ? v.name.substring(0, 30) + '...' : v.name} ({v.lang})
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={`block text-xs mb-1 ${isStandardMode ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'}`}>Speed: {speechRate}x</label>
                    <div className="flex items-center justify-between bg-black/10 dark:bg-white/10 rounded-full p-1">
                        {[0.6, 0.8, 1, 1.2].map(rate => (
                            <button
                                key={rate}
                                onClick={(e) => { e.stopPropagation(); setSpeechRate(rate); }}
                                className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${speechRate === rate ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-300 hover:text-white'}`}
                            >
                                {rate}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <button
                onClick={(e) => { e.stopPropagation(); setShowSettings(false); }}
                className="mt-6 p-2 rounded-full bg-black/20 hover:bg-black/30 text-white transition-colors"
            >
                <Check size={20} />
            </button>
        </div>
    );

    const backContent = (
        <div
            className={`absolute w-full h-full ${isStandardMode ? 'bg-indigo-500 dark:bg-indigo-700' : 'bg-white dark:bg-slate-800'} rounded-2xl shadow-xl flex flex-col justify-center items-center p-6 text-center overflow-hidden`}
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
            {swipeOverlay}

            <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
                <Tooltip content="Voice Settings" position="left">
                    <button
                        type="button"
                        onClick={toggleSettings}
                        className={`p-2 transition-colors rounded-full ${isStandardMode ? 'text-indigo-200 hover:text-white hover:bg-indigo-600' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
                    >
                        {showSettings ? <X size={20} /> : <Settings size={20} />}
                    </button>
                </Tooltip>

                {!showSettings && (
                    <Tooltip content="Listen" position="bottom">
                        <button
                            type="button"
                            onClick={handlePlayAudioSequence}
                            className={`p-2 ${isStandardMode ? 'text-indigo-100 dark:text-indigo-200 hover:text-white hover:bg-indigo-600 dark:hover:bg-indigo-600' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'} transition-colors rounded-full`}
                            aria-label="Play English pronunciation"
                        >
                            <Volume2 size={24} />
                        </button>
                    </Tooltip>
                )}
            </div>

            {totalAttempts > 0 && !showSettings && (
                <div className={`absolute top-4 left-4 flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full ${isStandardMode ? 'bg-emerald-400/50 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'}`}>
                    <Check size={14} />
                    <span>{knowAttempts}/{totalAttempts}</span>
                </div>
            )}

            {showSettings ? settingsContent : (
                <div className="flex flex-col items-center w-full">
                    <span className={`${getFontSizeClass(backWord)} font-bold ${isStandardMode ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{backWord}</span>

                    <div className="mt-4 flex flex-col items-center w-full px-4">
                        {exampleSentence ? (
                            <div className="flex flex-col items-center gap-2">
                                <div className={`text-left w-full max-h-[120px] overflow-y-auto scrollbar-thin ${isStandardMode ? 'text-indigo-100 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-300'} text-sm whitespace-pre-line`}>
                                    {exampleSentence}
                                </div>
                                {onGenerateContext && (
                                    <Tooltip content="Regenerate with AI" position="bottom">
                                        <button
                                            onClick={handleGenerateClick}
                                            disabled={isGeneratingContext}
                                            className={`p-1.5 rounded-full transition-all duration-300 opacity-60 hover:opacity-100 ${
                                                isStandardMode
                                                    ? 'text-indigo-200 hover:bg-indigo-600 hover:text-white'
                                                    : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 dark:text-slate-500 dark:hover:text-white'
                                            }`}
                                        >
                                            {isGeneratingContext ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        </button>
                                    </Tooltip>
                                )}
                            </div>
                        ) : (
                            onGenerateContext && (
                                <Tooltip content="Generate example sentence using AI" position="bottom">
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
                                </Tooltip>
                            )
                        )}

                        {generationError && (
                            <div className="mt-4 flex items-start justify-center gap-2 text-xs text-rose-500 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30 px-3 py-2 rounded-lg w-full text-center leading-normal whitespace-normal">
                                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                <span>{generationError}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div
            ref={cardRef}
            className="w-full aspect-[3/2] cursor-pointer group touch-none select-none"
            style={cardStyle}
            onClick={handleFlipDuringChange}
            onMouseDown={handleTouchStart}
            onMouseMove={handleTouchMove}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            role="button"
            tabIndex={0}
            aria-label={`Flashcard for ${lang1} word ${word.lang1}. Drag right for Know, Left for Don't Know.`}
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
