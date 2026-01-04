
import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Check, Sparkles, Loader2, RefreshCw, AlertCircle, Settings, X, Maximize2 } from 'lucide-react';
import type { Word, TranslationMode } from '../types';
import { Tooltip } from './Tooltip';
import { createPortal } from 'react-dom';

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
    const [isExpanded, setIsExpanded] = useState(false);
    const [hasOverflow, setHasOverflow] = useState(false);

    const textRef = useRef<HTMLDivElement>(null);
    const innerContentRef = useRef<HTMLDivElement>(null);

    // Swipe Logic States
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // Check for overflow when card is flipped or content changes
    useEffect(() => {
        const checkOverflow = () => {
            if (innerContentRef.current && textRef.current) {
                const overflow = innerContentRef.current.scrollHeight > textRef.current.clientHeight;
                setHasOverflow(overflow);
            }
        };

        if (isFlipped) {
            const timeout = setTimeout(checkOverflow, 150);
            return () => clearTimeout(timeout);
        }
    }, [exampleSentence, isFlipped]);

    // Initial setup: Load saved preferences
    useEffect(() => {
        const savedRate = localStorage.getItem('fwt_speech_rate');
        if (savedRate) setSpeechRate(parseFloat(savedRate));
        const savedVoice = localStorage.getItem('fwt_voice_uri');
        if (savedVoice) setSelectedVoiceURI(savedVoice);
    }, []);

    // Load voices
    useEffect(() => {
        const loadVoices = () => {
            if (!('speechSynthesis' in globalThis)) return;
            let allVoices = globalThis.speechSynthesis.getVoices();
            if (allVoices.length === 0) {
                setTimeout(loadVoices, 100);
                return;
            }
            const sortedVoices = allVoices.sort((a, b) => {
                const aEn = a.lang.startsWith('en');
                const bEn = b.lang.startsWith('en');
                if (aEn && !bEn) return -1;
                if (!aEn && bEn) return 1;
                return a.name.localeCompare(b.name);
            });
            setVoices(sortedVoices);
            const savedVoice = localStorage.getItem('fwt_voice_uri');
            if (savedVoice && sortedVoices.some(v => v.voiceURI === savedVoice)) {
                setSelectedVoiceURI(savedVoice);
            } else if (!selectedVoiceURI && sortedVoices.length > 0) {
                const preferred = sortedVoices.find(v => v.lang === 'en-US') || sortedVoices.find(v => v.lang.startsWith('en')) || sortedVoices[0];
                if (preferred) setSelectedVoiceURI(preferred.voiceURI);
            }
        };
        loadVoices();
        if ('speechSynthesis' in globalThis) globalThis.speechSynthesis.onvoiceschanged = loadVoices;
        return () => { if ('speechSynthesis' in globalThis) globalThis.speechSynthesis.onvoiceschanged = null; };
    }, []);

    const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const uri = e.target.value;
        setSelectedVoiceURI(uri);
        localStorage.setItem('fwt_voice_uri', uri);
    };

    const handleRateChange = (rate: number) => {
        setSpeechRate(rate);
        localStorage.setItem('fwt_speech_rate', rate.toString());
    }

    // Reset states when word changes
    useEffect(() => {
        setDragOffset({ x: 0, y: 0 });
        setIsDragging(false);
        setShowSettings(false);
        setIsExpanded(false);
        setHasOverflow(false);
    }, [word]);

    const handlePlayAudioSequence = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!('speechSynthesis' in globalThis)) return;
        globalThis.speechSynthesis.cancel();
        const currentVoices = globalThis.speechSynthesis.getVoices();
        const voice = currentVoices.find(v => v.voiceURI === selectedVoiceURI) || currentVoices.find(v => v.lang.startsWith('en'));
        const wordUtterance = new SpeechSynthesisUtterance(word.lang2);
        if (voice) { wordUtterance.voice = voice; wordUtterance.lang = voice.lang; }
        wordUtterance.rate = speechRate;
        if (exampleSentence) {
            wordUtterance.onend = () => {
                setTimeout(() => {
                    const sentenceUtterance = new SpeechSynthesisUtterance(exampleSentence.replace(/[*📖🔗✍️]/g, ''));
                    if (voice) { sentenceUtterance.voice = voice; sentenceUtterance.lang = voice.lang; }
                    sentenceUtterance.rate = speechRate;
                    globalThis.speechSynthesis.speak(sentenceUtterance);
                }, 300);
            };
        }
        globalThis.speechSynthesis.speak(wordUtterance);
    };

    const handleGenerateClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onGenerateContext) onGenerateContext();
    };

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('select')) return;
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
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            if (e.cancelable) e.preventDefault();
            setDragOffset({ x: deltaX, y: deltaY * 0.2 });
        }
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;
        const threshold = 100;
        if (dragOffset.x > threshold && onSwipeRight) {
            onSwipeRight();
        } else if (dragOffset.x < -threshold && onSwipeLeft) {
            onSwipeLeft();
        }
        setIsDragging(false);
        setDragStart(null);
        setDragOffset({ x: 0, y: 0 });
    };

    const handleFlipClick = (e: React.MouseEvent) => {
        if (showSettings || isExpanded) return;
        if (Math.abs(dragOffset.x) > 5) return;
        onFlip();
    };

    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
    };

    const isStandardMode = translationMode === 'standard';
    const frontWord = isStandardMode ? word.lang1 : word.lang2;
    const backWord = isStandardMode ? word.lang2 : word.lang1;

    const cardStyle = {
        transform: `translateX(${dragOffset.x}px) translateY(${dragOffset.y}px) rotate(${dragOffset.x * 0.05}deg)`,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s',
        opacity: isChanging ? 0 : 1 - Math.abs(dragOffset.x) / 500
    };

    // Helper to format the AI generated content
    const renderFormattedContent = (text: string) => {
        return text.split('\n').map((line, idx) => {
            // Regex to detect **Label:** patterns
            const labelMatch = line.match(/^\s*(.*)\s*\*\*(.*):\*\*(.*)$/);

            if (labelMatch) {
                const emoji = labelMatch[1];
                const label = labelMatch[2];
                const content = labelMatch[3];

                let labelColor = '';
                const isLink = label.toLowerCase().includes('link');
                const isExample = label.toLowerCase().includes('example');

                if (isStandardMode) {
                    // Blue background (Back side in standard mode)
                    labelColor = isLink ? 'text-emerald-300' : isExample ? 'text-amber-300' : 'text-white';
                } else {
                    // White background (Back side in reverse mode)
                    labelColor = isLink ? 'text-emerald-600 dark:text-emerald-400' : isExample ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-300';
                }

                return (
                    <div key={idx} className="mb-2 leading-relaxed">
                        <span className="mr-1.5">{emoji}</span>
                        <span className={`font-bold uppercase text-[12px] sm:text-xs tracking-wider ${labelColor}`}>
              {label}:
            </span>
                        <span className="ml-1.5">{content}</span>
                    </div>
                );
            }
            return <div key={idx} className="mb-2">{line}</div>;
        });
    };

    const ExpandedOverlay = isExpanded && exampleSentence ? createPortal(
        <div
            className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in"
            onClick={() => setIsExpanded(false)}
        >
            <div
                className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-lg w-full shadow-2xl relative overflow-y-auto max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={() => setIsExpanded(false)}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                    <X size={24} />
                </button>
                <div className="text-indigo-600 dark:text-indigo-400 font-bold mb-4 text-xl">{backWord}</div>
                <div className="text-slate-700 dark:text-slate-200 text-lg leading-relaxed">
                    {renderFormattedContent(exampleSentence)}
                </div>
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={() => setIsExpanded(false)}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700 transition-colors shadow-lg"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    const swipeOverlay = (
        <>
            <div className="absolute inset-0 bg-emerald-500 z-20 rounded-2xl flex items-center justify-center transition-opacity pointer-events-none" style={{ opacity: dragOffset.x > 50 ? Math.min(dragOffset.x / 200, 0.4) : 0 }}><Check className="text-white w-24 h-24" /></div>
            <div className="absolute inset-0 bg-rose-500 z-20 rounded-2xl flex items-center justify-center transition-opacity pointer-events-none" style={{ opacity: dragOffset.x < -50 ? Math.min(Math.abs(dragOffset.x) / 200, 0.4) : 0 }}><div className="text-white font-bold text-4xl">Don't Know</div></div>
        </>
    );

    const frontContent = (
        <div className={`absolute w-full h-full ${isStandardMode ? 'bg-white dark:bg-slate-800' : 'bg-indigo-500 dark:bg-indigo-700'} rounded-2xl shadow-xl flex flex-col justify-start items-center px-6 pb-6 pt-16 text-center overflow-hidden`} style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
            {swipeOverlay}
            {totalAttempts > 0 && (
                <div className={`absolute top-4 left-4 flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-full ${isStandardMode ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-emerald-400/50 text-white'}`}>
                    <Check size={14} /> <span>{knowAttempts}/{totalAttempts}</span>
                </div>
            )}
            <span className={`text-3xl sm:text-4xl font-bold ${isStandardMode ? 'text-slate-900 dark:text-white' : 'text-white'} line-clamp-3 leading-tight`}>{frontWord}</span>
        </div>
    );

    const backContent = (
        <div className={`absolute w-full h-full ${isStandardMode ? 'bg-indigo-500 dark:bg-indigo-700' : 'bg-white dark:bg-slate-800'} rounded-2xl shadow-xl flex flex-col justify-start items-center px-6 pb-6 pt-6 text-center overflow-hidden`} style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
            {swipeOverlay}

            {/* Action Buttons Top Right Grouped */}
            <div className="absolute top-4 right-4 flex items-center gap-0.5 z-10">
                {onGenerateContext && (
                    <button onClick={handleGenerateClick} disabled={isGeneratingContext} className={`p-2 transition-colors rounded-full ${isStandardMode ? 'text-indigo-100 hover:text-white' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
                        {isGeneratingContext ? <Loader2 size={18} className="animate-spin" /> : exampleSentence ? <RefreshCw size={18} /> : <Sparkles size={18} />}
                    </button>
                )}
                <button onClick={e => { e.stopPropagation(); setShowSettings(!showSettings); }} className={`p-2 transition-colors rounded-full ${isStandardMode ? 'text-indigo-100 hover:text-white' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}>
                    {showSettings ? <X size={18} /> : <Settings size={18} />}
                </button>
                {!showSettings && (
                    <button onClick={handlePlayAudioSequence} className={`p-2 ${isStandardMode ? 'text-indigo-100 hover:text-white' : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'} transition-colors rounded-full`}>
                        <Volume2 size={20} />
                    </button>
                )}
            </div>

            {showSettings ? (
                <div className="flex flex-col items-center w-full h-full justify-center p-4 animate-fade-in" onClick={e => e.stopPropagation()}>
                    <h3 className={`text-lg font-semibold mb-4 ${isStandardMode ? 'text-white' : 'text-slate-800 dark:text-white'}`}>Voice Settings</h3>
                    <div className="w-full max-w-xs space-y-4 text-left">
                        <select value={selectedVoiceURI} onChange={handleVoiceChange} className="w-full p-2 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                            {voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name.replace(/Google |English /g, '')}</option>)}
                        </select>
                        <div className="flex items-center justify-between bg-black/10 dark:bg-white/10 rounded-full p-1">
                            {[0.8, 1, 1.2].map(rate => <button key={rate} onClick={() => handleRateChange(rate)} className={`px-4 py-1 rounded-full text-xs font-bold ${speechRate === rate ? 'bg-white text-indigo-600' : 'text-slate-500 dark:text-slate-300'}`}>{rate}x</button>)}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center w-full h-full justify-start pt-8 px-4 overflow-hidden">
                    <div className={`w-full text-xl sm:text-2xl font-bold mb-4 ${isStandardMode ? 'text-white' : 'text-slate-900 dark:text-white'} text-center leading-tight pr-24 sm:pr-0`}>
                        {backWord}
                    </div>
                    {exampleSentence && (
                        <div
                            ref={textRef}
                            className={`relative w-full flex-1 transition-all overflow-hidden flex flex-col items-start ${isStandardMode ? 'text-indigo-50' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                            <div ref={innerContentRef} className="pb-10 text-left text-sm flex flex-col w-full">
                                {renderFormattedContent(exampleSentence)}
                            </div>
                        </div>
                    )}
                    {generationError && <div className="mt-1 text-xs text-rose-500 bg-rose-100 dark:bg-rose-900/30 px-3 py-1 rounded-lg">{generationError}</div>}
                </div>
            )}

            {/* Maximize Button - Fixed Bottom Right Corner of the Card */}
            {exampleSentence && hasOverflow && !showSettings && (
                <button
                    onClick={toggleExpand}
                    className={`absolute bottom-4 right-4 z-20 p-2 rounded-xl transition-all shadow-lg backdrop-blur-md ${isStandardMode ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-slate-200/80 hover:bg-slate-300/80 dark:bg-slate-700/80 dark:hover:bg-slate-600/80 text-slate-700 dark:text-white'}`}
                    title="Expand Text"
                >
                    <Maximize2 size={18} />
                </button>
            )}
        </div>
    );

    return (
        <div className="relative w-full aspect-[4/3] sm:aspect-[3/2] cursor-pointer select-none" style={{ perspective: '1000px' }}>
            {ExpandedOverlay}
            <div
                className="w-full h-full relative"
                style={cardStyle}
                onClick={handleFlipClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                ref={cardRef}
            >
                <div className="w-full h-full relative transition-transform duration-500" style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
                    {frontContent}
                    {backContent}
                </div>
            </div>
        </div>
    );
};
