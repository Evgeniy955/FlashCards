import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db, firebase } from './lib/firebase-client';
import { Flashcard } from './components/Flashcard';
import { ProgressBar } from './components/ProgressBar';
import { SetSelector } from './components/SetSelector';
import { FileSourceModal } from './components/FileSourceModal';
import { InstructionsModal } from './components/InstructionsModal';
import { LearnedWordsModal } from './components/LearnedWordsModal';
import { ProfileModal } from './components/ProfileModal';
import { WordList } from './components/WordList';
import { SentenceUpload } from './components/SentenceUpload';
import { Auth } from './components/Auth';
import { Tooltip } from './components/Tooltip';
import { Word, LoadedDictionary, WordProgress, TranslationMode, Theme, WordStats } from './types';
import { parseDictionaryFile, shuffleArray, getWordId } from './utils/dictionaryUtils';
import { Shuffle, ChevronsUpDown, Info, BookUser, Trash2, Repeat, Library, Loader2, User as UserIcon, RefreshCw, Flame, Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react';
import { TrainingModeInput, AnswerState } from './components/TrainingModeInput';
import { TrainingModeGuess } from './components/TrainingModeGuess';
import { TrainingModeToggle } from './components/TrainingModeToggle';
import { TranslationModeToggle } from './components/TranslationModeToggle';
import { saveLocalProgress, loadLocalProgress, deleteLocalProgress, loadAllLocalProgress, clearAllLocalProgress } from './lib/localProgress';
import { ThemeToggle } from './components/ThemeToggle';
import { getDictionary } from './lib/indexedDB';
import { StudyStatsToast } from './components/StudyStatsToast';
import { loadSentences as loadLocalSentences, saveSentences as saveLocalSentences } from './lib/sentenceDB';
import { generateExampleSentence, validateAnswerWithAI } from './lib/gemini';
import { sounds } from './lib/soundEffects';

const SRS_INTERVALS = [1, 2, 4, 8, 16, 32, 64];

interface ProfileStats {
    totalWords: number;
    learnedCount: number;
    dontKnowCount: number;
    remainingCount: number;
    learnedPercentage: number;
    remainingPercentage: number;
    dictionaryCount?: number;
}

function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}

const calculateStreak = (history: string[]): number => {
    if (!history || history.length === 0) return 0;
    const sortedDates = [...new Set(history)].map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime());
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    if (sortedDates.length === 0) return 0;
    if (sortedDates[0].getTime() !== today.getTime() && sortedDates[0].getTime() !== yesterday.getTime()) {
        return 0;
    }
    let streak = 1;
    for (let i = 0; i < sortedDates.length - 1; i++) {
        const current = sortedDates[i];
        const next = sortedDates[i + 1];
        const diffDays = Math.round((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) streak++;
        else break;
    }
    return streak;
};

const getLastSessionCount = (history: string[], dailyData: { [key: string]: { newWordsLearned: number } }): number => {
    if (!history || history.length === 0) return 0;
    const sortedDates = [...new Set(history)].sort((a, b) => b.localeCompare(a));
    return dailyData[sortedDates[0]]?.newWordsLearned || 0;
};

const App: React.FC = () => {
    const [user, authLoading] = useAuthState(auth as any);
    const [loadedDictionary, setLoadedDictionary] = useState<LoadedDictionary | null>(null);
    const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [reviewWords, setReviewWords] = useState<Word[]>([]);
    const [sessionProgress, setSessionProgress] = useState(0);
    const [sessionTotal, setSessionTotal] = useState(0);
    const [sessionActive, setSessionActive] = useState(false);
    const [learnedWords, setLearnedWords] = useState<Map<string, WordProgress>>(new Map());
    const [dontKnowWords, setDontKnowWords] = useState<Map<number, Word[]>>(new Map());
    const [wordStats, setWordStats] = useState<Map<string, WordStats>>(new Map());
    const [sentences, setSentences] = useState<Map<string, string>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isProgressLoading, setIsProgressLoading] = useState(true);
    const [isDontKnowMode, setIsDontKnowMode] = useState(false);
    const [isPracticeMode, setIsPracticeMode] = useState(false);
    const [isChangingWord, setIsChangingWord] = useState(false);
    const [userAnswer, setUserAnswer] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('idle');
    const [trainingMode, setTrainingMode] = useState<'write' | 'guess'>('write');
    const [translationMode, setTranslationMode] = useState<TranslationMode>('standard');
    const [isGeneratingSentence, setIsGeneratingSentence] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [isValidatingAnswer, setIsValidatingAnswer] = useState(false);
    const [aiFeedback, setAiFeedback] = useState<string>('');
    const [isFileSourceModalOpen, setFileSourceModalOpen] = useState(false);
    const [isInstructionsModalOpen, setInstructionsModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setLearnedWordsModalOpen] = useState(false);
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>('dark');
    const [allTimeStats, setAllTimeStats] = useState<ProfileStats | null>(null);
    const [currentStreak, setCurrentStreak] = useState(0);
    const [welcomeStats, setWelcomeStats] = useState<{ streak: number; lastSessionCount: number } | null>(null);
    const [showWelcomeToast, setShowWelcomeToast] = useState(false);
    const [isZenMode, setIsZenMode] = useState(false);
    const [isMuted, setIsMuted] = useState(sounds.getMuted());
    const [isSyncing, setIsSyncing] = useState(false);
    const prevUser = usePrevious(user);

    const lastInitializedSetRef = useRef<string | null>(null);

    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as Theme | null;
        if (savedTheme) setTheme(savedTheme);
        else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme('dark');
        else setTheme('light');
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme]);

    const dictionaryId = useMemo(() => loadedDictionary?.name.replace(/[./]/g, '_'), [loadedDictionary]);

    const saveLastUsedDictionary = useCallback(async (name: string) => {
        localStorage.setItem('lastUsedDictionary', name);
        if (user) await db.collection('users').doc(user.uid).set({ lastUsedDictionary: name }, { merge: true });
    }, [user]);

    const startReviewSession = useCallback((idx: number) => {
        if (!loadedDictionary) return;
        const set = loadedDictionary.sets[idx];
        const words = set.words.filter(w => !learnedWords.has(getWordId(w)));

        if (words.length > 0) {
            setReviewWords(shuffleArray(words));
            setSessionTotal(words.length);
            setSessionProgress(1);
            setCurrentWordIndex(0);
            setSessionActive(true);
            setIsDontKnowMode(false);
            setIsFlipped(false);
        } else {
            setReviewWords([]);
            setSessionActive(false);
        }
    }, [loadedDictionary, learnedWords]);

    const loadAndSetDictionary = useCallback(async (name: string, wordsFile: File, sentencesFile?: File) => {
        setIsLoading(true);
        setIsProgressLoading(true);
        try {
            if (sentencesFile) {
                const text = await sentencesFile.text();
                const jsonObj = JSON.parse(text);
                const sentenceMap = new Map<string, string>();
                Object.entries(jsonObj).forEach(([k, v]) => sentenceMap.set(k.trim().toLowerCase(), String(v)));
                setSentences(prev => {
                    const next = new Map(prev);
                    sentenceMap.forEach((v, k) => next.set(k, v));
                    return next;
                });
            }
            const dictionary = await parseDictionaryFile(wordsFile);
            dictionary.name = name;
            setLoadedDictionary(dictionary);

            // Clear current session to force restart with new dictionary
            lastInitializedSetRef.current = null;
            setSelectedSetIndex(0);

            setFileSourceModalOpen(false);
            setSessionActive(false);
            await saveLastUsedDictionary(name);
        } catch (error) {
            console.error("Dictionary load error:", error);
            setLoadedDictionary(null);
        } finally {
            setIsLoading(false);
            setIsProgressLoading(false);
        }
    }, [saveLastUsedDictionary]);

    // Initial load: Dictionary & Phrases
    useEffect(() => {
        if (authLoading) return;

        const bootData = async () => {
            let lastUsed: string | null = null;
            try {
                if (user) {
                    const doc = await db.collection('users').doc(user.uid).get();
                    lastUsed = doc.data()?.lastUsedDictionary || localStorage.getItem('lastUsedDictionary');

                    const userData = doc.data();
                    if (userData?.globalSentences) {
                        const globalSentences = userData.globalSentences as Record<string, unknown>;
                        setSentences(prev => {
                            const next = new Map(prev);
                            Object.entries(globalSentences).forEach(([k, v]) => next.set(k, String(v)));
                            return next;
                        });
                    }
                } else {
                    lastUsed = localStorage.getItem('lastUsedDictionary');
                    const localSentences = await loadLocalSentences('local');
                    setSentences(prev => new Map([...prev, ...localSentences]));
                }

                if (lastUsed) {
                    const saved = await getDictionary(lastUsed, user?.uid);
                    if (saved) {
                        await loadAndSetDictionary(saved.name, saved.file);
                    } else {
                        setIsProgressLoading(false);
                    }
                } else {
                    setIsProgressLoading(false);
                }
            } catch (err) {
                console.error("Boot error:", err);
                setIsProgressLoading(false);
            } finally {
                setIsInitialLoading(false);
            }
        };

        bootData();
    }, [user, authLoading, loadAndSetDictionary]);

    // Track Set Changes
    useEffect(() => {
        if (selectedSetIndex !== null && loadedDictionary && !isProgressLoading) {
            const setKey = `${loadedDictionary.name}-${selectedSetIndex}`;
            if (lastInitializedSetRef.current !== setKey) {
                startReviewSession(selectedSetIndex);
                lastInitializedSetRef.current = setKey;
            }
        }
    }, [selectedSetIndex, loadedDictionary, isProgressLoading, startReviewSession]);

    // Debounced Save phrases
    useEffect(() => {
        if (authLoading || sentences.size === 0) return;

        const handler = setTimeout(async () => {
            const plainSentences = Object.fromEntries(sentences);
            if (user) {
                await db.collection('users').doc(user.uid).set({ globalSentences: plainSentences }, { merge: true });
            } else {
                await saveLocalSentences('local', sentences);
            }
        }, 2000);

        return () => clearTimeout(handler);
    }, [sentences, user, authLoading]);

    const recordStudyActivity = useCallback(async (isNewWord: boolean) => {
        if (!user) return;
        const todayStr = new Date().toISOString().split('T')[0];
        const updates: { [key: string]: any } = {
            studyHistory: firebase.firestore.FieldValue.arrayUnion(todayStr)
        };
        if (isNewWord) updates[`dailyStats.${todayStr}.newWordsLearned`] = firebase.firestore.FieldValue.increment(1);
        await db.collection('users').doc(user.uid).set(updates, { merge: true });
    }, [user]);

    useEffect(() => {
        if (isProgressLoading || !dictionaryId || isSyncing) return;
        const handler = setTimeout(async () => {
            const data = {
                learnedWords: Object.fromEntries(learnedWords),
                dontKnowWords: Object.fromEntries(dontKnowWords),
                wordStats: Object.fromEntries(wordStats),
                totalWordsInDict: currentDictionaryStats?.totalWords
            };
            if (user) await db.collection('users').doc(user.uid).collection('progress').doc(dictionaryId).set(data, { merge: true });
            else await saveLocalProgress(dictionaryId, data);
        }, 1500);
        return () => clearTimeout(handler);
    }, [learnedWords, dontKnowWords, wordStats, user, dictionaryId, isProgressLoading]);

    const currentDictionaryStats = useMemo<ProfileStats | null>(() => {
        if (!loadedDictionary) return null;
        const total = loadedDictionary.sets.reduce((sum, s) => sum + s.words.length, 0);
        const learned = learnedWords.size;
        return {
            totalWords: total,
            learnedCount: learned,
            dontKnowCount: Array.from(dontKnowWords.values()).reduce((sum, arr) => sum + arr.length, 0),
            remainingCount: total - learned,
            learnedPercentage: total > 0 ? (learned / total) * 100 : 0,
            remainingPercentage: total > 0 ? ((total - learned) / total) * 100 : 0,
        };
    }, [loadedDictionary, learnedWords, dontKnowWords]);

    const currentSet = useMemo(() => selectedSetIndex !== null ? loadedDictionary?.sets[selectedSetIndex] : null, [selectedSetIndex, loadedDictionary]);
    const currentWord = useMemo(() => reviewWords[currentWordIndex], [reviewWords, currentWordIndex]);

    const handleFlip = useCallback(() => {
        if (isDontKnowMode && answerState !== 'idle' && trainingMode === 'write') return;
        sounds.play('flip');
        setIsFlipped(prev => !prev);
    }, [isDontKnowMode, answerState, trainingMode]);

    const advanceToNextWord = (updateLogic: () => boolean) => {
        if (!currentWord || isChangingWord) return;
        if (!updateLogic()) return;
        setIsChangingWord(true);
        setTimeout(() => {
            const next = currentWordIndex + 1;
            if (next < reviewWords.length) {
                setCurrentWordIndex(next);
                setSessionProgress(prev => prev + 1);
                setIsFlipped(false);
            } else {
                setReviewWords([]);
                setSessionActive(false);
                sounds.play('success');
            }
            setIsChangingWord(false);
        }, 300);
    };

    const handleKnow = () => {
        sounds.play('correct');
        if (isPracticeMode) { advanceToNextWord(() => true); return; }
        const isNew = !learnedWords.has(getWordId(currentWord));
        recordStudyActivity(isNew);
        advanceToNextWord(() => {
            const id = getWordId(currentWord);
            setWordStats(prev => {
                const next = new Map(prev);
                const s = next.get(id) || { knowCount: 0, totalAttempts: 0 };
                next.set(id, { knowCount: s.knowCount + 1, totalAttempts: s.totalAttempts + 1 });
                return next;
            });
            const nextReview = new Date();
            nextReview.setDate(nextReview.getDate() + 1);
            setLearnedWords(prev => new Map(prev).set(id, { srsStage: 0, nextReviewDate: nextReview.toISOString() }));
            return true;
        });
    };

    const handleDontKnow = () => {
        sounds.play('incorrect');
        if (isPracticeMode) { advanceToNextWord(() => true); return; }
        advanceToNextWord(() => {
            const id = getWordId(currentWord);
            setWordStats(prev => {
                const next = new Map(prev);
                const s = next.get(id) || { knowCount: 0, totalAttempts: 0 };
                next.set(id, { ...s, totalAttempts: s.totalAttempts + 1 });
                return next;
            });
            if (selectedSetIndex !== null) {
                setDontKnowWords(prev => {
                    const next = new Map(prev);
                    const list = next.get(selectedSetIndex) || [];
                    if (!list.some(w => getWordId(w) === id)) next.set(selectedSetIndex, [...list, currentWord]);
                    return next;
                });
            }
            return true;
        });
    };

    const handleGenerateSentence = async () => {
        if (!currentWord || !currentSet) return;
        setIsGeneratingSentence(true);
        setGenerationError(null);
        try {
            const targetLang = translationMode === 'standard' ? currentSet.lang2 : currentSet.lang1;
            const nativeLang = translationMode === 'standard' ? currentSet.lang1 : currentSet.lang2;
            const res = await generateExampleSentence(currentWord.lang2, targetLang, nativeLang);
            if (res) {
                const key = currentWord.lang2.trim().toLowerCase();
                setSentences(prev => new Map(prev).set(key, res));
                sounds.play('success');
            }
        } catch (e: any) {
            setGenerationError(e.message || "AI Error");
        } finally {
            setIsGeneratingSentence(false);
        }
    };

    const handleTrainingAnswer = async () => {
        if (!currentWord || answerState !== 'idle' || !currentSet) return;
        const correct = translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1;
        const isSimpleCorrect = userAnswer.trim().toLowerCase() === correct.toLowerCase();

        if (isSimpleCorrect) {
            setAnswerState('correct');
            sounds.play('correct');
            setTimeout(handleKnow, 1000);
        } else if (trainingMode === 'write') {
            setIsValidatingAnswer(true);
            try {
                const targetLang = translationMode === 'standard' ? currentSet.lang2 : currentSet.lang1;
                const result = await validateAnswerWithAI(userAnswer, correct, targetLang);
                if (result.isCorrect) {
                    setAnswerState('correct');
                    setAiFeedback(result.feedback || `Correct! Note: "${correct}"`);
                    sounds.play('correct');
                    setTimeout(handleKnow, 3000);
                } else {
                    setAnswerState('incorrect');
                    setAiFeedback(result.feedback);
                    sounds.play('incorrect');
                    setIsFlipped(true);
                }
            } catch {
                setAnswerState('incorrect');
            } finally {
                setIsValidatingAnswer(false);
            }
        }
    };

    if (isInitialLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={48} className="animate-spin text-indigo-500" />
                    <p className="text-slate-500 font-medium">Restoring session...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen flex flex-col items-center p-4 sm:p-6 transition-colors">
            {!isZenMode && (
                <header className="w-full max-w-5xl flex justify-between items-center mb-6 animate-fade-in">
                    <div className="flex items-center gap-2">
                        <Tooltip content={isMuted ? "Unmute" : "Mute"}><button onClick={() => setIsMuted(sounds.toggleMute())} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">{isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}</button></Tooltip>
                        <Tooltip content="Change Dictionary"><button onClick={() => setFileSourceModalOpen(true)} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><Library size={18} /><span className="hidden sm:inline">Change</span></button></Tooltip>
                        <Tooltip content="Info"><button onClick={() => setInstructionsModalOpen(true)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"><Info size={20} /></button></Tooltip>
                    </div>
                    <h1 className="text-lg font-bold truncate max-w-[150px]">{loadedDictionary?.name || "Flashcard Trainer"}</h1>
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-sm ${currentStreak > 0 ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-400"}`}><Flame size={18} className={currentStreak > 0 ? "fill-orange-500" : ""} /><span>{currentStreak}</span></div>
                        <button onClick={() => setProfileModalOpen(true)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"><UserIcon size={20} /></button>
                        <ThemeToggle theme={theme} setTheme={setTheme} />
                        <Auth user={user} />
                    </div>
                </header>
            )}

            <div className="w-full max-w-md flex flex-col items-center">
                {!isZenMode && (
                    <div className="flex gap-4 mb-4">
                        <button onClick={() => setLearnedWordsModalOpen(true)} className="flex items-center gap-2 py-1 px-3 bg-white dark:bg-slate-800 rounded-full text-sm shadow-sm border dark:border-slate-700"><BookUser size={16} /> {learnedWords.size}</button>
                        <button onClick={() => setIsZenMode(!isZenMode)} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"><Maximize2 size={16} /></button>
                    </div>
                )}

                {!loadedDictionary ? (
                    <div className="text-center py-20 animate-fade-in">
                        <Library size={40} className="mx-auto mb-6 text-indigo-500" />
                        <h2 className="text-2xl font-bold mb-4">No dictionary loaded</h2>
                        <button onClick={() => setFileSourceModalOpen(true)} className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">Select Dictionary</button>
                    </div>
                ) : (
                    <>
                        {!isZenMode && (
                            <SetSelector sets={loadedDictionary.sets} selectedSetIndex={selectedSetIndex} onSelectSet={setSelectedSetIndex} learnedWords={learnedWords} />
                        )}

                        {isProgressLoading ? (
                            <div className="flex items-center gap-3 py-10"><Loader2 className="animate-spin text-indigo-500" /> Syncing...</div>
                        ) : reviewWords.length > 0 && currentWord ? (
                            <div className="w-full">
                                <div className="text-center text-xs text-slate-500 mb-2 uppercase tracking-widest">{isDontKnowMode ? 'Mistake Review' : 'Learning Session'}</div>
                                <ProgressBar current={sessionProgress} total={sessionTotal} />
                                <div className={isChangingWord ? 'opacity-0 scale-95 transition-all' : 'opacity-100 scale-100 transition-all'}>
                                    <Flashcard
                                        word={currentWord}
                                        isFlipped={isFlipped}
                                        onFlip={handleFlip}
                                        exampleSentence={sentences.get(currentWord.lang2.trim().toLowerCase())}
                                        translationMode={translationMode}
                                        lang1={currentSet?.lang1 || ''}
                                        knowAttempts={wordStats.get(getWordId(currentWord))?.knowCount || 0}
                                        totalAttempts={wordStats.get(getWordId(currentWord))?.totalAttempts || 0}
                                        onGenerateContext={handleGenerateSentence}
                                        isGeneratingContext={isGeneratingSentence}
                                        generationError={generationError}
                                        onSwipeLeft={!isDontKnowMode ? handleDontKnow : undefined}
                                        onSwipeRight={!isDontKnowMode ? handleKnow : undefined}
                                    />
                                </div>
                                <div className="flex gap-4 mt-6">
                                    {isDontKnowMode ? (
                                        <TrainingModeInput
                                            answer={userAnswer} setAnswer={setUserAnswer}
                                            onCheck={handleTrainingAnswer} onNext={() => { setCurrentWordIndex(c => c + 1); setAnswerState('idle'); setUserAnswer(''); }}
                                            answerState={answerState} isValidating={isValidatingAnswer} aiFeedback={aiFeedback}
                                            placeholder="Type translation..."
                                        />
                                    ) : (
                                        <>
                                            <button onClick={handleDontKnow} className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors">Hard</button>
                                            <button onClick={handleKnow} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">Known</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 animate-fade-in">
                                <div className="text-5xl mb-4">🎉</div>
                                <h2 className="text-2xl font-bold mb-2">Set Completed!</h2>
                                <button onClick={() => startReviewSession(selectedSetIndex || 0)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold">Practice Again</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <FileSourceModal isOpen={isFileSourceModalOpen} onClose={() => setFileSourceModalOpen(false)} onFilesSelect={loadAndSetDictionary} isLoading={isLoading} user={user} />
            <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setInstructionsModalOpen(false)} />
            <LearnedWordsModal isOpen={isLearnedWordsModalOpen} onClose={() => setLearnedWordsModalOpen(false)} learnedWords={[]} lang1="" lang2="" />
            <ProfileModal isOpen={isProfileModalOpen} onClose={() => setProfileModalOpen(false)} currentStats={currentDictionaryStats} allTimeStats={allTimeStats} dictionaryName={loadedDictionary?.name || ""} onResetAllStats={() => {}} />
            {showWelcomeToast && welcomeStats && <StudyStatsToast streak={welcomeStats.streak} wordsLearned={welcomeStats.lastSessionCount} onClose={() => setShowWelcomeToast(false)} />}
        </main>
    );
};

export default App;
