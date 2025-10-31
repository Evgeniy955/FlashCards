import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from './lib/firebase-client';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Flashcard } from './components/Flashcard';
import { ProgressBar } from './components/ProgressBar';
import { SetSelector } from './components/SetSelector';
import { FileSourceModal } from './components/FileSourceModal';
import { InstructionsModal } from './components/InstructionsModal';
import { LearnedWordsModal } from './components/LearnedWordsModal';
import { WordList } from './components/WordList';
import { SentenceUpload } from './components/SentenceUpload';
import { Auth } from './components/Auth';
import { Word, LoadedDictionary, WordProgress } from './types';
import { parseDictionaryFile, shuffleArray } from './utils/dictionaryUtils';
import { Shuffle, ChevronsUpDown, Info, BookUser, Trash2, Repeat, Library, Loader2 } from 'lucide-react';

// --- Constants ---
const SRS_INTERVALS = [1, 2, 4, 8, 16, 32, 64]; // in days

// --- Main App Component ---
const App: React.FC = () => {
    const [user] = useAuthState(auth);
    const [loadedDictionary, setLoadedDictionary] = useState<LoadedDictionary | null>(null);
    const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [reviewWords, setReviewWords] = useState<Word[]>([]);
    
    const [learnedWords, setLearnedWords] = useState<Map<string, WordProgress>>(new Map());
    const [dontKnowWords, setDontKnowWords] = useState<Map<number, Word[]>>(new Map());
    const [sentences, setSentences] = useState<Map<string, string>>(new Map());

    const [isLoading, setIsLoading] = useState(false); // For file parsing
    const [isProgressLoading, setIsProgressLoading] = useState(true); // For Firestore, start as true
    const [isWordListVisible, setIsWordListVisible] = useState(false);
    const [isDontKnowMode, setIsDontKnowMode] = useState(false);
    const [isTransitioning, setIsTransitioning] = useState(false); // For know/dont-know animation
    
    const [isFileSourceModalOpen, setFileSourceModalOpen] = useState(true);
    const [isInstructionsModalOpen, setInstructionsModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setLearnedWordsModalOpen] = useState(false);

    const dictionaryId = useMemo(() => loadedDictionary?.name.replace(/[\/.]/g, '_'), [loadedDictionary]);
    
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
                    if (data && data.globalSentences) {
                        setSentences(new Map(Object.entries(data.globalSentences)));
                    } else {
                        // If the field doesn't exist, start fresh
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
        if (!user) return; // Don't save if not logged in

        const handler = setTimeout(async () => {
            const userDocRef = doc(db, 'users', user.uid);
            try {
                await setDoc(userDocRef, {
                    globalSentences: Object.fromEntries(sentences)
                }, { merge: true });
            } catch (error) {
                console.error("Error saving global sentences:", error);
            }
        }, 1500); // Debounce saves

        return () => clearTimeout(handler);
    }, [sentences, user]);


    // Load DICTIONARY-SPECIFIC progress from Firestore
    useEffect(() => {
        const loadProgress = async () => {
            if (!user || !dictionaryId) {
                setLearnedWords(new Map());
                setDontKnowWords(new Map());
                setIsProgressLoading(false);
                return;
            }

            setIsProgressLoading(true);
            const docRef = doc(db, 'users', user.uid, 'progress', dictionaryId);
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data()!;
                    setLearnedWords(new Map(Object.entries(data.learnedWords || {})));
                    const dontKnowMap = new Map(
                        Object.entries(data.dontKnowWords || {}).map(([key, value]) => [
                            Number(key),
                            value as Word[],
                        ])
                    );
                    setDontKnowWords(dontKnowMap);
                } else {
                    setLearnedWords(new Map());
                    setDontKnowWords(new Map());
                }
            } catch (error) {
                console.error("Error loading dictionary progress from Firestore:", error);
                setLearnedWords(new Map());
                setDontKnowWords(new Map());
            } finally {
                setIsProgressLoading(false);
            }
        };

        loadProgress();
    }, [user, dictionaryId]);

    // Save DICTIONARY-SPECIFIC progress to Firestore
    useEffect(() => {
        if (isProgressLoading || !user || !dictionaryId) {
            return;
        }

        const handler = setTimeout(async () => {
            const docRef = doc(db, 'users', user.uid, 'progress', dictionaryId);
            const dataToSave = {
                learnedWords: Object.fromEntries(learnedWords),
                dontKnowWords: Object.fromEntries(dontKnowWords),
                // Sentences are no longer saved per dictionary
            };
            try {
                await setDoc(docRef, dataToSave, { merge: true });
            } catch (error) {
                console.error("Error saving dictionary progress to Firestore:", error);
            }
        }, 1500); // Debounce saves

        return () => clearTimeout(handler);
    }, [learnedWords, dontKnowWords, user, dictionaryId, isProgressLoading]);


    const startReviewSession = useCallback((setIndex: number) => {
        if (!loadedDictionary) return;
        const set = loadedDictionary.sets[setIndex];
        const now = new Date().toISOString();
        const wordsForReview = set.words.filter(word => {
            const progress = learnedWords.get(word.en);
            return !progress || progress.nextReviewDate <= now;
        });
        setReviewWords(shuffleArray(wordsForReview));
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setIsDontKnowMode(false);
    }, [loadedDictionary, learnedWords]);

    useEffect(() => {
        if (selectedSetIndex !== null && !isProgressLoading) {
            startReviewSession(selectedSetIndex);
        }
    }, [selectedSetIndex, learnedWords, startReviewSession, isProgressLoading]);
    
    const handleFilesSelect = async (name: string, wordsFile: File, sentencesFile?: File) => {
        setIsLoading(true);
        try {
            // First, parse the optional sentences file to have it ready for merging.
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

            // Clear previous dictionary-specific progress states.
            setLearnedWords(new Map());
            setDontKnowWords(new Map());
            // Merge sentences from the file into the global sentence state.
            if (sentenceMapFromFile) {
                setSentences(prev => new Map([...prev, ...sentenceMapFromFile!]));
            }

            // Now, parse and set the new dictionary. This will trigger the progress loading useEffect.
            const dictionary = await parseDictionaryFile(wordsFile);
            dictionary.name = name; 
            setLoadedDictionary(dictionary);
            setSelectedSetIndex(0);
            setFileSourceModalOpen(false);

        } catch (error) {
            alert((error as Error).message);
            setLoadedDictionary(null);
        } finally {
            setIsLoading(false);
        }
    };
    
    const currentSet = useMemo(() => selectedSetIndex !== null ? loadedDictionary?.sets[selectedSetIndex] : null, [selectedSetIndex, loadedDictionary]);
    const currentWord = useMemo(() => reviewWords[currentWordIndex], [reviewWords, currentWordIndex]);
    const exampleSentence = useMemo(() => currentWord ? sentences.get(currentWord.en.toLowerCase()) : undefined, [currentWord, sentences]);
    const totalLearnedCount = useMemo(() => learnedWords.size, [learnedWords]);

    const learnedWordsWithDetails = useMemo(() => {
        if (!loadedDictionary) return [];
        const allWords = new Map<string, Word>();
        loadedDictionary.sets.forEach(set => set.words.forEach(word => allWords.set(word.en, word)));
        return Array.from(learnedWords.entries())
            .map(([en, progress]) => {
                const word = allWords.get(en);
                return word ? { ...word, progress } : null;
            })
            .filter((item): item is Word & { progress: WordProgress } => item !== null)
            .sort((a, b) => a.en.localeCompare(b.en));
    }, [learnedWords, loadedDictionary]);
    
    const goToNextWord = () => {
        setIsFlipped(false);
        if (currentWordIndex < reviewWords.length - 1) {
            setCurrentWordIndex(prev => prev + 1);
        } else {
            // End of session, re-evaluate words for review.
            if (selectedSetIndex !== null) {
                startReviewSession(selectedSetIndex);
            } else {
                 setReviewWords([]);
            }
        }
    };

    const handleKnow = () => {
        if (!currentWord || isTransitioning) return;

        const progress = learnedWords.get(currentWord.en);
        const currentStage = progress ? progress.srsStage : -1;
        const nextStage = Math.min(currentStage + 1, SRS_INTERVALS.length - 1);
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + SRS_INTERVALS[nextStage]);
        setLearnedWords(prev => new Map(prev).set(currentWord.en, { srsStage: nextStage, nextReviewDate: nextReviewDate.toISOString() }));
        
        if (isDontKnowMode && selectedSetIndex !== null) {
            setDontKnowWords(prev => {
                const newMap = new Map(prev);
                const words = newMap.get(selectedSetIndex)?.filter(w => w.en !== currentWord.en) || [];
                if (words.length > 0) newMap.set(selectedSetIndex, words);
                else newMap.delete(selectedSetIndex);
                return newMap;
            });
        }
        
        setIsTransitioning(true);
        setTimeout(() => {
            goToNextWord();
            setIsTransitioning(false);
        }, 400);
    };

    const handleDontKnow = () => {
        if (!currentWord || selectedSetIndex === null) return;
        if (learnedWords.has(currentWord.en)) {
            setLearnedWords(prev => {
                const newMap = new Map(prev);
                newMap.delete(currentWord.en);
                return newMap;
            });
        }
        if (!isDontKnowMode) {
            setDontKnowWords(prev => {
                const newMap = new Map(prev);
                const currentList = newMap.get(selectedSetIndex) || [];
                if (!currentList.some(w => w.en === currentWord.en)) {
                    newMap.set(selectedSetIndex, [...currentList, currentWord]);
                }
                return newMap;
            });
        }
        goToNextWord();
    };

    const handleFlip = () => setIsFlipped(prev => !prev);
    const handleSelectSet = (index: number) => setSelectedSetIndex(index);
    const handleShuffle = () => setReviewWords(shuffleArray(reviewWords));
    const startDontKnowSession = () => {
        if (selectedSetIndex === null) return;
        const words = dontKnowWords.get(selectedSetIndex) || [];
        if (words.length > 0) {
            setReviewWords(shuffleArray(words));
            setCurrentWordIndex(0);
            setIsFlipped(false);
            setIsDontKnowMode(true);
        }
    };

    const handleResetProgress = () => {
        if (window.confirm('Are you sure you want to reset learning progress for this dictionary? Your global sentence list will not be affected.')) {
            setLearnedWords(new Map());
            setDontKnowWords(new Map());
            // The save effect for progress will trigger and clear the data in Firestore.
            if (selectedSetIndex !== null) startReviewSession(selectedSetIndex);
        }
    };

    const handleChangeDictionary = () => {
        setLoadedDictionary(null);
        setSelectedSetIndex(null);
        setFileSourceModalOpen(true);
    };

    if (!loadedDictionary) {
        return (
            <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
                <FileSourceModal isOpen={isFileSourceModalOpen} onClose={() => setFileSourceModalOpen(false)} onFilesSelect={handleFilesSelect} isLoading={isLoading} />
                <div className="text-center">
                    <h1 className="text-5xl font-bold mb-4">Flashcard App</h1>
                    <p className="text-slate-400 mb-8">Your personal language learning assistant.</p>
                    <button onClick={() => setFileSourceModalOpen(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors">
                        Get Started
                    </button>
                </div>
            </main>
        );
    }
    
    return (
        <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center p-4 sm:p-6">
            <header className="w-full max-w-5xl flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                     <button onClick={handleChangeDictionary} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                        <Library size={18} />
                        <span className="hidden sm:inline">Change</span>
                    </button>
                    <button onClick={() => setInstructionsModalOpen(true)} className="text-slate-400 hover:text-white transition-colors">
                        <Info size={20} />
                    </button>
                </div>
                <div className="text-center">
                    <h1 className="text-lg sm:text-xl font-bold truncate max-w-[200px] sm:max-w-xs" title={loadedDictionary.name}>{loadedDictionary.name}</h1>
                </div>
                <Auth user={user} />
            </header>

            <div className="w-full max-w-md flex flex-col items-center">
                 <div className="w-full flex items-center justify-center gap-4 text-sm mb-4">
                    <button onClick={() => setLearnedWordsModalOpen(true)} className="flex items-center gap-2 py-1 px-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                        <BookUser size={16} /> Learned: {totalLearnedCount}
                    </button>
                    <button onClick={handleResetProgress} className="flex items-center gap-2 py-1 px-3 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
                        <Trash2 size={16} /> Reset
                    </button>
                </div>

                <SetSelector sets={loadedDictionary.sets} selectedSetIndex={selectedSetIndex} onSelectSet={handleSelectSet} />
                
                {isProgressLoading ? (
                     <div className="w-full aspect-[3/2] flex justify-center items-center text-slate-400">
                        <Loader2 className="animate-spin h-8 w-8 mr-3" />
                        <span>Loading progress...</span>
                    </div>
                ) : reviewWords.length > 0 ? (
                    <div className="w-full flex flex-col items-center">
                         <div className="w-full text-center mb-2">
                             <p className="text-slate-400">{isDontKnowMode ? "Reviewing Mistakes" : "Learning"}: {currentWordIndex + 1} / {reviewWords.length}</p>
                        </div>
                        <ProgressBar current={currentWordIndex + 1} total={reviewWords.length} />
                        <Flashcard word={currentWord} isFlipped={isFlipped} onFlip={handleFlip} exampleSentence={exampleSentence} isTransitioning={isTransitioning} />
                        <div className="flex justify-center gap-4 mt-6 w-full">
                            <button onClick={handleDontKnow} disabled={isProgressLoading || isTransitioning} className="w-full py-3 text-lg font-semibold bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">Don't know</button>
                            <button onClick={handleKnow} disabled={isProgressLoading || isTransitioning} className="w-full py-3 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">Know</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center my-16">
                        <h2 className="text-2xl font-semibold mb-4 text-slate-300">Session Complete!</h2>
                        <p className="text-slate-400">You've reviewed all available cards for this set.</p>
                        {selectedSetIndex !== null && dontKnowWords.get(selectedSetIndex) && dontKnowWords.get(selectedSetIndex)!.length > 0 && (
                             <button onClick={startDontKnowSession} className="mt-6 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto">
                                <Repeat size={18} />
                                Review {dontKnowWords.get(selectedSetIndex)?.length} Mistake(s)
                            </button>
                        )}
                    </div>
                )}
                
                <div className="w-full mt-8 p-3 bg-slate-800/50 rounded-lg">
                    <SentenceUpload onSentencesLoaded={(newMap) => setSentences(prev => new Map([...prev, ...newMap]))} onClearSentences={() => setSentences(new Map())} hasSentences={sentences.size > 0}/>
                </div>

                {currentSet && (
                     <div className="flex items-center justify-center gap-6 mt-6">
                        <button onClick={handleShuffle} disabled={reviewWords.length <= 1} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <Shuffle size={18} /> Shuffle
                        </button>
                        <button onClick={() => setIsWordListVisible(v => !v)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                            <ChevronsUpDown size={18} /> Word List
                        </button>
                    </div>
                )}
                
                {currentSet && <WordList words={currentSet.words} isVisible={isWordListVisible} />}
            </div>

            <FileSourceModal isOpen={isFileSourceModalOpen && !loadedDictionary} onClose={() => setFileSourceModalOpen(false)} onFilesSelect={handleFilesSelect} isLoading={isLoading} />
            <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setInstructionsModalOpen(false)} />
            <LearnedWordsModal isOpen={isLearnedWordsModalOpen} onClose={() => setLearnedWordsModalOpen(false)} learnedWords={learnedWordsWithDetails} />
        </main>
    );
};

export default App;
