
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
    FileText,
    HelpCircle,
    RotateCw,
    Shuffle,
    List,
    GraduationCap,
    Sparkles,
    ArrowLeft,
    BookOpen,
} from 'lucide-react';

import { Auth } from './components/Auth';
import { FileSourceModal } from './components/FileSourceModal';
import { Flashcard } from './components/Flashcard';
import { InstructionsModal } from './components/InstructionsModal';
import { LearnedWordsModal } from './components/LearnedWordsModal';
import { ProgressBar } from './components/ProgressBar';
import { SetSelector } from './components/SetSelector';
import { ThemeToggle } from './components/ThemeToggle';
import { TranslationModeToggle } from './components/TranslationModeToggle';
import { WordList } from './components/WordList';
import { SentenceUpload } from './components/SentenceUpload';
import { TrainingModeToggle } from './components/TrainingModeToggle';
import { TrainingModeInput, AnswerState } from './components/TrainingModeInput';
import { TrainingModeGuess } from './components/TrainingModeGuess';

import { auth, db } from './lib/firebase-client';
import { saveLocalProgress, loadLocalProgress, deleteLocalProgress } from './lib/localProgress';
import { parseDictionaryFile, shuffleArray, getWordId } from './utils/dictionaryUtils';
import type {
    Theme,
    Word,
    WordSet,
    LoadedDictionary,
    WordProgress,
    TranslationMode,
} from './types';

// Spaced Repetition System (SRS) intervals in days
const srsIntervals = [1, 2, 4, 8, 16, 32, 64, 128, 256];

const App: React.FC = () => {
    // UI and Auth State
    const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dictionary and Set State
    const [dictionary, setDictionary] = useState<LoadedDictionary | null>(null);
    const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
    const [sentences, setSentences] = useState<Map<string, string> | null>(null);

    // Main Training State
    const [studyQueue, setStudyQueue] = useState<Word[]>([]);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isInstantChange, setIsInstantChange] = useState(false);
    const [translationMode, setTranslationMode] = useState<TranslationMode>('standard');

    // Progress State
    const [learnedWords, setLearnedWords] = useState<Record<string, WordProgress>>({});
    const [dontKnowWords, setDontKnowWords] = useState<Record<string, Word[]>>({});

    // "Don't Know" Words Training State
    const [isTrainingDontKnow, setIsTrainingDontKnow] = useState(false);
    const [dontKnowQueue, setDontKnowQueue] = useState<Word[]>([]);
    const [currentDontKnowIndex, setCurrentDontKnowIndex] = useState(0);
    const [trainingMode, setTrainingMode] = useState<'write' | 'guess'>('write');
    const [userAnswer, setUserAnswer] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('idle');
    const [guessOptions, setGuessOptions] = useState<string[]>([]);

    // Modal and Visibility State
    const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setIsLearnedWordsModalOpen] = useState(false);
    const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
    const [isWordListVisible, setIsWordListVisible] = useState(false);

    // --- EFFECTS ---

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const getProgressId = useCallback(() => {
        if (!dictionary) return null;
        return user ? `${user.uid}_${dictionary.name}` : dictionary.name;
    }, [user, dictionary]);

    // Load progress when user or dictionary changes
    useEffect(() => {
        const loadProgress = async () => {
            const progressId = getProgressId();
            if (!progressId) return;

            setIsLoading(true);
            try {
                let data = { learnedWords: {}, dontKnowWords: {} };
                if (user) {
                    const docRef = doc(db, 'progress', progressId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) data = docSnap.data() as any;
                } else {
                    const localProgress = await loadLocalProgress(progressId);
                    if (localProgress) data = localProgress as any;
                }
                setLearnedWords(data.learnedWords || {});
                setDontKnowWords(data.dontKnowWords || {});
            } catch (e) {
                console.error("Failed to load progress:", e);
                setError("Could not load your progress.");
            } finally {
                setIsLoading(false);
            }
        };

        if (dictionary) loadProgress();
    }, [user, dictionary, getProgressId]);

    // Re-build study queue when the selected set or progress changes
    useEffect(() => {
        if (selectedSetIndex === null || !dictionary) return;

        const currentSet = dictionary.sets[selectedSetIndex];
        const now = new Date();

        const wordsToReview = currentSet.words.filter(word => {
            const wordId = getWordId(word);
            const progress = learnedWords[wordId];
            return !progress || new Date(progress.nextReviewDate) <= now;
        });

        setStudyQueue(shuffleArray(wordsToReview));
        setCurrentWordIndex(0);
        setIsFlipped(false);

    }, [selectedSetIndex, dictionary, learnedWords]);

    // Generate options for "guess" mode
    useEffect(() => {
        const currentTrainingWord = dontKnowQueue[currentDontKnowIndex];
        const currentSet = dictionary?.sets[selectedSetIndex!];

        if (isTrainingDontKnow && trainingMode === 'guess' && currentTrainingWord && currentSet) {
            const correctAnswer = translationMode === 'standard' ? currentTrainingWord.lang2 : currentTrainingWord.lang1;
            const allWordsInSet = currentSet.words;
            const options = new Set<string>([correctAnswer]);

            const shuffledOthers = shuffleArray(allWordsInSet.filter(w => getWordId(w) !== getWordId(currentTrainingWord)));

            while (options.size < 4 && shuffledOthers.length > 0) {
                const otherWord = shuffledOthers.pop();
                if(otherWord) options.add(translationMode === 'standard' ? otherWord.lang2 : otherWord.lang1);
            }
            setGuessOptions(shuffleArray(Array.from(options)));
        }
    }, [isTrainingDontKnow, trainingMode, currentDontKnowIndex, dontKnowQueue, selectedSetIndex, dictionary, translationMode]);

    // --- MEMOIZED VALUES ---

    const currentSet = useMemo(() => {
        return dictionary && selectedSetIndex !== null ? dictionary.sets[selectedSetIndex] : null;
    }, [dictionary, selectedSetIndex]);

    const currentWord = useMemo(() => {
        if (isTrainingDontKnow) return dontKnowQueue[currentDontKnowIndex];
        return studyQueue[currentWordIndex];
    }, [studyQueue, currentWordIndex, isTrainingDontKnow, dontKnowQueue, currentDontKnowIndex]);

    const allLearnedWordsList = useMemo(() => {
        if (!dictionary) return [];
        return Object.entries(learnedWords)
            .map(([wordId, progress]) => {
                const [lang1, lang2] = wordId.split('|');
                return { lang1, lang2, progress };
            })
            .sort((a, b) => a.lang1.localeCompare(b.lang1));
    }, [learnedWords, dictionary]);

    const currentDontKnowCount = currentSet ? (dontKnowWords[currentSet.name] || []).length : 0;

    // --- HANDLERS ---

    const saveProgress = useCallback(async (newLearned: Record<string, WordProgress>, newDontKnow: Record<string, Word[]>) => {
        const progressId = getProgressId();
        if (!progressId) return;

        try {
            if (user) {
                await setDoc(doc(db, 'progress', progressId), { learnedWords: newLearned, dontKnowWords: newDontKnow }, { merge: true });
            } else {
                await saveLocalProgress(progressId, { learnedWords: newLearned, dontKnowWords: newDontKnow });
            }
        } catch (e) {
            console.error("Failed to save progress:", e);
            setError("Could not save your progress.");
        }
    }, [user, getProgressId]);

    const handleFilesSelect = async (name: string, wordsFile: File, sentencesFile?: File) => {
        setIsLoading(true);
        setError(null);
        setIsSourceModalOpen(false);
        try {
            const parsedDictionary = await parseDictionaryFile(wordsFile);
            setDictionary(parsedDictionary);
            // Reset all session state
            setSelectedSetIndex(null);
            setStudyQueue([]);
            setCurrentWordIndex(0);
            setLearnedWords({});
            setDontKnowWords({});
            setSentences(null);

            if(sentencesFile) {
                // This logic is duplicated from SentenceUpload, ideally it would be in a util
                const reader = new FileReader();
                reader.onload = (e) => {
                    const sentenceMap = new Map<string, string>();
                    const text = e.target?.result as string;
                    const jsonObj = JSON.parse(text);
                    for (const key in jsonObj) {
                        if (typeof jsonObj[key] === 'string') {
                            sentenceMap.set(key.trim().toLowerCase(), jsonObj[key]);
                        }
                    }
                    setSentences(sentenceMap);
                };
                reader.readAsText(sentencesFile);
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to process file.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetSelect = (index: number) => {
        setSelectedSetIndex(index);
        setIsTrainingDontKnow(false);
    };

    const handleFlipCard = () => setIsFlipped(!isFlipped);

    const proceedToNextWord = useCallback(() => {
        setIsFlipped(false);
        setIsInstantChange(true);
        setTimeout(() => {
            if (isTrainingDontKnow) {
                if (currentDontKnowIndex < dontKnowQueue.length - 1) {
                    setCurrentDontKnowIndex(prev => prev + 1);
                    setUserAnswer('');
                    setAnswerState('idle');
                } else {
                    setIsTrainingDontKnow(false); // End of training
                }
            } else {
                if (currentWordIndex < studyQueue.length - 1) {
                    setCurrentWordIndex(prev => prev + 1);
                }
            }
            setIsInstantChange(false);
        }, 50);
    }, [currentWordIndex, studyQueue.length, isTrainingDontKnow, currentDontKnowIndex, dontKnowQueue.length]);

    const handleKnowWord = () => {
        if (!currentWord || !currentSet) return;
        const wordId = getWordId(currentWord);

        const currentProgress = learnedWords[wordId];
        const newStage = currentProgress ? currentProgress.srsStage + 1 : 1;
        const interval = srsIntervals[Math.min(newStage - 1, srsIntervals.length - 1)];
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + interval);

        const newLearned = { ...learnedWords, [wordId]: { srsStage: newStage, nextReviewDate: nextReviewDate.toISOString() }};
        setLearnedWords(newLearned);

        const currentSetName = currentSet.name;
        const updatedDontKnowList = (dontKnowWords[currentSetName] || []).filter(w => getWordId(w) !== wordId);
        const newDontKnow = {...dontKnowWords, [currentSetName]: updatedDontKnowList };
        setDontKnowWords(newDontKnow);

        saveProgress(newLearned, newDontKnow);
        proceedToNextWord();
    };

    const handleDontKnowWord = () => {
        if (!currentWord || !currentSet) return;
        const wordId = getWordId(currentWord);

        const newLearned = { ...learnedWords };
        delete newLearned[wordId];
        setLearnedWords(newLearned);

        const currentSetName = currentSet.name;
        const currentList = dontKnowWords[currentSetName] || [];
        const wordExists = currentList.some(w => getWordId(w) === wordId);
        const newList = wordExists ? currentList : [...currentList, currentWord];
        const newDontKnow = { ...dontKnowWords, [currentSetName]: newList };
        setDontKnowWords(newDontKnow);

        saveProgress(newLearned, newDontKnow);
        proceedToNextWord();
    };

    const handleChangeDictionary = () => {
        setDictionary(null);
        setSelectedSetIndex(null);
        setIsSourceModalOpen(true);
    };

    const handleResetProgress = async () => {
        if (window.confirm('Are you sure you want to reset all progress for this dictionary? This cannot be undone.')) {
            setLearnedWords({});
            setDontKnowWords({});
            const progressId = getProgressId();
            if (!progressId) return;

            try {
                if (user) {
                    await setDoc(doc(db, 'progress', progressId), { learnedWords: {}, dontKnowWords: {} });
                } else {
                    await deleteLocalProgress(progressId);
                }
                // Re-trigger queue build by re-setting the index
                const currentIndex = selectedSetIndex;
                setSelectedSetIndex(null);
                setTimeout(() => setSelectedSetIndex(currentIndex), 0);
            } catch (e) {
                setError('Failed to reset progress.');
                console.error(e);
            }
        }
    };

    const startDontKnowTraining = () => {
        if (!currentSet) return;
        const words = dontKnowWords[currentSet.name] || [];
        if (words.length > 0) {
            setDontKnowQueue(shuffleArray(words));
            setCurrentDontKnowIndex(0);
            setIsTrainingDontKnow(true);
            setAnswerState('idle');
            setUserAnswer('');
        }
    };

    const handleCheckAnswer = () => {
        if (!currentWord) return;
        const correctAnswer = translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1;
        if (userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()) {
            setAnswerState('correct');
        } else {
            setAnswerState('incorrect');
        }
    };

    const handleGuess = (isCorrect: boolean) => {
        if (isCorrect) {
            // Correct guess, remove from this training queue
            setDontKnowQueue(q => q.filter(w => getWordId(w) !== getWordId(currentWord!)));
            setCurrentDontKnowIndex(i => i - 1); // Adjust index since array is now shorter
        }
    };

    const handleShuffle = () => {
        setStudyQueue(shuffleArray(studyQueue));
        setCurrentWordIndex(0);
        setIsFlipped(false);
    };

    // --- RENDER LOGIC ---

    const renderHeader = () => (
        <header className="p-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                Flashcards
            </h1>
            <div className="flex items-center gap-2">
                <button onClick={() => setIsInstructionsModalOpen(true)} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                    <HelpCircle size={20} />
                </button>
                <ThemeToggle theme={theme} setTheme={setTheme} />
                <Auth user={user} />
            </div>
        </header>
    );

    if (authLoading) {
        return <div className="bg-slate-100 dark:bg-slate-900 min-h-screen flex justify-center items-center text-slate-500">Loading...</div>;
    }

    if (!dictionary) {
        return (
            <div className="bg-slate-100 dark:bg-slate-900 min-h-screen">
                {renderHeader()}
                <main className="flex flex-col items-center justify-center text-center p-8">
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Master New Words</h2>
                    <p className="max-w-md text-slate-600 dark:text-slate-400 mb-8">
                        Use spaced repetition to learn vocabulary more effectively. Upload your own list or use a pre-packaged one to start.
                    </p>
                    <button onClick={() => setIsSourceModalOpen(true)} className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition-colors">
                        Get Started
                    </button>
                    {error && <p className="mt-4 text-red-500">{error}</p>}
                </main>
                <FileSourceModal isOpen={isSourceModalOpen} onClose={() => setIsSourceModalOpen(false)} onFilesSelect={handleFilesSelect} isLoading={isLoading} />
                <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setIsInstructionsModalOpen(false)} />
            </div>
        );
    }

    if (selectedSetIndex === null) {
        return (
            <div className="bg-slate-100 dark:bg-slate-900 min-h-screen">
                {renderHeader()}
                <main className="p-8">
                    <div className="max-w-2xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white truncate pr-4" title={dictionary.name}>
                                {dictionary.name}
                            </h2>
                            <button onClick={handleChangeDictionary} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                                Change
                            </button>
                        </div>
                        <SetSelector sets={dictionary.sets} selectedSetIndex={selectedSetIndex} onSelectSet={handleSetSelect} />
                    </div>
                </main>
                <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setIsInstructionsModalOpen(false)} />
            </div>
        );
    }

    const isSessionFinished = currentWordIndex >= studyQueue.length -1;

    return (
        <div className="bg-slate-100 dark:bg-slate-900 min-h-screen flex flex-col">
            {renderHeader()}
            <main className="flex-grow flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-lg mx-auto">
                    {/* Top Controls */}
                    <div className="flex justify-between items-center mb-4 text-slate-500 dark:text-slate-400">
                        <button onClick={() => setSelectedSetIndex(null)} className="flex items-center gap-1 text-sm hover:text-white">
                            <ArrowLeft size={16} /> Back to sets
                        </button>
                        {currentSet && <TranslationModeToggle mode={translationMode} onModeChange={setTranslationMode} lang1={currentSet.lang1} lang2={currentSet.lang2} />}
                    </div>

                    {/* Main Content: Flashcard or Completion message */}
                    {!currentWord && !isTrainingDontKnow && (
                        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">All done for now!</h3>
                            <p className="text-slate-600 dark:text-slate-400 mb-6">You've reviewed all due cards in this set.</p>
                            {currentDontKnowCount > 0 && (
                                <button onClick={startDontKnowTraining} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors">
                                    <Sparkles size={18} /> Train {currentDontKnowCount} tricky words
                                </button>
                            )}
                        </div>
                    )}

                    {currentWord && (
                        <>
                            {isTrainingDontKnow ? (
                                <>
                                    <div className="text-center p-6 mb-4 bg-white dark:bg-slate-800 rounded-lg shadow-md">
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">{translationMode === 'standard' ? currentSet?.lang1 : currentSet?.lang2}</p>
                                        <p className="text-3xl font-bold text-slate-900 dark:text-white">
                                            {translationMode === 'standard' ? currentWord.lang1 : currentWord.lang2}
                                        </p>
                                        {answerState === 'incorrect' && (
                                            <p className="mt-2 text-emerald-600 dark:text-emerald-400">
                                                Correct: <span className="font-semibold">{translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1}</span>
                                            </p>
                                        )}
                                    </div>
                                    <div className="mb-4 flex justify-between items-center">
                                        <p className="text-sm text-slate-500 dark:text-slate-400">Word {currentDontKnowIndex + 1} of {dontKnowQueue.length}</p>
                                        <TrainingModeToggle mode={trainingMode} onModeChange={setTrainingMode}/>
                                    </div>

                                    {trainingMode === 'write' ? (
                                        <TrainingModeInput
                                            answer={userAnswer}
                                            setAnswer={setUserAnswer}
                                            onCheck={handleCheckAnswer}
                                            onNext={proceedToNextWord}
                                            answerState={answerState}
                                            placeholder={`Type the ${translationMode === 'standard' ? currentSet?.lang2 : currentSet?.lang1} translation`}
                                        />
                                    ) : (
                                        <TrainingModeGuess
                                            options={guessOptions}
                                            correctAnswer={translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1}
                                            onGuess={handleGuess}
                                            onNext={proceedToNextWord}
                                        />
                                    )}
                                </>
                            ) : (
                                <>
                                    <ProgressBar current={currentWordIndex} total={studyQueue.length} />
                                    <Flashcard
                                        word={currentWord}
                                        isFlipped={isFlipped}
                                        onFlip={handleFlipCard}
                                        exampleSentence={sentences?.get(currentWord.lang2.toLowerCase())}
                                        isInstantChange={isInstantChange}
                                        translationMode={translationMode}
                                        lang1={currentSet?.lang1 || 'Lang1'}
                                        lang2={currentSet?.lang2 || 'Lang2'}
                                    />

                                    {/* Action Buttons */}
                                    <div className="grid grid-cols-2 gap-4 mt-6">
                                        <button onClick={handleDontKnowWord} className="py-3 bg-rose-500 text-white font-semibold rounded-lg shadow-md hover:bg-rose-600 transition-transform transform hover:scale-105 disabled:opacity-50" disabled={!isFlipped}>
                                            Don't know
                                        </button>
                                        <button onClick={handleKnowWord} className="py-3 bg-emerald-500 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-600 transition-transform transform hover:scale-105 disabled:opacity-50" disabled={!isFlipped}>
                                            Know
                                        </button>
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* Bottom Toolbar */}
                    <div className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700">
                        {isTrainingDontKnow ? (
                            <button onClick={() => setIsTrainingDontKnow(false)} className="w-full text-center text-sm text-slate-500 hover:text-white">
                                Back to main session
                            </button>
                        ) : (
                            <>
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex gap-4">
                                        <button onClick={handleShuffle} title="Shuffle" className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                            <Shuffle size={18} />
                                        </button>
                                        <button onClick={() => setIsWordListVisible(!isWordListVisible)} title="Show Word List" className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                            <List size={18} />
                                        </button>
                                        <button onClick={() => setIsLearnedWordsModalOpen(true)} title="Learned Words" className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                            <GraduationCap size={18} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={handleResetProgress} title="Reset Progress" className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                            <RotateCw size={18} />
                                        </button>
                                        <button onClick={handleChangeDictionary} title="Change Dictionary" className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                                            <FileText size={18} />
                                        </button>
                                    </div>
                                </div>
                                <SentenceUpload
                                    onSentencesLoaded={setSentences}
                                    onClearSentences={() => setSentences(null)}
                                    hasSentences={!!sentences}
                                />
                            </>
                        )}
                    </div>
                    <WordList words={currentSet?.words || []} isVisible={isWordListVisible} lang1={currentSet?.lang1 || ''} lang2={currentSet?.lang2 || ''} />
                </div>
            </main>

            <FileSourceModal isOpen={isSourceModalOpen} onClose={() => setIsSourceModalOpen(false)} onFilesSelect={handleFilesSelect} isLoading={isLoading} />
            <LearnedWordsModal isOpen={isLearnedWordsModalOpen} onClose={() => setIsLearnedWordsModalOpen(false)} learnedWords={allLearnedWordsList} lang1={currentSet?.lang1 || 'Lang1'} lang2={currentSet?.lang2 || 'Lang2'} />
            <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setIsInstructionsModalOpen(false)} />
        </div>
    );
};

export default App;
