import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
// FIX: Switched to Firebase v9 compat API for Firestore to resolve module errors.
import { auth, db, firebase } from './lib/firebase-client';
import { Flashcard } from './components/Flashcard';
import { ProgressBar } from './components/ProgressBar';
import { SetSelector } from './components/SetSelector';
import { FileSourceModal } from './components/FileSourceModal';
import { InstructionsModal } from './components/InstructionsModal';
import { LearnedWordsModal } from './components/LearnedWordsModal';
import { ProfileModal } from './components/ProfileModal';
// Removed ChatModal import
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


// --- Constants ---
const SRS_INTERVALS = [1, 2, 4, 8, 16, 32, 64]; // in days

// Custom ProfileStats type definition for clarity
interface ProfileStats {
    totalWords: number;
    learnedCount: number;
    dontKnowCount: number;
    remainingCount: number;
    learnedPercentage: number;
    remainingPercentage: number;
    dictionaryCount?: number;
}

// Custom hook to get the previous value of a prop or state.
function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined);
    useEffect(() => {
        ref.current = value;
    }, [value]);
    return ref.current;
}


// --- Helper Functions for Stats ---
const calculateStreak = (history: string[]): number => {
    if (!history || history.length === 0) return 0;

    const sortedDates = [...new Set(history)].map(d => new Date(d)).sort((a, b) => b.getTime() - a.getTime());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    // Streak is valid if the last session was today or yesterday
    if (sortedDates[0].getTime() !== today.getTime() && sortedDates[0].getTime() !== yesterday.getTime()) {
        return 0;
    }

    let streak = 1;
    for (let i = 0; i < sortedDates.length - 1; i++) {
        const current = sortedDates[i];
        const next = sortedDates[i + 1];

        const diffTime = current.getTime() - next.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            streak++;
        } else {
            break; // Gap found, streak ends
        }
    }
    return streak;
};

const getLastSessionCount = (history: string[], dailyData: { [key: string]: { newWordsLearned: number } }): number => {
    if (!history || history.length === 0) return 0;
    const sortedDates = [...new Set(history)].sort((a, b) => b.localeCompare(a));
    const lastDate = sortedDates[0];
    return dailyData[lastDate]?.newWordsLearned || 0;
};

// Helper for all-time stats calculation
const aggregateProgress = (
    acc: { totalWords: number; learnedCount: number; dontKnowCount: number },
    progress: any
) => {
    acc.totalWords += progress.totalWordsInDict || 0;
    acc.learnedCount += progress.learnedWords ? Object.keys(progress.learnedWords).length : 0;

    const dontKnowInDict = new Set<string>();
    if (progress.dontKnowWords) {
        const wordsLists = Object.values(progress.dontKnowWords);
        for (const wordArray of wordsLists) {
            if (Array.isArray(wordArray)) {
                for (const word of (wordArray as Word[])) {
                    dontKnowInDict.add(getWordId(word));
                }
            }
        }
    }
    acc.dontKnowCount += dontKnowInDict.size;
    return acc;
};


// --- Main App Component ---
const App: React.FC = () => {
    const [user, authLoading] = useAuthState(auth as any); // Cast to any to avoid type mismatch errors
    const [loadedDictionary, setLoadedDictionary] = useState<LoadedDictionary | null>(null);
    const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [reviewWords, setReviewWords] = useState<Word[]>([]);
    const [isShuffled, setIsShuffled] = useState(false);


    // States for session progress tracking
    const [sessionProgress, setSessionProgress] = useState(0);
    const [sessionTotal, setSessionTotal] = useState(0);
    const [sessionActive, setSessionActive] = useState(false);

    const [learnedWords, setLearnedWords] = useState<Map<string, WordProgress>>(new Map());
    const [dontKnowWords, setDontKnowWords] = useState<Map<number, Word[]>>(new Map());
    const [wordStats, setWordStats] = useState<Map<string, WordStats>>(new Map());
    const [sentences, setSentences] = useState<Map<string, string>>(new Map());

    const [isLoading, setIsLoading] = useState(false); // For file parsing and dictionary loading
    const [isInitialLoading, setIsInitialLoading] = useState(true); // For loading the last used dictionary on startup
    const [isProgressLoading, setIsProgressLoading] = useState(true); // For Firestore progress
    const [isWordListVisible, setIsWordListVisible] = useState(false);
    const [isDontKnowMode, setIsDontKnowMode] = useState(false);
    const [isPracticeMode, setIsPracticeMode] = useState(false); // For re-studying without saving progress
    const [isChangingWord, setIsChangingWord] = useState(false); // For fade animation
    const [isInstantChange, setIsInstantChange] = useState(false); // For instant card change
    const [progressSaveCounter, setProgressSaveCounter] = useState(0); // Trigger for all-time stats refresh

    // State for Training Mode input
    const [userAnswer, setUserAnswer] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('idle');
    const [trainingMode, setTrainingMode] = useState<'write' | 'guess'>('write');
    const [translationMode, setTranslationMode] = useState<TranslationMode>('standard');
    const [guessOptions, setGuessOptions] = useState<string[]>([]);

    // AI Integration States
    const [isGeneratingSentence, setIsGeneratingSentence] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [isValidatingAnswer, setIsValidatingAnswer] = useState(false);
    const [aiFeedback, setAiFeedback] = useState<string>('');

    const [isFileSourceModalOpen, setFileSourceModalOpen] = useState(false);
    const [isInstructionsModalOpen, setInstructionsModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setLearnedWordsModalOpen] = useState(false);
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);
    // Removed isChatModalOpen state
    const [theme, setTheme] = useState<Theme>('dark');
    const [allTimeStats, setAllTimeStats] = useState<ProfileStats | null>(null);

    // State for welcome toast & streak
    const [currentStreak, setCurrentStreak] = useState(0);
    const [welcomeStats, setWelcomeStats] = useState<{ streak: number; lastSessionCount: number } | null>(null);
    const [showWelcomeToast, setShowWelcomeToast] = useState(false);

    // State for UX Improvements
    const [isZenMode, setIsZenMode] = useState(false);
    // Sound state
    const [isMuted, setIsMuted] = useState(sounds.getMuted());

    // State to manage sync on login
    const [isSyncing, setIsSyncing] = useState(false);
    const prevUser = usePrevious(user);

    // Effect to set initial theme from localStorage or system preference
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as Theme | null;
        const systemPrefersDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme) {
            setTheme(savedTheme);
        } else if (systemPrefersDark) {
            setTheme('dark');
        } else {
            setTheme('light');
        }
    }, []);

    // Effect to apply theme class to <html> and save to localStorage
    useEffect(() => {
        const root = globalThis.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);


    const dictionaryId = useMemo(() => loadedDictionary?.name.replace(/[./]/g, '_'), [loadedDictionary]);

    // --- History and Auto-loading Logic ---

    const saveLastUsedDictionary = useCallback(async (name: string) => {
        if (user) {
            const userDocRef = db.collection('users').doc(user.uid);
            await userDocRef.set({ lastUsedDictionary: name }, { merge: true });
        } else {
            localStorage.setItem('lastUsedDictionary', name);
        }
    }, [user]);

    const clearLastUsedDictionary = useCallback(async () => {
        if (user) {
            const userDocRef = db.collection('users').doc(user.uid);
            await userDocRef.set({ lastUsedDictionary: null }, { merge: true });
        } else {
            localStorage.removeItem('lastUsedDictionary');
        }
    }, [user]);

    // Helper to parse sentences from file
    const parseSentencesFile = async (sentencesFile: File): Promise<Map<string, string>> => {
        const text = await sentencesFile.text();
        const jsonObj = JSON.parse(text);
        const sentenceMap = new Map<string, string>();
        for (const key in jsonObj) {
            if (typeof jsonObj[key] === 'string') {
                sentenceMap.set(key.trim().toLowerCase(), jsonObj[key]);
            }
        }
        return sentenceMap;
    }

    const loadAndSetDictionary = useCallback(async (name: string, wordsFile: File, sentencesFile?: File) => {
        setIsLoading(true);
        setIsProgressLoading(true);
        try {
            let sentenceMapFromFile: Map<string, string> | null = null;
            if (sentencesFile) {
                sentenceMapFromFile = await parseSentencesFile(sentencesFile);
            }

            setLearnedWords(new Map());
            setDontKnowWords(new Map());
            setWordStats(new Map());
            if (sentenceMapFromFile) {
                setSentences(prev => new Map([...prev, ...sentenceMapFromFile]));
            }

            const dictionary = await parseDictionaryFile(wordsFile);
            dictionary.name = name;
            setLoadedDictionary(dictionary);
            setSelectedSetIndex(0);
            setFileSourceModalOpen(false);
            setSessionActive(false);

            await saveLastUsedDictionary(name);

        } catch (error) {
            alert((error as Error).message);
            setLoadedDictionary(null);
            setIsProgressLoading(false);
        } finally {
            setIsLoading(false);
        }
    }, [saveLastUsedDictionary]);


    useEffect(() => {
        const loadLastDictionary = async () => {
            if (authLoading) return;

            let lastUsedDictName: string | null = null;
            if (user) {
                const userDocRef = db.collection('users').doc(user.uid);
                const docSnap = await userDocRef.get();
                if (docSnap.exists) {
                    lastUsedDictName = docSnap.data()?.lastUsedDictionary || null;
                }
            } else {
                lastUsedDictName = localStorage.getItem('lastUsedDictionary');
            }

            if (lastUsedDictName) {
                try {
                    const savedDict = await getDictionary(lastUsedDictName, user?.uid);
                    if (savedDict) {
                        await loadAndSetDictionary(savedDict.name, savedDict.file);
                    } else {
                        await clearLastUsedDictionary();
                    }
                } catch (error) {
                    console.error("Failed to load last used dictionary:", error);
                    await clearLastUsedDictionary();
                }
            }
            setIsInitialLoading(false);
        };

        loadLastDictionary();
    }, [user, authLoading, loadAndSetDictionary, clearLastUsedDictionary]);

    // --- End History Logic ---


    // --- Study Stats and Welcome Message ---
    useEffect(() => {
        if (!user || authLoading) return;

        const fetchUserStats = async () => {
            const userDocRef = db.collection('users').doc(user.uid);
            try {
                const docSnap = await userDocRef.get();
                if (docSnap.exists) {
                    const data = docSnap.data();
                    if (data) {
                        const history = data.studyHistory || [];
                        const dailyData = data.dailyStats || {};

                        const streak = calculateStreak(history);
                        setCurrentStreak(streak);
                        const lastSessionCount = getLastSessionCount(history, dailyData);

                        if (streak > 0 || lastSessionCount > 0) {
                            setWelcomeStats({ streak, lastSessionCount });
                            setShowWelcomeToast(true);
                        }
                    }
                }
            } catch (error) {
                console.error("Failed to fetch user stats for welcome message:", error);
            }
        };

        fetchUserStats();
    }, [user, authLoading]);

    const recordStudyActivity = useCallback(async (isNewWord: boolean) => {
        if (!user) return;

        const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const userDocRef = db.collection('users').doc(user.uid);

        try {
            const updates: { [key: string]: any } = {
                studyHistory: firebase.firestore.FieldValue.arrayUnion(todayStr)
            };

            if (isNewWord) {
                updates[`dailyStats.${todayStr}.newWordsLearned`] = firebase.firestore.FieldValue.increment(1);
            }

            await userDocRef.set(updates, { merge: true });

        } catch (error) {
            console.error("Failed to record study activity:", error);
        }
    }, [user]);

    // --- End Study Stats ---


    // Load sentences from Firestore (for logged-in users) or IndexedDB (for anonymous users)
    useEffect(() => {
        const loadUserSentences = async () => {
            if (authLoading) return;

            if (user) {
                const userDocRef = db.collection('users').doc(user.uid);
                try {
                    const docSnap = await userDocRef.get();
                    if (docSnap.exists) {
                        const data = docSnap.data();
                        if (data && data.globalSentences) {
                            setSentences(new Map(Object.entries(data.globalSentences)));
                        } else {
                            setSentences(new Map());
                        }
                    }
                } catch (error) {
                    console.error("Error loading sentences from Firestore:", error);
                    setSentences(new Map());
                }
            } else {
                try {
                    const localSentences = await loadLocalSentences('local');
                    setSentences(localSentences);
                } catch (error) {
                    console.error("Error loading local sentences:", error);
                    setSentences(new Map());
                }
            }
        };
        loadUserSentences();
    }, [user, authLoading]);

    // Save sentences to Firestore or IndexedDB, with debouncing
    useEffect(() => {
        if (authLoading) return;

        const handler = setTimeout(async () => {
            if (user) {
                const userDocRef = db.collection('users').doc(user.uid);
                try {
                    await userDocRef.set({
                        globalSentences: Object.fromEntries(sentences)
                    }, { merge: true });
                } catch (error) {
                    console.error("Error saving sentences to Firestore:", error);
                }
            } else {
                try {
                    await saveLocalSentences('local', sentences);
                } catch (error) {
                    console.error("Error saving local sentences:", error);
                }
            }
        }, 1500);

        return () => clearTimeout(handler);
    }, [sentences, user, authLoading]);

    // Effect to handle merging local progress to remote on login
    useEffect(() => {
        const syncOnLogin = async () => {
            if (user && !prevUser && dictionaryId) {
                setIsSyncing(true);
                try {
                    const localData = await loadLocalProgress(dictionaryId);
                    const docRef = db.collection('users').doc(user.uid).collection('progress').doc(dictionaryId);
                    const docSnap = await docRef.get();

                    const localLearned = localData?.learnedWords ? new Map(Object.entries(localData.learnedWords)) : new Map<string, WordProgress>();
                    const localDontKnow = localData?.dontKnowWords ? new Map(Object.entries(localData.dontKnowWords).map(([k, v]) => [Number(k), v as Word[]])) : new Map<number, Word[]>();
                    const localStats = localData?.wordStats ? new Map(Object.entries(localData.wordStats as { [s: string]: WordStats })) : new Map<string, WordStats>();

                    const remoteData = docSnap.exists ? docSnap.data() : {};
                    const remoteLearned = remoteData?.learnedWords ? new Map(Object.entries(remoteData.learnedWords as { [s: string]: WordProgress; })) : new Map<string, WordProgress>();
                    const remoteDontKnow = remoteData?.dontKnowWords ? new Map(Object.entries(remoteData.dontKnowWords).map(([k, v]) => [Number(k), v as Word[]])) : new Map<number, Word[]>();
                    const remoteStats = remoteData?.wordStats ? new Map(Object.entries(remoteData.wordStats as { [s: string]: WordStats })) : new Map<string, WordStats>();

                    const mergedLearned = new Map([...localLearned, ...remoteLearned]);

                    const mergedDontKnow = new Map<number, Word[]>();
                    const allDontKnowKeys = new Set([...localDontKnow.keys(), ...remoteDontKnow.keys()]);

                    for (const key of allDontKnowKeys) {
                        const localWords = localDontKnow.get(key) || [];
                        const remoteWords = remoteDontKnow.get(key) || [];
                        const combined = [...localWords, ...remoteWords];
                        const uniqueWords = Array.from(new Map(combined.map(w => [getWordId(w), w])).values());
                        mergedDontKnow.set(key, uniqueWords);
                    }

                    const mergedStats = new Map<string, WordStats>(localStats);
                    for (const [wordId, stats] of remoteStats) {
                        const local = mergedStats.get(wordId);
                        if (local) {
                            mergedStats.set(wordId, {
                                knowCount: local.knowCount + stats.knowCount,
                                totalAttempts: local.totalAttempts + stats.totalAttempts,
                            });
                        } else {
                            mergedStats.set(wordId, stats);
                        }
                    }

                    setLearnedWords(mergedLearned);
                    setDontKnowWords(mergedDontKnow);
                    setWordStats(mergedStats);

                    if (localData) {
                        await deleteLocalProgress(dictionaryId);
                    }
                } catch (error) {
                    console.error("Error during login sync:", error);
                } finally {
                    setIsSyncing(false);
                }
            }
        };

        syncOnLogin();
    }, [user, prevUser, dictionaryId]);


    // Load DICTIONARY-SPECIFIC progress from Firestore or Local Storage
    useEffect(() => {
        const loadProgress = async () => {
            if (!dictionaryId || isSyncing) {
                if(!dictionaryId) {
                    setLearnedWords(new Map());
                    setDontKnowWords(new Map());
                    setWordStats(new Map());
                }
                return;
            }

            setIsProgressLoading(true);
            try {
                if (user) {
                    const docRef = db.collection('users').doc(user.uid).collection('progress').doc(dictionaryId);
                    const docSnap = await docRef.get();
                    if (docSnap.exists) {
                        const data = docSnap.data();
                        const learnedData = data?.learnedWords || {};
                        setLearnedWords(new Map(Object.entries(learnedData)));
                        const dontKnowData = data?.dontKnowWords || {};
                        const dontKnowMap = new Map(
                            Object.entries(dontKnowData).map(([key, value]) => [Number(key), value as Word[]])
                        );
                        setDontKnowWords(dontKnowMap);
                        const statsData = (data?.wordStats || {}) as {[key: string]: WordStats};
                        setWordStats(new Map(Object.entries(statsData)));

                    } else {
                        setLearnedWords(new Map());
                        setDontKnowWords(new Map());
                        setWordStats(new Map());
                    }
                } else {
                    const localProgress = await loadLocalProgress(dictionaryId);
                    if (localProgress) {
                        const learnedData = localProgress.learnedWords || {};
                        setLearnedWords(new Map(Object.entries(learnedData)));
                        const dontKnowData = localProgress.dontKnowWords || {};
                        const dontKnowMap = new Map(
                            Object.entries(dontKnowData).map(([key, value]) => [Number(key), value as Word[]])
                        );
                        setDontKnowWords(dontKnowMap);
                        const statsData = (localProgress.wordStats || {}) as {[key: string]: WordStats};
                        setWordStats(new Map(Object.entries(statsData)));
                    } else {
                        setLearnedWords(new Map());
                        setDontKnowWords(new Map());
                        setWordStats(new Map());
                    }
                }
            } catch (error) {
                console.error("Error loading progress:", error);
                setLearnedWords(new Map());
                setDontKnowWords(new Map());
                setWordStats(new Map());
            } finally {
                setIsProgressLoading(false);
            }
        };

        loadProgress();
    }, [user, dictionaryId, isSyncing]);


    const currentDictionaryStats = useMemo<ProfileStats | null>(() => {
        if (!loadedDictionary) return null;
        const totalWords = loadedDictionary.sets.reduce((sum, set) => sum + set.words.length, 0);
        const learnedCount = learnedWords.size;

        const allDontKnowWords = new Set<string>();
        for (const wordArray of dontKnowWords.values()) {
            for (const word of wordArray) {
                allDontKnowWords.add(getWordId(word));
            }
        }
        const dontKnowCount = allDontKnowWords.size;

        const remainingCount = totalWords - learnedCount;

        return {
            totalWords,
            learnedCount,
            dontKnowCount,
            remainingCount,
            learnedPercentage: totalWords > 0 ? (learnedCount / totalWords) * 100 : 0,
            remainingPercentage: totalWords > 0 ? (remainingCount / totalWords) * 100 : 0,
        };
    }, [loadedDictionary, learnedWords, dontKnowWords]);

    // Save DICTIONARY-SPECIFIC progress to Firestore or Local Storage
    useEffect(() => {
        if (isProgressLoading || !dictionaryId) {
            return;
        }

        const handler = setTimeout(async () => {
            const dataToSave = {
                learnedWords: Object.fromEntries(learnedWords),
                dontKnowWords: Object.fromEntries(dontKnowWords),
                wordStats: Object.fromEntries(wordStats),
            };
            const totalWordsInDict = currentDictionaryStats?.totalWords;

            if (user) {
                const docRef = db.collection('users').doc(user.uid).collection('progress').doc(dictionaryId);
                try {
                    await docRef.set({ ...dataToSave, totalWordsInDict }, { merge: true });
                } catch (error) {
                    console.error("Error saving dictionary progress to Firestore:", error);
                }
            } else {
                try {
                    await saveLocalProgress(dictionaryId, { ...dataToSave, totalWordsInDict });
                } catch (error) {
                    console.error("Error saving local progress:", error);
                }
            }
            setProgressSaveCounter(c => c + 1); // Trigger all-time stats refresh
        }, 1500);

        return () => clearTimeout(handler);
    }, [learnedWords, dontKnowWords, wordStats, user, dictionaryId, isProgressLoading, currentDictionaryStats]);

    // Effect to calculate all-time stats
    useEffect(() => {
        const calculateAllTimeStats = async () => {
            if (authLoading) return; // Wait for auth state to be resolved
            let allProgressData: any[] = [];

            try {
                if (user) {
                    const progressColRef = db.collection('users').doc(user.uid).collection('progress');
                    const querySnapshot = await progressColRef.get();
                    querySnapshot.forEach(doc => allProgressData.push(doc.data()));
                } else {
                    allProgressData = await loadAllLocalProgress();
                }

                if (allProgressData.length > 0) {
                    const aggregated = allProgressData.reduce(aggregateProgress, { totalWords: 0, learnedCount: 0, dontKnowCount: 0 });
                    const remaining = aggregated.totalWords - aggregated.learnedCount;
                    const safeRemaining = Math.max(0, remaining);

                    setAllTimeStats({
                        dictionaryCount: allProgressData.length,
                        totalWords: aggregated.totalWords,
                        learnedCount: aggregated.learnedCount,
                        dontKnowCount: aggregated.dontKnowCount,
                        remainingCount: safeRemaining,
                        learnedPercentage: aggregated.totalWords > 0 ? (aggregated.learnedCount / aggregated.totalWords) * 100 : 0,
                        remainingPercentage: aggregated.totalWords > 0 ? (safeRemaining / aggregated.totalWords) * 100 : 0,
                    });
                } else {
                    setAllTimeStats(null);
                }
            } catch (error) {
                console.error("Failed to calculate all-time stats:", error);
                setAllTimeStats(null);
            }
        };

        calculateAllTimeStats();
    }, [user, authLoading, progressSaveCounter]);

    const handleResetAllStats = async () => {
        if (globalThis.confirm('Are you sure you want to reset ALL your statistics across ALL dictionaries? This action cannot be undone.')) {
            setIsProgressLoading(true);
            try {
                if (user) {
                    const progressColRef = db.collection('users').doc(user.uid).collection('progress');
                    const querySnapshot = await progressColRef.get();
                    const deletePromises = querySnapshot.docs.map(doc => doc.ref.delete());
                    await Promise.all(deletePromises);
                } else {
                    await clearAllLocalProgress();
                }

                setLearnedWords(new Map());
                setDontKnowWords(new Map());

                setAllTimeStats(null);
                setProgressSaveCounter(c => c + 1);

                alert('All statistics have been reset.');

            } catch (error) {
                console.error("Failed to reset all stats:", error);
                alert("An error occurred while resetting statistics. Please try again.");
            } finally {
                setIsProgressLoading(false);
                setProfileModalOpen(false);
            }
        }
    };

    const currentSet = useMemo(() => selectedSetIndex !== null ? loadedDictionary?.sets[selectedSetIndex] : null, [selectedSetIndex, loadedDictionary]);

    const generateGuessOptions = useCallback((correctWord: Word) => {
        if (!currentSet || !loadedDictionary) return;

        const isStandardMode = translationMode === 'standard';
        const correctTranslation = isStandardMode ? correctWord.lang2 : correctWord.lang1;
        const correctWordId = getWordId(correctWord);

        const originalSetIndex = currentSet.originalSetIndex;
        const allWordsInOriginalSet = loadedDictionary.sets
            .filter(s => s.originalSetIndex === originalSetIndex)
            .flatMap(s => s.words);

        let distractors = allWordsInOriginalSet
            .filter(w => getWordId(w) !== correctWordId)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);

        if (distractors.length < 3) {
            const fallbackDistractors = loadedDictionary.sets
                .flatMap(s => s.words)
                .filter(w => getWordId(w) !== correctWordId && !distractors.some(d => getWordId(d) === getWordId(w)))
                .sort(() => 0.5 - Math.random())
                .slice(0, 3 - distractors.length);
            distractors.push(...fallbackDistractors);
        }

        const options = shuffleArray([
            correctTranslation,
            ...distractors.map(d => isStandardMode ? d.lang2 : d.lang1)
        ]);
        setGuessOptions(options);
    }, [currentSet, loadedDictionary, translationMode]);

    const updateWordIndex = () => {
        const nextIndex = currentWordIndex + 1;
        if (nextIndex < reviewWords.length) {
            setCurrentWordIndex(nextIndex);
            setSessionProgress(prev => prev + 1);
            if (isDontKnowMode && trainingMode === 'guess') {
                generateGuessOptions(reviewWords[nextIndex]);
            }
        } else {
            setReviewWords([]);
            sounds.play('success'); // Play sound on session completion
            setSessionActive(false); // End session
            setIsPracticeMode(false); // Exit practice mode
        }
    };

    const startReviewSession = useCallback((setIndex: number) => {
        if (!loadedDictionary) return;
        const set = loadedDictionary.sets[setIndex];
        const now = new Date().toISOString();
        const wordsForReview = set.words.filter(word => {
            const wordId = getWordId(word);
            const progress = learnedWords.get(wordId);
            return !progress || progress.nextReviewDate <= now;
        });

        setIsShuffled(false);
        setIsPracticeMode(false);
        if (wordsForReview.length > 0) {
            setReviewWords(wordsForReview);
            setSessionTotal(wordsForReview.length);
            setSessionProgress(1);
            setCurrentWordIndex(0);
            setIsFlipped(false);
            setIsDontKnowMode(false);
            setSessionActive(true);
        } else {
            setReviewWords([]);
            setSessionTotal(0);
            setSessionProgress(0);
            setSessionActive(false);
        }
    }, [loadedDictionary, learnedWords]);

    const currentWord = useMemo(() => reviewWords[currentWordIndex], [reviewWords, currentWordIndex]);

    useEffect(() => {
        if (selectedSetIndex !== null && !isProgressLoading && !sessionActive) {
            startReviewSession(selectedSetIndex);
        }
    }, [selectedSetIndex, isProgressLoading, sessionActive, startReviewSession]);

    useEffect(() => {
        if (isDontKnowMode && trainingMode === 'guess' && currentWord) {
            const currentCorrectAnswer = translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1;
            if (!guessOptions.includes(currentCorrectAnswer)) {
                generateGuessOptions(currentWord);
            }
        }
    }, [trainingMode, isDontKnowMode, currentWord, guessOptions, generateGuessOptions, translationMode]);

    const handleFilesSelect = async (name: string, wordsFile: File, sentencesFile?: File) => {
        await loadAndSetDictionary(name, wordsFile, sentencesFile);
    };

    const exampleSentence = useMemo(() => currentWord ? sentences.get(currentWord.lang2.toLowerCase()) : undefined, [currentWord, sentences]);
    const totalLearnedCount = useMemo(() => learnedWords.size, [learnedWords]);

    const staticCardNumber = useMemo(() => {
        if (!currentSet || !currentWord) return 0;
        return currentSet.words.findIndex(w => getWordId(w) === getWordId(currentWord)) + 1;
    }, [currentSet, currentWord]);

    const staticTotalCards = useMemo(() => {
        return currentSet ? currentSet.words.length : 0;
    }, [currentSet]);

    const learnedWordsWithDetails = useMemo(() => {
        if (!loadedDictionary) return [];
        const allWords = new Map<string, Word>();
        for (const set of loadedDictionary.sets) {
            for (const word of set.words) {
                allWords.set(getWordId(word), word);
            }
        }
        return Array.from(learnedWords.entries())
            .map(([id, progress]) => {
                const word = allWords.get(id);
                return word ? { ...word, progress } : null;
            })
            .filter((item): item is Word & { progress: WordProgress } => item !== null)
            .sort((a, b) => a.lang2.localeCompare(b.lang2));
    }, [learnedWords, loadedDictionary]);


    const advanceToNextWord = (updateLogic: () => boolean, instant = false) => {
        if (!currentWord || isChangingWord || isInstantChange) return;
        if (!updateLogic()) return;

        if (instant) {
            setIsInstantChange(true);
            setIsFlipped(false);
            updateWordIndex();

            requestAnimationFrame(() => {
                setIsInstantChange(false);
            });
        } else {
            setIsChangingWord(true);
            setTimeout(() => {
                updateWordIndex();
                setIsFlipped(false);
                setIsChangingWord(false);
            }, 250);
        }
    };

    const handleKnow = () => {
        sounds.play('correct');
        if (isPracticeMode) {
            advanceToNextWord(() => true, isFlipped);
            return;
        }
        const isNewlyLearned = !learnedWords.has(getWordId(currentWord));
        recordStudyActivity(isNewlyLearned);
        advanceToNextWord(() => {
            const wordId = getWordId(currentWord);

            setWordStats(prev => {
                const newMap = new Map<string, WordStats>(prev);
                const stats = newMap.get(wordId) || { knowCount: 0, totalAttempts: 0 };
                newMap.set(wordId, {
                    knowCount: stats.knowCount + 1,
                    totalAttempts: stats.totalAttempts + 1,
                });
                return newMap;
            });

            const progress = learnedWords.get(wordId);
            const currentStage = progress ? progress.srsStage : -1;
            const nextStage = Math.min(currentStage + 1, SRS_INTERVALS.length - 1);
            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + SRS_INTERVALS[nextStage]);
            setLearnedWords(prev => new Map(prev).set(wordId, { srsStage: nextStage, nextReviewDate: nextReviewDate.toISOString() }));

            if (isDontKnowMode && selectedSetIndex !== null) {
                setDontKnowWords((prev: Map<number, Word[]>) => {
                    const newMap = new Map(prev);
                    const currentMistakes = newMap.get(selectedSetIndex) || [];
                    const updatedMistakes = currentMistakes.filter(w => getWordId(w) !== wordId);

                    if (updatedMistakes.length > 0) {
                        newMap.set(selectedSetIndex, updatedMistakes);
                    } else {
                        newMap.delete(selectedSetIndex);
                    }
                    return newMap;
                });
            }
            return true;
        }, isFlipped);
    };

    const handleDontKnow = () => {
        sounds.play('incorrect');
        if (isPracticeMode) {
            advanceToNextWord(() => true, isFlipped);
            return;
        }
        recordStudyActivity(false);
        advanceToNextWord(() => {
            if (selectedSetIndex === null) return false;
            const wordId = getWordId(currentWord);

            setWordStats(prev => {
                const newMap = new Map<string, WordStats>(prev);
                const stats = newMap.get(wordId) || { knowCount: 0, totalAttempts: 0 };
                newMap.set(wordId, {
                    knowCount: stats.knowCount,
                    totalAttempts: stats.totalAttempts + 1,
                });
                return newMap;
            });

            if (learnedWords.has(wordId)) {
                setLearnedWords(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(wordId);
                    return newMap;
                });
            }
            if (!isDontKnowMode) {
                setDontKnowWords((prev: Map<number, Word[]>) => {
                    const newMap = new Map(prev);
                    const currentList = newMap.get(selectedSetIndex) || [];
                    if (!currentList.some(w => getWordId(w) === wordId)) {
                        newMap.set(selectedSetIndex, [...currentList, currentWord]);
                    }
                    return newMap;
                });
            }
            return true;
        }, isFlipped);
    };

    const handleFlip = useCallback(() => {
        if (isDontKnowMode && answerState !== 'idle' && trainingMode === 'write') return;
        if (isDontKnowMode && trainingMode === 'guess' && isFlipped) return;

        sounds.play('flip');
        setIsFlipped(prev => !prev);
    }, [isDontKnowMode, answerState, trainingMode, isFlipped]);

    const handleSelectSet = (index: number) => {
        if (index !== selectedSetIndex) {
            setSessionActive(false);
            setIsPracticeMode(false);
            setSelectedSetIndex(index);
        }
    };

    const handleShuffle = () => {
        sounds.play('click');
        setReviewWords(shuffleArray(reviewWords));
        setIsShuffled(true);
    };

    const startDontKnowSession = () => {
        if (selectedSetIndex === null) return;
        const words = dontKnowWords.get(selectedSetIndex) || [];
        if (words.length > 0) {
            const shuffledWords = shuffleArray(words);
            setReviewWords(shuffledWords);
            setSessionTotal(words.length);
            setSessionProgress(words.length > 0 ? 1 : 0);
            setCurrentWordIndex(0);
            setIsFlipped(false);
            setAnswerState('idle');
            setUserAnswer('');
            setAiFeedback('');
            setIsDontKnowMode(true);
            setIsPracticeMode(false);
            setSessionActive(true);
            setIsShuffled(false);
            if (trainingMode === 'guess') {
                generateGuessOptions(shuffledWords[0]);
            }
        }
    };

    const startPracticeSession = () => {
        if (!currentSet) return;
        const allWordsInSet = currentSet.words;
        if (allWordsInSet.length > 0) {
            const shuffledWords = shuffleArray(allWordsInSet);
            setReviewWords(shuffledWords);
            setSessionTotal(allWordsInSet.length);
            setSessionProgress(1);
            setCurrentWordIndex(0);
            setIsFlipped(false);
            setIsDontKnowMode(false);
            setIsPracticeMode(true);
            setSessionActive(true);
            setIsShuffled(true);
        }
    };

    const handleMuteToggle = () => {
        const newVal = sounds.toggleMute();
        setIsMuted(newVal);
    };

    // --- Keyboard Shortcuts ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!sessionActive) return;

            // Ignore shortcuts if user is typing in an input field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space') {
                e.preventDefault(); // Prevent scrolling
                handleFlip();
            } else if (e.key === '1' || e.key === 'ArrowLeft') {
                if (!isDontKnowMode) handleDontKnow(); // Only work in standard mode
            } else if (e.key === '2' || e.key === 'ArrowRight') {
                if (!isDontKnowMode) handleKnow(); // Only work in standard mode
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sessionActive, isDontKnowMode, handleFlip, handleDontKnow, handleKnow]);


    const handleTrainingAnswer = async () => {
        if (!currentWord || answerState !== 'idle') return;

        const correctAnswer = translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1;
        const simpleIsCorrect = userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase();

        let finalIsCorrect = simpleIsCorrect;
        let finalFeedback = '';

        // Smart check with AI if simple match fails and we are in Write mode
        if (!simpleIsCorrect && trainingMode === 'write') {
            setIsValidatingAnswer(true);
            try {
                const aiResult = await validateAnswerWithAI(userAnswer, correctAnswer);
                finalIsCorrect = aiResult.isCorrect;
                finalFeedback = aiResult.feedback;
            } catch (e) {
                console.error("AI Validation Failed", e);
                // Fallback to incorrect if AI fails
            } finally {
                setIsValidatingAnswer(false);
            }
        }

        recordStudyActivity(finalIsCorrect && !learnedWords.has(getWordId(currentWord)));
        setAiFeedback(finalFeedback);

        if (finalIsCorrect) {
            setAnswerState('correct');
            sounds.play('correct');
            handleKnow();

            setTimeout(() => {
                setIsFlipped(false);
                setAnswerState('idle');
                setUserAnswer('');
                setAiFeedback('');
            }, 1000 + (finalFeedback ? 2000 : 0)); // Extra time to read AI feedback
        } else {
            setAnswerState('incorrect');
            sounds.play('incorrect');
            setIsFlipped(true);
        }
    };

    const handleTrainingNext = () => {
        sounds.play('click');
        advanceToNextWord(() => {
            setAnswerState('idle');
            setUserAnswer('');
            setAiFeedback('');
            return true;
        }, isFlipped);
    };

    const handleGuess = (isCorrect: boolean) => {
        recordStudyActivity(isCorrect && !learnedWords.has(getWordId(currentWord)));
        const wordId = getWordId(currentWord);

        setWordStats(prev => {
            const newMap = new Map<string, WordStats>(prev);
            const stats = newMap.get(wordId) || { knowCount: 0, totalAttempts: 0 };
            newMap.set(wordId, {
                knowCount: stats.knowCount + (isCorrect ? 1 : 0),
                totalAttempts: stats.totalAttempts + 1,
            });
            return newMap;
        });

        if (isCorrect) {
            sounds.play('correct');
            const progress = learnedWords.get(wordId);
            const currentStage = progress ? progress.srsStage : -1;
            const nextStage = Math.min(currentStage + 1, SRS_INTERVALS.length - 1);
            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + SRS_INTERVALS[nextStage]);
            setLearnedWords(prev => new Map(prev).set(wordId, { srsStage: nextStage, nextReviewDate: nextReviewDate.toISOString() }));

            if (isDontKnowMode && selectedSetIndex !== null) {
                setDontKnowWords((prev: Map<number, Word[]>) => {
                    const newMap = new Map(prev);
                    const currentMistakes = newMap.get(selectedSetIndex) || [];
                    const updatedMistakes = currentMistakes.filter(w => getWordId(w) !== wordId);

                    if (updatedMistakes.length > 0) {
                        newMap.set(selectedSetIndex, updatedMistakes);
                    } else {
                        newMap.delete(selectedSetIndex);
                    }
                    return newMap;
                });
            }
        } else {
            sounds.play('incorrect');
            setIsFlipped(true);
        }
    };

    const handleGenerateSentence = async () => {
        if (!currentWord) return;
        setIsGeneratingSentence(true);
        setGenerationError(null);
        try {
            // Assume lang2 is the target language for examples (typically English)
            const sentence = await generateExampleSentence(currentWord.lang2);
            if (sentence) {
                setSentences(prev => new Map(prev).set(currentWord.lang2.toLowerCase(), sentence));
                sounds.play('success');
            } else {
                // If the sentence is empty, it means generation returned empty string (handled in catch usually, but safe check)
                setGenerationError("The AI returned an empty response.");
            }
        } catch (e: any) {
            console.error(e);
            setGenerationError(e.message || "Failed to generate sentence");
        } finally {
            setIsGeneratingSentence(false);
        }
    };


    const handleResetProgress = async () => {
        if (globalThis.confirm('Are you sure you want to reset learning progress for this dictionary? This action cannot be undone.')) {
            if (!user && dictionaryId) {
                try {
                    await deleteLocalProgress(dictionaryId);
                } catch (error) {
                    console.error("Error deleting local progress:", error);
                    alert("Could not delete local progress. Please try again.");
                }
            }
            setLearnedWords(new Map());
            setDontKnowWords(new Map());
            setWordStats(new Map());
            setSessionActive(false);
        }
    };

    const handleChangeDictionary = () => {
        setLoadedDictionary(null);
        setSelectedSetIndex(null);
        setSessionActive(false);
        setFileSourceModalOpen(true);
    };

    const getCounterText = () => {
        if (isDontKnowMode) {
            return `Reviewing Mistake: ${sessionProgress} / ${sessionTotal}`;
        }
        if (staticCardNumber > 0) {
            return `Card: ${staticCardNumber} / ${staticTotalCards}`;
        }
        return '...';
    };

    const renderFlashcardSection = () => {
        if (reviewWords.length === 0 || !currentWord || !currentSet) {
            return null;
        }

        const counterText = getCounterText();
        const placeholderLang = translationMode === 'standard' ? currentSet.lang2 : currentSet.lang1;
        const correctAnswer = translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1;

        const currentWordStats = wordStats.get(getWordId(currentWord)) as WordStats | undefined;
        const knowAttempts = currentWordStats?.knowCount || 0;
        const totalAttempts = currentWordStats?.totalAttempts || 0;

        return (
            <div className="w-full flex flex-col items-center">
                <div className="w-full grid grid-cols-3 items-center gap-3 h-8 mb-2">
                    {isDontKnowMode ? (
                        <>
                            <div />
                            <TrainingModeToggle mode={trainingMode} onModeChange={(mode) => {
                                setTrainingMode(mode);
                                setIsFlipped(false);
                                setAnswerState('idle');
                                setUserAnswer('');
                            }} />
                            <div />
                        </>
                    ) : (
                        <>
                            <div className="text-left">
                                {isPracticeMode && (
                                    <span className="text-xs font-semibold uppercase tracking-wider text-sky-500 dark:text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full">
                                        Practice
                                    </span>
                                )}
                            </div>
                            <div className="flex justify-center">
                                {/* Zen Mode Toggle */}
                                <Tooltip content={isZenMode ? "Exit Zen Mode" : "Enter Zen Mode"}>
                                    <button
                                        onClick={() => setIsZenMode(!isZenMode)}
                                        className={`p-1.5 rounded-md transition-colors ${isZenMode ? 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                    >
                                        {isZenMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                    </button>
                                </Tooltip>
                            </div>
                            <div />
                        </>
                    )}
                </div>
                <div className="w-full text-center text-sm text-slate-500 dark:text-slate-400 mb-1">{counterText}</div>
                <ProgressBar current={sessionProgress} total={sessionTotal} />
                <div className={`w-full transition-all duration-300 ease-in-out transform ${isChangingWord ? 'opacity-0 -translate-x-12 scale-95 rotate-[-2deg]' : 'opacity-100 translate-x-0 scale-100 rotate-0'}`}>
                    <Flashcard
                        word={currentWord}
                        isFlipped={isFlipped}
                        onFlip={handleFlip}
                        exampleSentence={exampleSentence}
                        isChanging={isChangingWord}
                        isInstantChange={isInstantChange}
                        translationMode={translationMode}
                        lang1={currentSet.lang1}
                        knowAttempts={knowAttempts}
                        totalAttempts={totalAttempts}
                        onGenerateContext={handleGenerateSentence}
                        isGeneratingContext={isGeneratingSentence}
                        generationError={generationError}
                        onSwipeLeft={!isDontKnowMode ? handleDontKnow : undefined}
                        onSwipeRight={!isDontKnowMode ? handleKnow : undefined}
                    />
                </div>
                <div className="flex justify-center gap-4 mt-6 w-full">
                    {isDontKnowMode ? (
                        trainingMode === 'write' ? (
                            <TrainingModeInput
                                answer={userAnswer}
                                setAnswer={setUserAnswer}
                                onCheck={handleTrainingAnswer}
                                onNext={handleTrainingNext}
                                answerState={answerState}
                                placeholder={`Type the ${placeholderLang} translation...`}
                                isValidating={isValidatingAnswer}
                                aiFeedback={aiFeedback}
                            />
                        ) : (
                            <TrainingModeGuess
                                options={guessOptions}
                                correctAnswer={correctAnswer}
                                onGuess={handleGuess}
                                onNext={handleTrainingNext}
                            />
                        )
                    ) : (
                        <>
                            <Tooltip content="Mark as hard (Shortcut: 1)" className="flex-1">
                                <button onClick={handleDontKnow} disabled={isProgressLoading || isChangingWord} className="w-full py-3 text-lg font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">Don't know</button>
                            </Tooltip>
                            <Tooltip content="Mark as learned (Shortcut: 2)" className="flex-1">
                                <button onClick={handleKnow} disabled={isProgressLoading || isChangingWord} className="w-full py-3 text-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">Know</button>
                            </Tooltip>
                        </>
                    )}
                </div>
            </div>
        );
    }

    if (isInitialLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <Loader2 className="animate-spin h-12 w-12 text-indigo-500" />
                <p className="mt-4 text-slate-500 dark:text-slate-400">Loading your session...</p>
            </div>
        );
    }

    if (!loadedDictionary) {
        return (
            <div className="min-h-screen flex flex-col">
                <header className="relative z-10 w-full p-4 sm:p-6 flex justify-end">
                    <div className="flex items-center gap-2">
                        <Tooltip content="Toggle Dark Mode">
                            <ThemeToggle theme={theme} setTheme={setTheme} />
                        </Tooltip>
                        <Auth user={user} />
                    </div>
                </header>
                <main className="flex-grow flex flex-col items-center justify-center p-4 -mt-16">
                    <FileSourceModal isOpen={isFileSourceModalOpen} onClose={() => setFileSourceModalOpen(false)} onFilesSelect={handleFilesSelect} isLoading={isLoading} user={user} />
                    <div className="text-center">
                        <h1 className="text-5xl font-bold mb-4">Flashcard App</h1>
                        <p className="text-slate-500 dark:text-slate-400 mb-8">Your personal language learning assistant.</p>
                        <button onClick={() => setFileSourceModalOpen(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors">
                            Select Dictionary
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    const shuffleButtonClasses = isShuffled
        ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
        : 'text-slate-500 dark:text-slate-400';

    return (
        <main className="min-h-screen flex flex-col items-center p-4 sm:p-6 transition-colors">
            {/* HEADER - Hidden in Zen Mode */}
            {!isZenMode && (
                <header className="w-full max-w-5xl flex justify-between items-center mb-6 animate-fade-in">
                    <div className="flex items-center gap-2 sm:gap-4">
                        {/* MUTE BUTTON */}
                        <Tooltip content={isMuted ? "Unmute sounds" : "Mute sounds"}>
                            <button
                                onClick={handleMuteToggle}
                                className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800"
                            >
                                {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                            </button>
                        </Tooltip>

                        <Tooltip content="Switch to a different dictionary">
                            <button onClick={handleChangeDictionary} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <Library size={18} />
                                <span className="hidden sm:inline">Change</span>
                            </button>
                        </Tooltip>
                        <Tooltip content="View Instructions">
                            <button onClick={() => setInstructionsModalOpen(true)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <Info size={20} />
                            </button>
                        </Tooltip>
                    </div>
                    <div className="text-center">
                        <h1 className="text-lg sm:text-xl font-bold truncate max-w-[200px] sm:max-w-xs" title={loadedDictionary.name}>{loadedDictionary.name}</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Gamification: Daily Streak */}
                        <Tooltip content="Your daily study streak" position="left">
                            <div
                                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-sm transition-colors ${
                                    currentStreak > 0
                                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
                                }`}
                            >
                                <Flame
                                    size={18}
                                    className={currentStreak > 0 ? "fill-orange-500 text-orange-600" : "text-slate-400 dark:text-slate-500"}
                                />
                                <span>{currentStreak}</span>
                            </div>
                        </Tooltip>

                        <Tooltip content="Profile & Statistics" position="bottom">
                            <button onClick={() => setProfileModalOpen(true)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <UserIcon size={20} />
                            </button>
                        </Tooltip>

                        <Tooltip content="Toggle Dark Mode" position="bottom">
                            <ThemeToggle theme={theme} setTheme={setTheme} />
                        </Tooltip>
                        <Auth user={user} />
                    </div>
                </header>
            )}

            <div className="w-full max-w-md flex flex-col items-center">
                {/* Controls - Hidden in Zen Mode */}
                {!isZenMode && (
                    <div className="w-full relative flex items-center justify-center mb-4 animate-fade-in h-8">
                        {/* Center Group: Stats & Reset */}
                        <div className="flex items-center gap-4 text-sm">
                            <Tooltip content="View learned words">
                                <button onClick={() => setLearnedWordsModalOpen(true)} className="flex items-center gap-2 py-1 px-3 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700">
                                    <BookUser size={16} /> Learned: {totalLearnedCount}
                                </button>
                            </Tooltip>
                            <Tooltip content="Reset progress for this dictionary">
                                <button onClick={handleResetProgress} className="flex items-center gap-2 py-1 px-3 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700">
                                    <Trash2 size={16} /> Reset
                                </button>
                            </Tooltip>
                        </div>

                        {/* Right: Chat Button - REMOVED for this prompt iteration but likely desired */}
                        {/* <div className="absolute right-0 top-1/2 -translate-y-1/2">
                            <Tooltip content="Conversation Practice" position="left">
                                <button onClick={() => setIsChatModalOpen(true)} className="flex items-center gap-2 py-1 px-3 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-medium">
                                    <MessageCircle size={18} />
                                    <span className="hidden sm:inline">Chat</span>
                                </button>
                            </Tooltip>
                        </div> */}
                    </div>
                )}

                {/* Set Selector - Hidden in Zen Mode */}
                {!isZenMode && (
                    <SetSelector
                        sets={loadedDictionary.sets}
                        selectedSetIndex={selectedSetIndex}
                        onSelectSet={handleSelectSet}
                        learnedWords={learnedWords}
                    />
                )}

                {isProgressLoading ? (
                    <div className="w-full aspect-[3/2] flex justify-center items-center text-slate-500 dark:text-slate-400">
                        <Loader2 className="animate-spin h-8 w-8 mr-3" />
                        <span>Loading progress...</span>
                    </div>
                ) : reviewWords.length > 0 && currentWord && currentSet ? (
                    renderFlashcardSection()
                ) : (
                    <div className="text-center my-16">
                        <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-300">Session Complete!</h2>
                        <p className="text-slate-500 dark:text-slate-400">You've reviewed all available cards for this set.</p>
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 mt-6">
                            {selectedSetIndex !== null && dontKnowWords.get(selectedSetIndex) && dontKnowWords.get(selectedSetIndex)!.length > 0 && (
                                <button onClick={startDontKnowSession} className="px-5 py-2.5 text-white bg-amber-600 hover:bg-amber-700 rounded-lg font-semibold transition-colors flex items-center gap-2">
                                    <Repeat size={18} />
                                    Review {dontKnowWords.get(selectedSetIndex)?.length} Mistake(s)
                                </button>
                            )}
                            {currentSet && (
                                <button onClick={startPracticeSession} className="px-5 py-2.5 text-white bg-sky-600 hover:bg-sky-700 rounded-lg font-semibold transition-colors flex items-center gap-2">
                                    <RefreshCw size={18} />
                                    Practice Again
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Sentence Upload - Hidden in Zen Mode */}
                {!isZenMode && (
                    <div className="w-full mt-8 p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700 animate-fade-in">
                        <SentenceUpload onSentencesLoaded={(newMap) => setSentences(prev => new Map([...prev, ...newMap]))} onClearSentences={() => setSentences(new Map())} hasSentences={sentences.size > 0}/>
                    </div>
                )}

                {/* Bottom Controls - Hidden in Zen Mode */}
                {currentSet && !isZenMode && (
                    <div className="flex items-center justify-center gap-6 mt-6 animate-fade-in">
                        <Tooltip content="Randomize card order">
                            <button onClick={handleShuffle} disabled={reviewWords.length <= 1} className={`flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${shuffleButtonClasses}`}>
                                <Shuffle size={18} /> Shuffle
                            </button>
                        </Tooltip>
                        <Tooltip content="Switch translation direction">
                            <TranslationModeToggle mode={translationMode} onModeChange={setTranslationMode} lang1={currentSet.lang1} lang2={currentSet.lang2} />
                        </Tooltip>
                        <Tooltip content="Show list of words in this set">
                            <button onClick={() => setIsWordListVisible(v => !v)} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                                <ChevronsUpDown size={18} /> List
                            </button>
                        </Tooltip>
                    </div>
                )}

                {/* Word List - Hidden in Zen Mode */}
                {currentSet && !isZenMode && <WordList words={currentSet.words} isVisible={isWordListVisible} lang1={currentSet.lang1} lang2={currentSet.lang2} />}
            </div>

            {user && showWelcomeToast && welcomeStats && (
                <StudyStatsToast
                    streak={welcomeStats.streak}
                    wordsLearned={welcomeStats.lastSessionCount}
                    onClose={() => setShowWelcomeToast(false)}
                />
            )}

            <FileSourceModal isOpen={isFileSourceModalOpen && !loadedDictionary} onClose={() => setFileSourceModalOpen(false)} onFilesSelect={handleFilesSelect} isLoading={isLoading} user={user} />
            <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setInstructionsModalOpen(false)} />
            <LearnedWordsModal isOpen={isLearnedWordsModalOpen} onClose={() => setLearnedWordsModalOpen(false)} learnedWords={learnedWordsWithDetails} lang1={currentSet?.lang1 || 'Language 1'} lang2={currentSet?.lang2 || 'Language 2'} />
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setProfileModalOpen(false)}
                currentStats={currentDictionaryStats}
                allTimeStats={allTimeStats}
                dictionaryName={loadedDictionary.name}
                onResetAllStats={handleResetAllStats}
            />
            {/* Removed ChatModal from render if deleting feature */}
        </main>
    );
};

export default App;
