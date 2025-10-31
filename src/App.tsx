import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import * as XLSX from 'xlsx';
import { Shuffle, List, ArrowLeft, BrainCircuit, HelpCircle, BookCheck, RefreshCw } from 'lucide-react';

import { Flashcard } from './components/Flashcard';
import { SetSelector } from './components/SetSelector';
import { ProgressBar } from './components/ProgressBar';
import { FileSourceModal } from './components/FileSourceModal';
import { InstructionsModal } from './components/InstructionsModal';
import { LearnedWordsModal } from './components/LearnedWordsModal';
import { SentenceUpload } from './components/SentenceUpload';
import { WordList } from './components/WordList';
import { Auth } from './components/Auth';
import { auth } from './lib/firebase-client';
import { parseDictionaryFile, shuffleArray } from './utils/dictionaryUtils';
import type { Word, WordSet, LoadedDictionary, WordProgress } from './types';

// SRS Intervals in milliseconds
const srsIntervals: number[] = [
    0,                            // Stage 0 (New): Review immediately or in the next session
    4 * 3600 * 1000,              // Stage 1: 4 hours
    8 * 3600 * 1000,              // Stage 2: 8 hours
    24 * 3600 * 1000,             // Stage 3: 1 day
    3 * 24 * 3600 * 1000,         // Stage 4: 3 days
    7 * 24 * 3600 * 1000,         // Stage 5: 1 week
    2 * 7 * 24 * 3600 * 1000,     // Stage 6: 2 weeks
    4 * 7 * 24 * 3600 * 1000,     // Stage 7: 1 month
    16 * 7 * 24 * 3600 * 1000,    // Stage 8: 4 months
];

const getNextReviewDate = (stage: number): string => {
    const interval = srsIntervals[Math.min(stage, srsIntervals.length - 1)];
    return new Date(Date.now() + interval).toISOString();
};


const App: React.FC = () => {
    const [user] = useAuthState(auth);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [loadedDictionary, setLoadedDictionary] = useState<LoadedDictionary | null>(null);
    const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
    const [wordProgress, setWordProgress] = useState<Record<string, WordProgress>>({});
    const [sentences, setSentences] = useState<Map<string, string>>(new Map());
    const [wordsForSession, setWordsForSession] = useState<Word[]>([]);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [dontKnowWords, setDontKnowWords] = useState<Record<string, Word[]>>({});
    const [isTrainingDontKnow, setIsTrainingDontKnow] = useState(false);

    const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setIsLearnedWordsModalOpen] = useState(false);
    const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
    const [isWordListVisible, setIsWordListVisible] = useState(false);

    const dictionaryId = useMemo(() => loadedDictionary?.name.replace(/[^a-zA-Z0-9]/g, '_'), [loadedDictionary]);
    const progressKey = useMemo(() => user && dictionaryId ? `flashcard_progress_${user.uid}_${dictionaryId}` : null, [user, dictionaryId]);
    const dontKnowKey = useMemo(() => user && dictionaryId ? `flashcard_dont_know_${user.uid}_${dictionaryId}` : null, [user, dictionaryId]);

    // Load/Save progress and don't-know words from localStorage
    useEffect(() => {
        if (!progressKey) return;
        try {
            const savedProgress = localStorage.getItem(progressKey);
            setWordProgress(savedProgress ? JSON.parse(savedProgress) : {});
        } catch (e) { console.error("Failed to load progress", e); }
    }, [progressKey]);

    useEffect(() => {
        if (progressKey) {
            localStorage.setItem(progressKey, JSON.stringify(wordProgress));
        }
    }, [wordProgress, progressKey]);

    useEffect(() => {
        if (!dontKnowKey) return;
        try {
            const saved = localStorage.getItem(dontKnowKey);
            setDontKnowWords(saved ? JSON.parse(saved) : {});
        } catch (e) { console.error("Failed to load 'don't know' words", e); }
    }, [dontKnowKey]);

    useEffect(() => {
        if (dontKnowKey) {
            localStorage.setItem(dontKnowKey, JSON.stringify(dontKnowWords));
        }
    }, [dontKnowWords, dontKnowKey]);

    // Dictionary and Sentence Loading
    const handleFileLoad = useCallback(async (file: File) => {
        setIsLoading(true);
        setError(null);
        setIsSourceModalOpen(false);
        try {
            const dictionary = await parseDictionaryFile(file);
            setLoadedDictionary(dictionary);
            setSelectedSetIndex(null);
            setWordsForSession([]);
            setCurrentWordIndex(0);
            setSentences(new Map());
            setWordProgress({});
            setDontKnowWords({});
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            setLoadedDictionary(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleBuiltInLoad = useCallback(async (path: string, sentencesPath?: string) => {
        setIsLoading(true);
        setError(null);
        setIsSourceModalOpen(false);
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Failed to fetch dictionary: ${response.statusText}`);
            const blob = await response.blob();
            const file = new File([blob], path.split('/').pop() || 'dictionary.xlsx');

            // Temporarily set dictionary to show loading state correctly before parsing sentences
            setLoadedDictionary({ name: file.name, sets: [] });

            if (sentencesPath) {
                await handleSentencesLoadFromPath(sentencesPath);
            }
            // Now parse the dictionary file itself
            const dictionary = await parseDictionaryFile(file);
            setLoadedDictionary(dictionary);
            setSelectedSetIndex(null);
            setWordsForSession([]);
            setCurrentWordIndex(0);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            setLoadedDictionary(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleSentencesLoadFromPath = async (path: string) => {
        try {
            const res = await fetch(path);
            if (!res.ok) return;
            const sentenceMap = new Map<string, string>();
            if (path.endsWith('.json')) {
                const data = await res.json();
                Object.keys(data).forEach(key => sentenceMap.set(key.toLowerCase(), data[key]));
            } else if (path.endsWith('.xlsx')) {
                const buffer = await res.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                jsonData.forEach(row => {
                    if (row[0] && row[1]) sentenceMap.set(String(row[0]).toLowerCase(), String(row[1]));
                });
            }
            setSentences(sentenceMap);
        } catch (e) {
            console.error("Failed to load sentences from path:", e);
        }
    };

    // Session Management
    const startSession = useCallback((setIndex: number) => {
        if (!loadedDictionary) return;
        const currentSet = loadedDictionary.sets[setIndex];
        const now = new Date().toISOString();
        const wordsToReview = currentSet.words.filter(word => {
            const progress = wordProgress[word.en];
            return !progress || progress.nextReviewDate <= now;
        });

        setWordsForSession(shuffleArray(wordsToReview));
        setSelectedSetIndex(setIndex);
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setIsTrainingDontKnow(false);
        setIsWordListVisible(false);
    }, [loadedDictionary, wordProgress]);

    const startDontKnowSession = useCallback(() => {
        if (selectedSetIndex === null || !loadedDictionary) return;
        const setName = loadedDictionary.sets[selectedSetIndex].name;
        const words = dontKnowWords[setName];
        if (words && words.length > 0) {
            setWordsForSession(shuffleArray(words));
            setCurrentWordIndex(0);
            setIsFlipped(false);
            setIsTrainingDontKnow(true);
        }
    }, [selectedSetIndex, loadedDictionary, dontKnowWords]);

    // Flashcard Actions
    const handleFlip = () => setIsFlipped(prev => !prev);

    const moveToNextWord = useCallback(() => {
        setIsFlipped(false);
        if (currentWordIndex < wordsForSession.length - 1) {
            setCurrentWordIndex(prev => prev + 1);
        } else {
            setWordsForSession([]); // Session ends
        }
    }, [currentWordIndex, wordsForSession.length]);

    const handleKnow = useCallback(() => {
        if (!wordsForSession.length) return;
        const currentWord = wordsForSession[currentWordIndex];
        const currentProgress = wordProgress[currentWord.en];
        const nextStage = (currentProgress?.srsStage || 0) + 1;

        setWordProgress(prev => ({
            ...prev,
            [currentWord.en]: { srsStage: nextStage, nextReviewDate: getNextReviewDate(nextStage) },
        }));

        if (isTrainingDontKnow && selectedSetIndex !== null && loadedDictionary) {
            const setName = loadedDictionary.sets[selectedSetIndex].name;
            setDontKnowWords(prev => ({
                ...prev,
                [setName]: prev[setName]?.filter(w => w.en !== currentWord.en) || [],
            }));
        }
        moveToNextWord();
    }, [wordsForSession, currentWordIndex, wordProgress, isTrainingDontKnow, selectedSetIndex, loadedDictionary, moveToNextWord]);

    const handleDontKnow = useCallback(() => {
        if (!wordsForSession.length || selectedSetIndex === null || !loadedDictionary) return;
        const currentWord = wordsForSession[currentWordIndex];

        setWordProgress(prev => ({
            ...prev,
            [currentWord.en]: { srsStage: 0, nextReviewDate: getNextReviewDate(0) },
        }));

        const setName = loadedDictionary.sets[selectedSetIndex].name;
        if (!dontKnowWords[setName]?.some(w => w.en === currentWord.en)) {
            setDontKnowWords(prev => ({
                ...prev,
                [setName]: [...(prev[setName] || []), currentWord],
            }));
        }
        moveToNextWord();
    }, [wordsForSession, currentWordIndex, selectedSetIndex, loadedDictionary, dontKnowWords, moveToNextWord]);

    const handleShuffle = () => {
        setWordsForSession(shuffleArray(wordsForSession));
        setCurrentWordIndex(0);
        setIsFlipped(false);
    };

    // General Controls
    const resetProgress = () => {
        if (!dictionaryId) return;
        if (window.confirm("Are you sure you want to reset all progress for this dictionary? This cannot be undone.")) {
            if (progressKey) localStorage.removeItem(progressKey);
            if (dontKnowKey) localStorage.removeItem(dontKnowKey);
            setWordProgress({});
            setDontKnowWords({});
            if (selectedSetIndex !== null) {
                startSession(selectedSetIndex);
            }
        }
    };

    const changeDictionary = () => {
        setLoadedDictionary(null);
        setSelectedSetIndex(null);
        setIsSourceModalOpen(true);
    };

    const currentSet = selectedSetIndex !== null ? loadedDictionary?.sets[selectedSetIndex] : null;
    const currentWord = wordsForSession[currentWordIndex];
    const dontKnowCountForSet = (currentSet && dontKnowWords[currentSet.name]?.length) || 0;

    const learnedWordsForModal = useMemo(() => {
        if (!loadedDictionary) return [];
        const allWords = loadedDictionary.sets.flatMap(s => s.words);
        return allWords
            .filter(word => wordProgress[word.en]?.srsStage > 0)
            .map(word => ({ ...word, progress: wordProgress[word.en] }))
            .sort((a, b) => b.progress.srsStage - a.progress.srsStage);
    }, [loadedDictionary, wordProgress]);

    // Render Logic
    const renderContent = () => {
        if (isLoading && !loadedDictionary?.name) {
            return <div className="text-center text-indigo-400 animate-pulse">Loading dictionary...</div>;
        }

        if (error) {
            return (
                <div className="text-center text-rose-400">
                    <p>Error: {error}</p>
                    <button onClick={changeDictionary} className="mt-4 px-4 py-2 bg-indigo-600 rounded-lg">Try again</button>
                </div>
            );
        }

        if (!loadedDictionary) {
            return (
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">Flashcard App</h1>
                    <p className="text-slate-400 mb-8">Master new vocabulary with spaced repetition.</p>
                    <button onClick={() => setIsSourceModalOpen(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
                        Get Started
                    </button>
                </div>
            );
        }

        if (selectedSetIndex === null || !currentSet) {
            return (
                <div className="w-full max-w-2xl mx-auto">
                    <h2 className="text-2xl font-bold text-center text-white mb-2">
                        {loadedDictionary.name}
                    </h2>
                    <p className="text-slate-400 text-center mb-6">Select a set to begin.</p>
                    <SetSelector sets={loadedDictionary.sets} selectedSetIndex={selectedSetIndex} onSelectSet={startSession} />
                </div>
            );
        }

        if (wordsForSession.length > 0) {
            return (
                <div className="w-full max-w-xl mx-auto flex flex-col items-center">
                    <div className="w-full mb-4">
                        <div className="flex justify-between items-center text-sm text-slate-400 mb-1">
                            <span>{isTrainingDontKnow ? "Reviewing Mistakes" : `Studying: ${currentSet.name}`}</span>
                            <span>{currentWordIndex + 1} / {wordsForSession.length}</span>
                        </div>
                        <ProgressBar current={currentWordIndex + 1} total={wordsForSession.length} />
                    </div>

                    <Flashcard
                        word={currentWord}
                        isFlipped={isFlipped}
                        onFlip={handleFlip}
                        exampleSentence={sentences.get(currentWord.en.toLowerCase())}
                    />

                    <div className="flex justify-center gap-4 mt-8 w-full">
                        <button onClick={handleDontKnow} className="px-8 py-3 w-1/2 bg-rose-600 hover:bg-rose-700 rounded-lg text-white font-semibold transition-colors">Don't Know</button>
                        <button onClick={handleKnow} className="px-8 py-3 w-1/2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-semibold transition-colors">Know</button>
                    </div>

                    <div className="flex items-center justify-center gap-6 mt-6">
                        <button onClick={handleShuffle} className="p-2 text-slate-400 hover:text-white transition-colors" title="Shuffle Words">
                            <Shuffle size={20} />
                        </button>
                        <button onClick={() => setIsWordListVisible(prev => !prev)} className="p-2 text-slate-400 hover:text-white transition-colors" title="Toggle Word List">
                            <List size={20} />
                        </button>
                    </div>

                    <WordList words={currentSet.words} isVisible={isWordListVisible} />
                </div>
            );
        }

        // Session Complete
        return (
            <div className="text-center">
                <h2 className="text-3xl font-bold text-white mb-4">Session Complete!</h2>
                <p className="text-slate-400 mb-8">Great job! Take a break or start a new session.</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button onClick={() => startSession(selectedSetIndex)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors">
                        Practice Again
                    </button>
                    {dontKnowCountForSet > 0 && (
                        <button onClick={startDontKnowSession} className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                            <BrainCircuit size={18} /> Review {dontKnowCountForSet} Mistake(s)
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-slate-900 text-white min-h-screen flex flex-col font-sans">
            <header className="w-full p-4 flex justify-between items-center">
                <h1 className="text-xl font-bold">
                    <button onClick={loadedDictionary ? changeDictionary : () => {}}>Flashcards</button>
                </h1>
                <div className="flex items-center gap-4">
                    {loadedDictionary && selectedSetIndex !== null && (
                        <div className="hidden sm:flex items-center gap-4">
                            <button onClick={() => setIsLearnedWordsModalOpen(true)} className="text-sm font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5" title="View Learned Words">
                                <BookCheck size={16} /> Learned
                            </button>
                            <button onClick={resetProgress} className="text-sm font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5" title="Reset Progress">
                                <RefreshCw size={16} /> Reset
                            </button>
                            <button onClick={changeDictionary} className="text-sm font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5" title="Change Dictionary">
                                <ArrowLeft size={16} /> Change
                            </button>
                        </div>
                    )}
                    <button onClick={() => setIsInstructionsModalOpen(true)} className="text-slate-400 hover:text-white" title="How to use">
                        <HelpCircle size={22} />
                    </button>
                    <Auth user={user} />
                </div>
            </header>

            <main className="flex-grow flex items-center justify-center p-4">
                {renderContent()}
            </main>

            <footer className="w-full p-4">
                {loadedDictionary && selectedSetIndex !== null && (
                    <div className="w-full max-w-xl mx-auto border-t border-slate-700 pt-4">
                        <SentenceUpload
                            onSentencesLoaded={setSentences}
                            onClearSentences={() => setSentences(new Map())}
                            hasSentences={sentences.size > 0}
                        />
                    </div>
                )}
            </footer>

            <FileSourceModal
                isOpen={isSourceModalOpen}
                onClose={() => setIsSourceModalOpen(false)}
                onFileSelect={handleFileLoad}
                onBuiltInSelect={handleBuiltInLoad}
                isLoading={isLoading}
            />
            <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setIsInstructionsModalOpen(false)} />
            <LearnedWordsModal isOpen={isLearnedWordsModalOpen} onClose={() => setIsLearnedWordsModalOpen(false)} learnedWords={learnedWordsForModal} />
        </div>
    );
};

export default App;
