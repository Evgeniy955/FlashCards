import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './lib/firebase-client';
import { Flashcard } from './components/Flashcard';
import { ProgressBar } from './components/ProgressBar';
import { SetSelector } from './components/SetSelector';
import { FileSourceModal } from './components/FileSourceModal';
import { InstructionsModal } from './components/InstructionsModal';
import { LearnedWordsModal } from './components/LearnedWordsModal';
import { WordList } from './components/WordList';
import { SentenceUpload } from './components/SentenceUpload';
import { Auth } from './components/Auth';
import { Word, WordSet, LoadedDictionary, WordProgress } from './types';
import { Shuffle, ChevronsUpDown, Info, BookUser, Trash2, Repeat, Library } from 'lucide-react';

// --- Constants ---
const MAX_SET_SIZE = 30;
const SRS_INTERVALS = [1, 2, 4, 8, 16, 32, 64]; // in days

// --- Helper Functions ---
const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

// Helper to extract words from a specific column pair
const extractWordsFromColumns = (jsonData: (string | null)[][], ruCol: number, enCol: number): Word[] => {
    const words: Word[] = [];
    for (const rowData of jsonData) {
        const ru = rowData?.[ruCol];
        const en = rowData?.[enCol];
        if (ru && en) {
            words.push({ ru: String(ru).trim(), en: String(en).trim() });
        }
    }
    return words;
};

// Helper to split a large word array into smaller sets
const splitIntoSubsets = (words: Word[], baseSetName: string, originalSetIndex: number): WordSet[] => {
    if (words.length <= MAX_SET_SIZE) {
        return [{ name: baseSetName, words, originalSetIndex }];
    }
    
    const subsets: WordSet[] = [];
    for (let i = 0; i < words.length; i += MAX_SET_SIZE) {
        const chunk = words.slice(i, i + MAX_SET_SIZE);
        subsets.push({
            name: `${baseSetName}.${Math.floor(i / MAX_SET_SIZE) + 1}`,
            words: chunk,
            originalSetIndex,
        });
    }
    return subsets;
};


const parseDictionaryFile = (file: File): Promise<LoadedDictionary> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: (string | null)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (!jsonData || jsonData.length === 0) {
                    throw new Error("The file is empty or in an incorrect format.");
                }

                const allSets: WordSet[] = [];
                let originalSetIndexCounter = 0;
                const maxCols = jsonData[0]?.length || 0;

                for (let col = 0; col < maxCols; col += 4) {
                    const words = extractWordsFromColumns(jsonData, col, col + 2);

                    if (words.length > 0) {
                        const baseSetName = `Set ${originalSetIndexCounter + 1}`;
                        const subsets = splitIntoSubsets(words, baseSetName, originalSetIndexCounter);
                        allSets.push(...subsets);
                        originalSetIndexCounter++;
                    }
                }
                
                if (allSets.length === 0) {
                    throw new Error("No valid word sets found. Ensure columns A/C, E/G, etc., contain words.");
                }
                resolve({ name: file.name, sets: allSets });
            } catch (err) {
                console.error("Parsing error:", err);
                reject(err instanceof Error ? err : new Error('Failed to parse the dictionary file.'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read the file.'));
        reader.readAsArrayBuffer(file);
    });
};


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

    const [isLoading, setIsLoading] = useState(false);
    const [isWordListVisible, setIsWordListVisible] = useState(false);
    const [isDontKnowMode, setIsDontKnowMode] = useState(false);
    
    const [isFileSourceModalOpen, setFileSourceModalOpen] = useState(true);
    const [isInstructionsModalOpen, setInstructionsModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setLearnedWordsModalOpen] = useState(false);

    const storageKey = useMemo(() => loadedDictionary ? `flashcard-progress-${loadedDictionary.name}` : null, [loadedDictionary]);
    
    // Load progress from localStorage
    useEffect(() => {
        if (!storageKey) return;
        const saved = localStorage.getItem(storageKey);
        setLearnedWords(new Map());
        setDontKnowWords(new Map());
        setSentences(new Map());
        if (saved) {
            try {
                const { learned, dontKnow, sentences: savedSentences } = JSON.parse(saved);
                setLearnedWords(new Map(learned));
                setDontKnowWords(new Map(dontKnow));
                if (savedSentences) setSentences(new Map(savedSentences));
            } catch (error) {
                console.error("Failed to parse saved progress", error);
                localStorage.removeItem(storageKey);
            }
        }
    }, [storageKey]);

    // Save progress to localStorage
    useEffect(() => {
        if (!storageKey) return;
        const dataToSave = {
            learned: Array.from(learnedWords.entries()),
            dontKnow: Array.from(dontKnowWords.entries()),
            sentences: Array.from(sentences.entries()),
        };
        localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    }, [learnedWords, dontKnowWords, sentences, storageKey]);

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
        if (selectedSetIndex !== null) {
            startReviewSession(selectedSetIndex);
        }
    }, [selectedSetIndex, learnedWords, startReviewSession]);
    
    const handleFilesSelect = async (name: string, wordsFile: File, sentencesFile?: File) => {
        setIsLoading(true);
        try {
            const dictionary = await parseDictionaryFile(wordsFile);
            dictionary.name = name; 
            setLoadedDictionary(dictionary);
            setSelectedSetIndex(0);
            setFileSourceModalOpen(false);

            if (sentencesFile) {
                const text = await sentencesFile.text();
                const jsonObj = JSON.parse(text);
                const sentenceMap = new Map<string, string>();
                for (const key in jsonObj) {
                    if (typeof jsonObj[key] === 'string') {
                        sentenceMap.set(key.trim().toLowerCase(), jsonObj[key]);
                    }
                }
                setSentences(sentenceMap);
            }
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
            setCurrentWordIndex(0);
            setReviewWords([]); // End of session
        }
    };

    const handleKnow = () => {
        if (!currentWord) return;
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
        goToNextWord();
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
        if (window.confirm('Are you sure you want to reset all progress for this dictionary? This action cannot be undone.')) {
            setLearnedWords(new Map());
            setDontKnowWords(new Map());
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
                
                {currentWord ? (
                    <div className="w-full flex flex-col items-center">
                         <div className="w-full text-center mb-2">
                             <p className="text-slate-400">{isDontKnowMode ? "Reviewing Mistakes" : "Learning"}: {currentWordIndex + 1} / {reviewWords.length}</p>
                        </div>
                        <ProgressBar current={currentWordIndex + 1} total={reviewWords.length} />
                        <Flashcard word={currentWord} isFlipped={isFlipped} onFlip={handleFlip} exampleSentence={exampleSentence} />
                        <div className="flex justify-center gap-4 mt-6 w-full">
                            <button onClick={handleDontKnow} className="w-full py-3 text-lg font-semibold bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors">Don't know</button>
                            <button onClick={handleKnow} className="w-full py-3 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">Know</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center my-16">
                        <h2 className="text-2xl font-semibold mb-4 text-slate-300">Session Complete!</h2>
                        <p className="text-slate-400">You've reviewed all available cards for this set.</p>
                        {dontKnowWords.get(selectedSetIndex!) && dontKnowWords.get(selectedSetIndex!)!.length > 0 && (
                             <button onClick={startDontKnowSession} className="mt-6 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto">
                                <Repeat size={18} />
                                Review {dontKnowWords.get(selectedSetIndex!)?.length} Mistake(s)
                            </button>
                        )}
                    </div>
                )}
                
                <div className="w-full mt-8 p-3 bg-slate-800/50 rounded-lg">
                    <SentenceUpload onSentencesLoaded={setSentences} onClearSentences={() => setSentences(new Map())} hasSentences={sentences.size > 0}/>
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