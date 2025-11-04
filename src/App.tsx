import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './lib/firebase-client';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore';
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
import { Word, LoadedDictionary, WordProgress, TranslationMode, Theme } from './types';
import { parseDictionaryFile, shuffleArray, getWordId } from './utils/dictionaryUtils';
import { Shuffle, ChevronsUpDown, Info, BookUser, Trash2, Repeat, Library, Loader2, User as UserIcon } from 'lucide-react';
import { TrainingModeInput, AnswerState } from './components/TrainingModeInput';
import { TrainingModeGuess } from './components/TrainingModeGuess';
import { TrainingModeToggle } from './components/TrainingModeToggle';
import { TranslationModeToggle } from './components/TranslationModeToggle';
import { saveLocalProgress, loadLocalProgress, deleteLocalProgress, loadAllLocalProgress, clearAllLocalProgress } from './lib/localProgress';
import { ThemeToggle } from './components/ThemeToggle';
import { getDictionary } from './lib/indexedDB';
import { StudyStatsToast } from './components/StudyStatsToast';


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
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    });
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
    const sortedDates = [...new Set(history)].sort().reverse();
    const lastDate = sortedDates[0];
    return dailyData[lastDate]?.newWordsLearned || 0;
};


// --- Main App Component ---
const App: React.FC = () => {
    const [user, authLoading] = useAuthState(auth);
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
    const [sentences, setSentences] = useState<Map<string, string>>(new Map());

    const [isLoading, setIsLoading] = useState(false); // For file parsing and dictionary loading
    const [isInitialLoading, setIsInitialLoading] = useState(true); // For loading the last used dictionary on startup
    const [isProgressLoading, setIsProgressLoading] = useState(true); // For Firestore progress
    const [isWordListVisible, setIsWordListVisible] = useState(false);
    const [isDontKnowMode, setIsDontKnowMode] = useState(false);
    const [isChangingWord, setIsChangingWord] = useState(false); // For fade animation
    const [isInstantChange, setIsInstantChange] = useState(false); // For instant card change
    const [progressSaveCounter, setProgressSaveCounter] = useState(0); // Trigger for all-time stats refresh

    // State for Training Mode input
    const [userAnswer, setUserAnswer] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('idle');
    const [trainingMode, setTrainingMode] = useState<'write' | 'guess'>('write');
    const [translationMode, setTranslationMode] = useState<TranslationMode>('standard');
    const [guessOptions, setGuessOptions] = useState<string[]>([]);

    const [isFileSourceModalOpen, setFileSourceModalOpen] = useState(false);
    const [isInstructionsModalOpen, setInstructionsModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setLearnedWordsModalOpen] = useState(false);
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>('dark');
    const [allTimeStats, setAllTimeStats] = useState<ProfileStats | null>(null);

    // State for welcome toast
    const [welcomeStats, setWelcomeStats] = useState<{ streak: number; lastSessionCount: number } | null>(null);
    const [showWelcomeToast, setShowWelcomeToast] = useState(false);
    
    // State to manage sync on login
    const [isSyncing, setIsSyncing] = useState(false);
    const prevUser = usePrevious(user);

    // Effect to set initial theme from localStorage or system preference
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme') as Theme | null;
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme) {
            setTheme(savedTheme);
        } else if (systemPrefersDark) {
            setTheme('light');
        } else {
            setTheme('light');
        }
    }, []);

    // Effect to apply theme class to <html> and save to localStorage
    useEffect(() => {
        const root = window.document.documentElement;
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
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { lastUsedDictionary: name }, { merge: true });
        } else {
            localStorage.setItem('lastUsedDictionary', name);
        }
    }, [user]);

    const clearLastUsedDictionary = useCallback(async () => {
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            await setDoc(userDocRef, { lastUsedDictionary: null }, { merge: true });
        } else {
            localStorage.removeItem('lastUsedDictionary');
        }
    }, [user]);

    const loadAndSetDictionary = useCallback(async (name: string, wordsFile: File, sentencesFile?: File) => {
        setIsLoading(true);
        try {
            let sentenceMapFromFile: Map<string, string> | null = null;
            if (sentencesFile) {
                const text = await sentencesFile.text();
                const jsonObj = JSON.parse(text);
                sentenceMapFromFile = new Map<string, string>();
                for (const key in jsonObj) {
                    if (typeof jsonObj[key] === 'string') {
                        sentenceMapFromFile.set(key.trim().toLowerCase(), jsonObj[key]);
                    }
                }
            }

            setLearnedWords(new Map());
            setDontKnowWords(new Map());
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
        } finally {
            setIsLoading(false);
        }
    }, [saveLastUsedDictionary]);


    useEffect(() => {
        const loadLastDictionary = async () => {
            if (authLoading) return;

            let lastUsedDictName: string | null = null;
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    lastUsedDictName = docSnap.data()?.lastUsedDictionary || null;
                }
            } else {
                lastUsedDictName = localStorage.getItem('lastUsedDictionary');
            }

            if (lastUsedDictName) {
                try {
                    const savedDict = await getDictionary(lastUsedDictName);
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
            const userDocRef = doc(db, 'users', user.uid);
            try {
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const history = data.studyHistory || [];
                    const dailyData = data.dailyStats || {};
    
                    const streak = calculateStreak(history);
                    const lastSessionCount = getLastSessionCount(history, dailyData);
    
                    if (streak > 0 || lastSessionCount > 0) {
                        setWelcomeStats({ streak, lastSessionCount });
                        setShowWelcomeToast(true);
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
        const userDocRef = doc(db, 'users', user.uid);
    
        try {
            const updates: { [key: string]: any } = {
                studyHistory: arrayUnion(todayStr)
            };
    
            if (isNewWord) {
                // This syntax allows for a dynamic key in the update object.
                // It will increment 'newWordsLearned' for the current date.
                updates[`dailyStats.${todayStr}.newWordsLearned`] = increment(1);
            }
    
            // Using setDoc with merge is safer than updateDoc as it creates the doc if it doesn't exist.
            await setDoc(userDocRef, updates, { merge: true });
    
        } catch (error) {
            console.error("Failed to record study activity:", error);
        }
    }, [user]);

    // --- End Study Stats ---


    // Load global sentences from Firestore user document
    useEffect(() => {
        const loadGlobalSentences = async () => {
            if (!user) {
                setSentences(new Map());
                return;
            }
            const userDocRef = doc(db, 'users', user.uid);
            try {
                const docSnap = await getDoc(userDocRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data?.globalSentences) {
                        setSentences(new Map(Object.entries(data.globalSentences)));
                    } else {
                        setSentences(new Map());
                    }
                }
            } catch (error) {
                console.error("Error loading global sentences:", error);
                setSentences(new Map());
            }
        };
        loadGlobalSentences();
    }, [user]);

    // Save global sentences to Firestore user document
    useEffect(() => {
        if (!user) return;

        const handler = setTimeout(async () => {
            const userDocRef = doc(db, 'users', user.uid);
            try {
                await setDoc(userDocRef, {
                    globalSentences: Object.fromEntries(sentences)
                }, { merge: true });
            } catch (error) {
                console.error("Error saving global sentences:", error);
            }
        }, 1500);

        return () => clearTimeout(handler);
    }, [sentences, user]);

    // Effect to handle merging local progress to remote on login
    useEffect(() => {
        const syncOnLogin = async () => {
            // Condition: user just logged in and a dictionary is loaded.
            if (user && !prevUser && dictionaryId) {
                setIsSyncing(true);
                try {
                    // 1. Load both local and remote progress to reconcile them.
                    const localData = await loadLocalProgress(dictionaryId);
                    const docRef = doc(db, `users/${user.uid}/progress/${dictionaryId}`);
                    const docSnap = await getDoc(docRef);

                    const localLearned = localData?.learnedWords ? new Map(Object.entries(localData.learnedWords)) : new Map<string, WordProgress>();
                    const localDontKnow = localData?.dontKnowWords ? new Map(Object.entries(localData.dontKnowWords).map(([k, v]) => [Number(k), v as Word[]])) : new Map<number, Word[]>();

                    const remoteData = docSnap.exists() ? docSnap.data() : {};
                    const remoteLearned = remoteData?.learnedWords ? new Map(Object.entries(remoteData.learnedWords as { [s: string]: WordProgress; })) : new Map<string, WordProgress>();
                    const remoteDontKnow = remoteData?.dontKnowWords ? new Map(Object.entries(remoteData.dontKnowWords).map(([k, v]) => [Number(k), v as Word[]])) : new Map<number, Word[]>();

                    // 2. Merge data: Remote data takes precedence for learned words to prevent overwrites,
                    // while 'don't know' words are combined to not lose any.
                    const mergedLearned = new Map([...localLearned, ...remoteLearned]);

                    const mergedDontKnow = new Map<number, Word[]>();
                    const allDontKnowKeys = new Set([...localDontKnow.keys(), ...remoteDontKnow.keys()]);
                    
                    allDontKnowKeys.forEach(key => {
                        const localWords = localDontKnow.get(key) || [];
                        const remoteWords = remoteDontKnow.get(key) || [];
                        const combined = [...localWords, ...remoteWords];
                        // Deduplicate the combined array
                        const uniqueWords = Array.from(new Map(combined.map(w => [getWordId(w), w])).values());
                        mergedDontKnow.set(key, uniqueWords);
                    });
                    
                    // 3. Update state with the definitive merged data.
                    setLearnedWords(mergedLearned);
                    setDontKnowWords(mergedDontKnow);

                    // 4. Clean up local progress after successful merge.
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
                if (!dictionaryId) {
                  setLearnedWords(new Map());
                  setDontKnowWords(new Map());
                }
                setIsProgressLoading(false);
                return;
            }

            setIsProgressLoading(true);
            try {
                if (user) { // User is logged in, use Firestore
                    const docRef = doc(db, `users/${user.uid}/progress/${dictionaryId}`);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const learnedData = data?.learnedWords || {};
                        setLearnedWords(new Map(Object.entries(learnedData)));
                        const dontKnowData = data?.dontKnowWords || {};
                        const dontKnowMap = new Map(
                            Object.entries(dontKnowData).map(([key, value]) => [Number(key), value as Word[]])
                        );
                        setDontKnowWords(dontKnowMap);
                    } else {
                        setLearnedWords(new Map());
                        setDontKnowWords(new Map());
                    }
                } else { // User is not logged in, use IndexedDB
                    const localProgress = await loadLocalProgress(dictionaryId);
                    if (localProgress) {
                        const learnedData = localProgress.learnedWords || {};
                        setLearnedWords(new Map(Object.entries(learnedData)));
                        const dontKnowData = localProgress.dontKnowWords || {};
                        const dontKnowMap = new Map(
                            Object.entries(dontKnowData).map(([key, value]) => [Number(key), value as Word[]])
                        );
                        setDontKnowWords(dontKnowMap);
                    } else {
                        setLearnedWords(new Map());
                        setDontKnowWords(new Map());
                    }
                }
            } catch (error) {
                console.error("Error loading progress:", error);
                setLearnedWords(new Map());
                setDontKnowWords(new Map());
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
        dontKnowWords.forEach(wordArray => {
            wordArray.forEach(word => {
                allDontKnowWords.add(getWordId(word));
            });
        });
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
            };
            const totalWordsInDict = currentDictionaryStats?.totalWords;

            if (user) {
                const docRef = doc(db, `users/${user.uid}/progress/${dictionaryId}`);
                try {
                    await setDoc(docRef, { ...dataToSave, totalWordsInDict }, { merge: true });
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
    }, [learnedWords, dontKnowWords, user, dictionaryId, isProgressLoading, currentDictionaryStats]);

     // Effect to calculate all-time stats
     useEffect(() => {
        const calculateAllTimeStats = async () => {
            if (authLoading) return; // Wait for auth state to be resolved
            let allProgressData: any[] = [];

            try {
                if (user) {
                    const progressColRef = collection(db, `users/${user.uid}/progress`);
                    const querySnapshot = await getDocs(progressColRef);
                    querySnapshot.forEach(doc => allProgressData.push(doc.data()));
                } else {
                    allProgressData = await loadAllLocalProgress();
                }

                if (allProgressData.length > 0) {
                    const aggregated = allProgressData.reduce((acc, progress) => {
                        acc.totalWords += progress.totalWordsInDict || 0;
                        acc.learnedCount += progress.learnedWords ? Object.keys(progress.learnedWords).length : 0;
                        
                        const dontKnowInDict = new Set<string>();
                        if (progress.dontKnowWords) {
                            Object.values(progress.dontKnowWords).forEach((wordArray: unknown) => {
                                if (Array.isArray(wordArray)) {
                                    (wordArray as Word[]).forEach(word => {
                                        dontKnowInDict.add(getWordId(word));
                                    });
                                }
                            });
                        }
                        acc.dontKnowCount += dontKnowInDict.size;
                        return acc;
                    }, { totalWords: 0, learnedCount: 0, dontKnowCount: 0 });

                    const remaining = aggregated.totalWords - aggregated.learnedCount;

                    setAllTimeStats({
                        dictionaryCount: allProgressData.length,
                        totalWords: aggregated.totalWords,
                        learnedCount: aggregated.learnedCount,
                        dontKnowCount: aggregated.dontKnowCount,
                        remainingCount: remaining > 0 ? remaining : 0,
                        learnedPercentage: aggregated.totalWords > 0 ? (aggregated.learnedCount / aggregated.totalWords) * 100 : 0,
                        remainingPercentage: aggregated.totalWords > 0 ? (remaining / aggregated.totalWords) * 100 : 0,
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
        if (window.confirm('Are you sure you want to reset ALL your statistics across ALL dictionaries? This action cannot be undone.')) {
            setIsProgressLoading(true);
            try {
                if (user) {
                    const progressColRef = collection(db, `users/${user.uid}/progress`);
                    const querySnapshot = await getDocs(progressColRef);
                    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
                    await Promise.all(deletePromises);
                } else {
                    await clearAllLocalProgress();
                }
    
                // Also clear the current dictionary's progress from state
                setLearnedWords(new Map());
                setDontKnowWords(new Map());
                
                // Force a refresh of the stats
                setAllTimeStats(null);
                setProgressSaveCounter(c => c + 1);
    
                alert('All statistics have been reset.');
    
            } catch (error) {
                console.error("Failed to reset all stats:", error);
                alert("An error occurred while resetting statistics. Please try again.");
            } finally {
                setIsProgressLoading(false);
                setProfileModalOpen(false); // Close modal after reset
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
            setSessionActive(false); // End session
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
        const isNewlyLearned = !learnedWords.has(getWordId(currentWord));
        recordStudyActivity(isNewlyLearned);
        advanceToNextWord(() => {
            const wordId = getWordId(currentWord);
            const progress = learnedWords.get(wordId);
            const currentStage = progress ? progress.srsStage : -1;
            const nextStage = Math.min(currentStage + 1, SRS_INTERVALS.length - 1);
            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + SRS_INTERVALS[nextStage]);
            setLearnedWords(prev => new Map(prev).set(wordId, { srsStage: nextStage, nextReviewDate: nextReviewDate.toISOString() }));

            if (isDontKnowMode && selectedSetIndex !== null) {
                setDontKnowWords((prev: Map<number, Word[]>) => {
                    const newMap = new Map(prev);
                    const words = newMap.get(selectedSetIndex)?.filter(w => getWordId(w) !== wordId) || [];
                    if (words.length > 0) newMap.set(selectedSetIndex, words);
                    else newMap.delete(selectedSetIndex);
                    return newMap;
                });
            }
            return true;
        }, isFlipped);
    };

    const handleDontKnow = () => {
        recordStudyActivity(false);
        advanceToNextWord(() => {
            if (selectedSetIndex === null) return false;
            const wordId = getWordId(currentWord);

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

    const handleFlip = () => {
        if (isDontKnowMode && answerState !== 'idle' && trainingMode === 'write') return;
        if (isDontKnowMode && trainingMode === 'guess' && isFlipped) return; // Don't allow flipping back in guess mode
        setIsFlipped(prev => !prev);
    };

    const handleSelectSet = (index: number) => {
        if (index !== selectedSetIndex) {
            setSessionActive(false);
            setSelectedSetIndex(index);
        }
    };

    const handleShuffle = () => {
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
            setIsDontKnowMode(true);
            setSessionActive(true);
            setIsShuffled(false);
            if (trainingMode === 'guess') {
                generateGuessOptions(shuffledWords[0]);
            }
        }
    };

    const handleTrainingAnswer = () => {
        if (!currentWord || answerState !== 'idle') return;

        const correctAnswer = translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1;
        const isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase();
        
        recordStudyActivity(isCorrect && !learnedWords.has(getWordId(currentWord)));

        if (isCorrect) {
            setAnswerState('correct');
            handleKnow();

            setTimeout(() => {
                setIsFlipped(false);
                setAnswerState('idle');
                setUserAnswer('');
            }, 1000);
        } else {
            setAnswerState('incorrect');
            setIsFlipped(true);
        }
    };

    const handleTrainingNext = () => {
        advanceToNextWord(() => {
            setAnswerState('idle');
            setUserAnswer('');
            return true;
        }, isFlipped);
    };

    const handleGuess = (isCorrect: boolean) => {
        recordStudyActivity(isCorrect && !learnedWords.has(getWordId(currentWord)));
        if (isCorrect) {
            const wordId = getWordId(currentWord);
            const progress = learnedWords.get(wordId);
            const currentStage = progress ? progress.srsStage : -1;
            const nextStage = Math.min(currentStage + 1, SRS_INTERVALS.length - 1);
            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + SRS_INTERVALS[nextStage]);
            setLearnedWords(prev => new Map(prev).set(wordId, { srsStage: nextStage, nextReviewDate: nextReviewDate.toISOString() }));

            if (isDontKnowMode && selectedSetIndex !== null) {
                setDontKnowWords((prev: Map<number, Word[]>) => {
                    const newMap = new Map(prev);
                    const words = newMap.get(selectedSetIndex)?.filter(w => getWordId(w) !== wordId) || [];
                    if (words.length > 0) newMap.set(selectedSetIndex, words);
                    else newMap.delete(selectedSetIndex);
                    return newMap;
                });
            }
        } else {
            setIsFlipped(true);
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
            setSessionActive(false); // This will trigger a re-start of the session
        }
    };

    const handleChangeDictionary = () => {
        setLoadedDictionary(null);
        setSelectedSetIndex(null);
        setSessionActive(false);
        setFileSourceModalOpen(true);
    };

    const renderContent = () => {
        if (isProgressLoading) {
            return (
                <div className="w-full aspect-[3/2] flex justify-center items-center text-slate-500 dark:text-slate-400">
                    <Loader2 className="animate-spin h-8 w-8 mr-3" />
                    <span>Loading progress...</span>
                </div>
            );
        }

        if (reviewWords.length > 0 && currentWord && currentSet) {
            const counterText = isDontKnowMode
                ? `${sessionProgress} / ${sessionTotal}`
                : (staticCardNumber > 0 ? `${staticCardNumber} / ${staticTotalCards}` : '...');

            const placeholderLang = translationMode === 'standard' ? currentSet.lang2 : currentSet.lang1;
            const correctAnswer = translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1;

            return (
                <div className="w-full flex flex-col items-center">
                    <div className="w-full grid grid-cols-3 items-center gap-3 h-8 mb-2">
                        {isDontKnowMode ? (
                            <>
                                <p className="text-slate-500 dark:text-slate-400 text-sm text-left">{counterText}</p>
                                <TrainingModeToggle mode={trainingMode} onModeChange={(mode) => {
                                    setTrainingMode(mode);
                                    setIsFlipped(false);
                                    setAnswerState('idle');
                                    setUserAnswer('');
                                }} />
                                <div /> {/* Placeholder for grid */}
                            </>
                        ) : (
                            <p className="text-slate-500 dark:text-slate-400 text-sm col-span-3 text-center">{counterText}</p>
                        )}
                    </div>
                    <ProgressBar current={sessionProgress} total={sessionTotal} />
                    <div className={`w-full transition-opacity duration-200 ${isChangingWord ? 'opacity-0' : 'opacity-100'}`}>
                        <Flashcard word={currentWord} isFlipped={isFlipped} onFlip={handleFlip} exampleSentence={exampleSentence} isChanging={isChangingWord} isInstantChange={isInstantChange} translationMode={translationMode} lang1={currentSet.lang1} lang2={currentSet.lang2} />
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
                                <button onClick={handleDontKnow} disabled={isProgressLoading || isChangingWord} className="w-full py-3 text-lg font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">Don't know</button>
                                <button onClick={handleKnow} disabled={isProgressLoading || isChangingWord} className="w-full py-3 text-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">Know</button>
                            </>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center my-16">
                <h2 className="text-2xl font-semibold mb-4 text-slate-800 dark:text-slate-300">Session Complete!</h2>
                <p className="text-slate-500 dark:text-slate-400">You've reviewed all available cards for this set.</p>
                {selectedSetIndex !== null && dontKnowWords.get(selectedSetIndex) && dontKnowWords.get(selectedSetIndex)!.length > 0 && (
                    <button onClick={startDontKnowSession} className="mt-6 px-5 py-2.5 text-white bg-amber-600 hover:bg-amber-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto">
                        <Repeat size={18} />
                        Review {dontKnowWords.get(selectedSetIndex)?.length} Mistake(s)
                    </button>
                )}
            </div>
        );
    };

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
                        <ThemeToggle theme={theme} setTheme={setTheme} />
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
        <main className="min-h-screen flex flex-col items-center p-4 sm:p-6">
            <header className="w-full max-w-5xl flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 sm:gap-4">
                    <button onClick={handleChangeDictionary} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <Library size={18} />
                        <span className="hidden sm:inline">Change</span>
                    </button>
                    <button onClick={() => setInstructionsModalOpen(true)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <Info size={20} />
                    </button>
                </div>
                <div className="text-center">
                    <h1 className="text-lg sm:text-xl font-bold truncate max-w-[200px] sm:max-w-xs" title={loadedDictionary.name}>{loadedDictionary.name}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setProfileModalOpen(true)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                        <UserIcon size={20} />
                    </button>
                    <ThemeToggle theme={theme} setTheme={setTheme} />
                    <Auth user={user} />
                </div>
            </header>

            <div className="w-full max-w-md flex flex-col items-center">
                <div className="w-full flex items-center justify-center gap-4 text-sm mb-4">
                    <button onClick={() => setLearnedWordsModalOpen(true)} className="flex items-center gap-2 py-1 px-3 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700">
                        <BookUser size={16} /> Learned: {totalLearnedCount}
                    </button>
                    <button onClick={handleResetProgress} className="flex items-center gap-2 py-1 px-3 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700">
                        <Trash2 size={16} /> Reset
                    </button>
                </div>

                <SetSelector sets={loadedDictionary.sets} selectedSetIndex={selectedSetIndex} onSelectSet={handleSelectSet} />

                {renderContent()}

                <div className="w-full mt-8 p-3 bg-white/50 dark:bg-slate-800/50 rounded-lg shadow-sm dark:shadow-none border border-slate-200 dark:border-slate-700">
                    <SentenceUpload onSentencesLoaded={(newMap) => setSentences(prev => new Map([...prev, ...newMap]))} onClearSentences={() => setSentences(new Map())} hasSentences={sentences.size > 0}/>
                </div>

                {currentSet && (
                    <div className="flex items-center justify-center gap-6 mt-6">
                        <button onClick={handleShuffle} disabled={reviewWords.length <= 1} className={`flex items-center gap-2 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${shuffleButtonClasses}`}>
                            <Shuffle size={18} /> Shuffle
                        </button>
                        <TranslationModeToggle mode={translationMode} onModeChange={setTranslationMode} lang1={currentSet.lang1} lang2={currentSet.lang2} />
                        <button onClick={() => setIsWordListVisible(v => !v)} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                            <ChevronsUpDown size={18} /> List
                        </button>
                    </div>
                )}

                {currentSet && <WordList words={currentSet.words} isVisible={isWordListVisible} lang1={currentSet.lang1} lang2={currentSet.lang2} />}
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
        </main>
    );
};

export default App;