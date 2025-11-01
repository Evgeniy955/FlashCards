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
import { Word, LoadedDictionary, WordProgress, TranslationMode } from './types';
import { parseDictionaryFile, shuffleArray, getWordId } from './utils/dictionaryUtils';
import { Shuffle, ChevronsUpDown, Info, BookUser, Trash2, Repeat, Library, Loader2 } from 'lucide-react';
import { TrainingModeInput, AnswerState } from './components/TrainingModeInput';
import { TrainingModeGuess } from './components/TrainingModeGuess';
import { TrainingModeToggle } from './components/TrainingModeToggle';
import { TranslationModeToggle } from './components/TranslationModeToggle';


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
    
    // States for session progress tracking
    const [sessionProgress, setSessionProgress] = useState(0);
    const [sessionTotal, setSessionTotal] = useState(0);
    const [sessionActive, setSessionActive] = useState(false);
    
    const [learnedWords, setLearnedWords] = useState<Map<string, WordProgress>>(new Map());
    const [dontKnowWords, setDontKnowWords] = useState<Map<number, Word[]>>(new Map());
    const [sentences, setSentences] = useState<Map<string, string>>(new Map());

    const [isLoading, setIsLoading] = useState(false); // For file parsing
    const [isProgressLoading, setIsProgressLoading] = useState(true); // For Firestore, start as true
    const [isWordListVisible, setIsWordListVisible] = useState(false);
    const [isDontKnowMode, setIsDontKnowMode] = useState(false);
    const [isChangingWord, setIsChangingWord] = useState(false); // For fade animation
    const [isInstantChange, setIsInstantChange] = useState(false); // For instant card change
    
    // State for Training Mode input
    const [userAnswer, setUserAnswer] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('idle');
    const [trainingMode, setTrainingMode] = useState<'write' | 'guess'>('write');
    const [translationMode, setTranslationMode] = useState<TranslationMode>('standard');
    const [guessOptions, setGuessOptions] = useState<string[]>([]);
    
    const [isFileSourceModalOpen, setFileSourceModalOpen] = useState(true);
    const [isInstructionsModalOpen, setInstructionsModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setLearnedWordsModalOpen] = useState(false);

    const dictionaryId = useMemo(() => loadedDictionary?.name.replaceAll(/[./]/g, '_'), [loadedDictionary]);
    
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
            const docRef = doc(db, `users/${user.uid}/progress/${dictionaryId}`);
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const learnedData = data?.learnedWords || {};
                    setLearnedWords(new Map(Object.entries(learnedData)));
                    
                    const dontKnowData = data?.dontKnowWords || {};
                    const dontKnowMap = new Map(
                        Object.entries(dontKnowData).map(([key, value]) => [
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
            const docRef = doc(db, `users/${user.uid}/progress/${dictionaryId}`);
            const dataToSave = {
                learnedWords: Object.fromEntries(learnedWords),
                dontKnowWords: Object.fromEntries(dontKnowWords),
            };
            try {
                await setDoc(docRef, dataToSave, { merge: true });
            } catch (error) {
                console.error("Error saving dictionary progress to Firestore:", error);
            }
        }, 1500);

        return () => clearTimeout(handler);
    }, [learnedWords, dontKnowWords, user, dictionaryId, isProgressLoading]);

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
            .slice(0, 2);
    
        if (distractors.length < 2) {
            const fallbackDistractors = loadedDictionary.sets
                .flatMap(s => s.words)
                .filter(w => getWordId(w) !== correctWordId && !distractors.some(d => getWordId(d) === getWordId(w)))
                .sort(() => 0.5 - Math.random())
                .slice(0, 2 - distractors.length);
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

        } catch (error) {
            alert((error as Error).message);
            setLoadedDictionary(null);
        } finally {
            setIsLoading(false);
        }
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
        });
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

    const handleShuffle = () => setReviewWords(shuffleArray(reviewWords));
    
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
            if (trainingMode === 'guess') {
                generateGuessOptions(shuffledWords[0]);
            }
        }
    };

    const handleTrainingAnswer = () => {
        if (!currentWord || answerState !== 'idle') return;

        const correctAnswer = translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1;
        const isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.toLowerCase();
        
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
        setAnswerState('idle');
        setUserAnswer('');
        setIsFlipped(false);
        updateWordIndex();
    };

    const handleGuess = (isCorrect: boolean) => {
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


    const handleResetProgress = () => {
        if (globalThis.confirm('Are you sure you want to reset learning progress for this dictionary? Your global sentence list will not be affected.')) {
            setLearnedWords(new Map());
            setDontKnowWords(new Map());
            setSessionActive(false);
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
                <div className="w-full aspect-[3/2] flex justify-center items-center text-slate-400">
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
                                <p className="text-slate-400 text-sm text-left">{counterText}</p>
                                <h2 className="text-base font-semibold text-amber-400 text-center">Training Mode</h2>
                                <div className="flex justify-end">
                                    <TrainingModeToggle mode={trainingMode} onModeChange={(mode) => {
                                        setTrainingMode(mode);
                                        setIsFlipped(false);
                                        setAnswerState('idle');
                                        setUserAnswer('');
                                    }} />
                                </div>
                            </>
                        ) : (
                            <p className="text-slate-400 text-sm col-span-3 text-center">{counterText}</p>
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
                                <button onClick={handleDontKnow} disabled={isProgressLoading || isChangingWord} className="w-full py-3 text-lg font-semibold bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">Don't know</button>
                                <button onClick={handleKnow} disabled={isProgressLoading || isChangingWord} className="w-full py-3 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait">Know</button>
                            </>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center my-16">
                <h2 className="text-2xl font-semibold mb-4 text-slate-300">Session Complete!</h2>
                <p className="text-slate-400">You've reviewed all available cards for this set.</p>
                {selectedSetIndex !== null && dontKnowWords.get(selectedSetIndex) && dontKnowWords.get(selectedSetIndex)!.length > 0 && (
                     <button onClick={startDontKnowSession} className="mt-6 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto">
                        <Repeat size={18} />
                        Training Mode ({dontKnowWords.get(selectedSetIndex)?.length})
                    </button>
                )}
            </div>
        );
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
                
                {renderContent()}
                
                <div className="w-full mt-8 p-3 bg-slate-800/50 rounded-lg">
                    <SentenceUpload onSentencesLoaded={(newMap) => setSentences(prev => new Map([...prev, ...newMap]))} onClearSentences={() => setSentences(new Map())} hasSentences={sentences.size > 0}/>
                </div>

                {currentSet && (
                     <div className="flex items-center justify-center gap-6 mt-6">
                        <button onClick={handleShuffle} disabled={reviewWords.length <= 1} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <Shuffle size={18} /> Shuffle
                        </button>
                        <TranslationModeToggle mode={translationMode} onModeChange={setTranslationMode} lang1={currentSet.lang1} lang2={currentSet.lang2} />
                        <button onClick={() => setIsWordListVisible(v => !v)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                            <ChevronsUpDown size={18} /> List
                        </button>
                    </div>
                )}
                
                {currentSet && <WordList words={currentSet.words} isVisible={isWordListVisible} lang1={currentSet.lang1} lang2={currentSet.lang2} />}
            </div>

            <FileSourceModal isOpen={isFileSourceModalOpen && !loadedDictionary} onClose={() => setFileSourceModalOpen(false)} onFilesSelect={handleFilesSelect} isLoading={isLoading} />
            <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setInstructionsModalOpen(false)} />
            <LearnedWordsModal isOpen={isLearnedWordsModalOpen} onClose={() => setLearnedWordsModalOpen(false)} learnedWords={learnedWordsWithDetails} lang1={currentSet?.lang1 || 'Language 1'} lang2={currentSet?.lang2 || 'Language 2'} />
        </main>
    );
};

export default App;