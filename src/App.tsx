import React, { useState, useEffect, useCallback } from 'react';
import { ChevronsUpDown, Upload, FileUp, Repeat, ArrowLeft, RotateCcw, BookCheck, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

// Firebase and Auth
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, firebaseError } from '../lib/firebase-client';
import type { Auth as FirebaseAuth } from 'firebase/auth';
import { Auth } from './components/Auth';

// Components
import { SetSelector } from './components/SetSelector';
import { Flashcard } from './components/Flashcard';
import { ProgressBar } from './components/ProgressBar';
import { WordList } from './components/WordList';
import { SentenceUpload } from './components/SentenceUpload';
import { FileSourceModal } from './components/FileSourceModal';
import { InstructionsModal } from './components/InstructionsModal';
import { LearnedWordsModal } from './components/LearnedWordsModal';
import type { Word, WordSet, LoadedDictionary, WordProgress } from './types';

const MAX_WORDS_PER_BLOCK = 30;
const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 90, 180, 365];

// Type for the combined progress map from the cloud
type SrsProgressCloud = Map<string, WordProgress>;

interface AppContentProps {
  auth: FirebaseAuth;
}

const AppContent: React.FC<AppContentProps> = ({ auth }) => {
    // --- Auth State ---
    const [user, authLoading] = useAuthState(auth);

    // --- State Management ---
    const [loadedDictionary, setLoadedDictionary] = useState<LoadedDictionary | null>(null);
    const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showWordList, setShowWordList] = useState(false);
    const [isFileModalOpen, setIsFileModalOpen] = useState(false);
    const [isInstructionsModalOpen, setIsInstructionsModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setIsLearnedWordsModalOpen] = useState(false);
    const [allLearnedWords, setAllLearnedWords] = useState<(Word & { progress: WordProgress })[]>([]);
    const [unknownWords, setUnknownWords] = useState<Word[]>([]);
    const [isTraining, setIsTraining] = useState(false);
    const [isSetFinished, setIsSetFinished] = useState(false);
    const [sentences, setSentences] = useState<Map<string, string>>(new Map());
    const [sessionWords, setSessionWords] = useState<Word[]>([]);
    const [history, setHistory] = useState<number[]>([]);
    const [srsProgress, setSrsProgress] = useState<SrsProgressCloud>(new Map());
    const [isProcessing, setIsProcessing] = useState(false);

    const currentSet = loadedDictionary && selectedSetIndex !== null ? loadedDictionary.sets[selectedSetIndex] : null;
    const currentWord = sessionWords[currentWordIndex];

    const getAuthToken = useCallback(async () => {
        if (!user) return null;
        return await user.getIdToken();
    }, [user]);

    // --- Effects ---
    // Load progress from cloud when user logs in
    useEffect(() => {
        const fetchProgress = async () => {
            const token = await getAuthToken();
            if (!token) return;

            setIsLoading(true);
            try {
                const response = await fetch('/api/progress/get', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!response.ok) throw new Error('Failed to fetch progress');
                
                const data = await response.json();
                const progressMap = new Map<string, WordProgress>();
                for (const key in data) {
                    progressMap.set(key, data[key]);
                }
                setSrsProgress(progressMap);
            } catch (error) {
                console.error("Error fetching user progress:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (user) {
            fetchProgress();
        } else {
            // If user logs out, reset everything to a clean slate
            resetState(true);
        }
    }, [user, getAuthToken]);
    
    // Auto-load default sentences on first launch (from localStorage)
    useEffect(() => {
        const storedSentences = localStorage.getItem('global_sentence_dictionary');
        if (storedSentences) {
            setSentences(new Map(JSON.parse(storedSentences)));
        } 
    }, []);

    // Check if the set is finished
    useEffect(() => {
      if (sessionWords.length > 0 && currentWordIndex >= sessionWords.length) {
        setIsSetFinished(true);
      }
    }, [currentWordIndex, sessionWords]);

    // --- File & Data Handling ---
    const resetState = (fullReset = true) => {
        if (fullReset) {
            setLoadedDictionary(null);
            setSrsProgress(new Map());
        }
        setSelectedSetIndex(null);
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setUnknownWords([]);
        setIsTraining(false);
        setIsSetFinished(false);
        setSessionWords([]);
        setHistory([]);
    };

    const processWordFile = async (file: File): Promise<WordSet[]> => {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const allSets: WordSet[] = [];
      let originalSetCounter = 0;

      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (!jsonData || jsonData.length === 0) return;
        
        let wordsInSheet: Word[] = [];

        // --- Strategy 1: Try the 4-column format ---
        const maxCols = Math.max(0, ...jsonData.map(row => row?.length || 0));
        if (maxCols >= 3) {
            for (let col = 0; col <= maxCols - 3; col += 4) {
              const wordsInSet: Word[] = [];
              for (const row of jsonData) {
                if(!row || row.every(cell => !cell || String(cell).trim() === '')) continue; // Skip empty rows
                const ru = String(row[col] || '').trim();
                const en = String(row[col + 2] || '').trim();
                if (ru && en) wordsInSet.push({ ru, en });
              }
              if (wordsInSet.length > 0) wordsInSheet.push(...wordsInSet);
            }
        }

        // --- Strategy 2: If 4-column format yielded no words, try simple 2-column format ---
        if (wordsInSheet.length === 0) {
            const wordsInSet: Word[] = [];
            for (const row of jsonData) {
              if(!row || row.every(cell => !cell || String(cell).trim() === '')) continue; // Skip empty rows
              const ru = String(row[0] || '').trim();
              const en = String(row[1] || '').trim();
              if (ru && en) wordsInSet.push({ ru, en });
            }
            if (wordsInSet.length > 0) wordsInSheet.push(...wordsInSet);
        }

        // --- Process the collected words from the sheet ---
        if (wordsInSheet.length > 0) {
            if (wordsInSheet.length > MAX_WORDS_PER_BLOCK) {
              for (let i = 0; i < wordsInSheet.length; i += MAX_WORDS_PER_BLOCK) {
                const chunk = wordsInSheet.slice(i, i + MAX_WORDS_PER_BLOCK);
                allSets.push({
                  name: `Set ${originalSetCounter + 1} (${i + 1}-${i + chunk.length})`,
                  words: chunk,
                  originalSetIndex: originalSetCounter
                });
              }
            } else {
              allSets.push({ name: `Set ${originalSetCounter + 1}`, words: wordsInSheet, originalSetIndex: originalSetCounter });
            }
            originalSetCounter++;
          }
      });
      return allSets;
    };
    
    const handleFilesSelect = async (name: string, wordsFile: File, sentencesFile?: File) => {
        setIsLoading(true);
        resetState();
        try {
            const wordSetsFromFile = await processWordFile(wordsFile);
            if (wordSetsFromFile.length > 0) {
                const newDictionary = { name, sets: wordSetsFromFile };
                setLoadedDictionary(newDictionary);
                handleSelectSet(0, newDictionary);
            } else {
                alert("No valid word pairs found in the Excel file. Please check the format and ensure the file is not empty.");
            }

            if (sentencesFile) {
              const text = await sentencesFile.text();
              const jsonObj = JSON.parse(text);
              const newSentences = new Map<string, string>();
              for (const key in jsonObj) {
                if (typeof jsonObj[key] === 'string') newSentences.set(key.trim().toLowerCase(), jsonObj[key]);
              }
              handleSentencesLoaded(newSentences);
            }
        } catch (error) {
            console.error("Error processing files:", error);
            alert("Failed to process files.");
        } finally {
            setIsLoading(false);
            setIsFileModalOpen(false);
        }
    };
    
    const handleSentencesLoaded = (newSentences: Map<string, string>) => {
      setSentences(prevSentences => {
          const merged = new Map([...prevSentences, ...newSentences]);
          localStorage.setItem('global_sentence_dictionary', JSON.stringify(Array.from(merged.entries())));
          return merged;
      });
    };

    const handleClearSentences = () => {
        setSentences(new Map());
        localStorage.removeItem('global_sentence_dictionary');
    };

    const getProgressKey = (dictName: string, wordEn: string) => `${dictName}::${wordEn}`;

    const saveProgressToCloud = async (progressKey: string, progressData: WordProgress) => {
        const token = await getAuthToken();
        if (!token) return;
        try {
            await fetch('/api/progress/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ progressKey, progressData })
            });
        } catch (error) {
            console.error("Failed to save progress to cloud:", error);
        }
    };

    // --- User Actions ---
    const handlePrevious = () => {
      if (history.length === 0 || isProcessing) return;
      setIsProcessing(true);
      const newHistory = [...history];
      const previousIndex = newHistory.pop();
      if (previousIndex !== undefined) {
        setHistory(newHistory);
        setCurrentWordIndex(previousIndex);
        setIsFlipped(false);
      }
      setTimeout(() => setIsProcessing(false), 50);
    };
    
    const handleShuffle = () => {
      if (sessionWords.length < 2) return;
      setSessionWords(prev => [...prev].sort(() => Math.random() - 0.5));
      setCurrentWordIndex(0);
      setIsFlipped(false);
      setIsSetFinished(false);
      setHistory([]);
    };

    const handleProgressUpdate = (isKnown: boolean) => {
        if (!currentWord || !loadedDictionary || !currentSet || isProcessing) return;
        setIsProcessing(true);

        const progressKey = getProgressKey(loadedDictionary.name, currentWord.en);
        let updatedProgress: WordProgress;

        if (isKnown) {
            const currentProgress = srsProgress.get(progressKey) || { srsStage: 0, isUnknown: false, dictionaryName: loadedDictionary.name, originalSetIndex: currentSet.originalSetIndex, nextReviewDate: new Date().toISOString() };
            const newStage = Math.min(currentProgress.srsStage + 1, SRS_INTERVALS_DAYS.length);
            const intervalDays = SRS_INTERVALS_DAYS[newStage - 1];
            const nextReviewDate = new Date();
            nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
            updatedProgress = { 
                ...currentProgress, 
                srsStage: newStage, 
                nextReviewDate: nextReviewDate.toISOString(), 
                isUnknown: false,
            };
        } else {
             updatedProgress = {
                srsStage: 0,
                nextReviewDate: new Date().toISOString(),
                isUnknown: true,
                dictionaryName: loadedDictionary.name,
                originalSetIndex: currentSet.originalSetIndex
            };
        }

        const newProgressMap = new Map(srsProgress);
        newProgressMap.set(progressKey, updatedProgress);
        setSrsProgress(newProgressMap);
        saveProgressToCloud(progressKey, updatedProgress);

        setHistory(prev => [...prev, currentWordIndex]);
        setIsFlipped(false);
        setTimeout(() => {
            if (isTraining) {
                setSessionWords(prev => prev.filter(w => w.en !== currentWord.en || w.ru !== currentWord.ru));
            } else {
                setCurrentWordIndex(prev => prev + 1);
            }
            setIsProcessing(false);
        }, 250);
    };

    const handleSelectSet = (index: number, dict = loadedDictionary) => {
        if (!dict) return;
        
        const set = dict.sets[index];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const unknownInSet: Word[] = [];
        const wordsForReview = set.words.filter(word => {
            const key = getProgressKey(dict.name, word.en);
            const progress = srsProgress.get(key);
            if (!progress) return true; // New word
            if (progress.isUnknown) unknownInSet.push(word);
            const reviewDate = new Date(progress.nextReviewDate);
            return reviewDate <= today; // Word is due for review
        });
        
        setSessionWords(wordsForReview.sort(() => Math.random() - 0.5));
        setUnknownWords(unknownInSet);
        setSelectedSetIndex(index);
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setIsSetFinished(false);
        setIsTraining(false);
        setHistory([]);
    };

    const startTraining = () => {
      const shuffled = [...unknownWords].sort(() => Math.random() - 0.5);
      setSessionWords(shuffled);
      setIsTraining(true);
      setCurrentWordIndex(0);
      setIsSetFinished(false);
      setHistory([]);
    };

    const handleReturnToSetSelection = () => {
      setSelectedSetIndex(null); 
    };
    
    const handleResetAllProgress = async () => {
        if (!loadedDictionary || !window.confirm("Are you sure? This will delete all cloud progress for this dictionary.")) return;
        const token = await getAuthToken();
        if(!token) return;

        try {
            await fetch('/api/progress/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ dictionaryName: loadedDictionary.name })
            });

            // Filter out progress for the current dictionary from local state
            const newProgressMap = new Map<string, WordProgress>();
            srsProgress.forEach((value, key) => {
                if(value.dictionaryName !== loadedDictionary.name) {
                    newProgressMap.set(key, value);
                }
            });
            setSrsProgress(newProgressMap);
            setAllLearnedWords([]);
            setIsLearnedWordsModalOpen(false);

            // Reload current set
            if (selectedSetIndex !== null) handleSelectSet(selectedSetIndex, loadedDictionary);
            
            alert("Learning progress has been reset.");
        } catch (error) {
            console.error("Failed to reset progress:", error);
            alert("Error resetting progress.");
        }
    };

    const handleShowLearnedWords = () => {
        if (!loadedDictionary) return;

        const learned: (Word & { progress: WordProgress })[] = [];
        const wordMap = new Map<string, Word>();
        loadedDictionary.sets.forEach(set => set.words.forEach(word => wordMap.set(word.en, word)));

        srsProgress.forEach((progress, key) => {
            if (progress.dictionaryName === loadedDictionary.name && progress.srsStage > 0) {
                const enWord = key.split('::')[1];
                const word = wordMap.get(enWord);
                if (word) {
                    learned.push({ ...word, progress });
                }
            }
        });
        
        setAllLearnedWords(learned.sort((a, b) => a.ru.localeCompare(b.ru)));
        setIsLearnedWordsModalOpen(true);
    };


    // --- Render Logic ---
    const renderContent = () => {
        if (authLoading) {
            return <div className="text-center text-slate-400">Loading user session...</div>;
        }

        if (!user) {
             return (
              <div className="text-center">
                <h1 className="text-4xl sm:text-5xl font-bold mb-2">Flashcard Trainer</h1>
                <p className="text-slate-400 mb-8">Sign in to save your progress to the cloud.</p>
                <Auth />
              </div>
            );
        }

        if (!loadedDictionary) {
            return (
              <div className="text-center">
                <header className="absolute top-4 right-4"><Auth /></header>
                <h1 className="text-4xl sm:text-5xl font-bold mb-2">Welcome!</h1>
                <p className="text-slate-400 mb-8">Select a dictionary to get started.</p>
                <button onClick={() => setIsFileModalOpen(true)} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-lg rounded-lg font-semibold transition-colors flex items-center gap-3 shadow-lg mx-auto">
                  <FileUp size={20} /> Select Dictionary
                </button>
              </div>
            );
        }
      
        if (isSetFinished) {
            return (
              <div className="text-center">
                 <h1 className="text-2xl font-bold text-slate-200 text-center mb-6">{loadedDictionary.name}</h1>
                <h2 className="text-3xl font-bold mb-4">{isTraining ? "Practice Finished!" : "Set Finished!"}</h2>
                
                {unknownWords.length > 0 && !isTraining ? (
                   <button onClick={startTraining} className="px-6 py-3 bg-rose-600 hover:bg-rose-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto">
                      <Repeat size={18} /> {`Train ${unknownWords.length} "Don't Know" word(s)`}
                    </button>
                ) : (
                   <>
                      <p className="text-emerald-400 mb-6">Well done! No more unknown words in this set.</p>
                      <button onClick={handleReturnToSetSelection} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto">
                          Select New Set
                      </button>
                   </>
                )}
              </div>
            );
        }
  
        if (selectedSetIndex === null) {
            return (
              <div className="w-full max-w-4xl">
                  <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                      <h1 className="text-2xl font-bold text-slate-200 text-center">{loadedDictionary.name}</h1>
                       <div className="flex items-center gap-2">
                          <button onClick={handleShowLearnedWords} className="px-4 py-2 bg-sky-700 hover:bg-sky-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"><BookCheck size={16} /> Learned</button>
                          <button onClick={handleResetAllProgress} className="px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"><RotateCcw size={16} /> Reset</button>
                          <button onClick={() => setIsFileModalOpen(true)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"><Upload size={16} /> Change</button>
                          <Auth />
                      </div>
                  </header>
                  <main className="flex flex-col items-center">
                    <SetSelector sets={loadedDictionary.sets} selectedSetIndex={selectedSetIndex} onSelectSet={handleSelectSet} />
                    <p className="text-slate-400">Please select a set to begin.</p>
                  </main>
              </div>
            );
        }

        return (
          <div className="w-full max-w-2xl">
              <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                  <h1 className="text-2xl font-bold text-slate-200 text-center">{loadedDictionary.name}</h1>
                  <div className="flex items-center gap-2">
                       <button onClick={handleShowLearnedWords} title="Learned Words" className="p-2 bg-sky-700 hover:bg-sky-600 rounded-lg text-sm font-semibold"><BookCheck size={16} /></button>
                      <button onClick={handleResetAllProgress} title="Reset Progress" className="p-2 bg-rose-700 hover:bg-rose-600 rounded-lg text-sm font-semibold"><RotateCcw size={16} /></button>
                      <button onClick={() => setIsFileModalOpen(true)} title="Change Dictionary" className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold"><Upload size={16} /></button>
                      <Auth />
                  </div>
              </header>
  
              <main className="flex flex-col items-center">
                  {!isTraining && <SetSelector sets={loadedDictionary.sets} selectedSetIndex={selectedSetIndex} onSelectSet={handleSelectSet} />}
                  {isTraining && <h2 className="text-xl font-semibold text-rose-400 mb-6">Training Mode: {sessionWords.length} words remaining</h2>}
                  
                  {currentWord ? (
                      <>
                          <Flashcard word={currentWord} isFlipped={isFlipped} onFlip={() => setIsFlipped(!isFlipped)} exampleSentence={sentences.get(currentWord.en.toLowerCase().trim())} />
                          <div className="w-full max-w-md mt-6">
                              <ProgressBar current={currentWordIndex + 1} total={sessionWords.length} />
                              <div className="flex justify-between items-center text-sm text-slate-400">
                                  <span>{currentWordIndex + 1} / {sessionWords.length}</span>
                                  <div className="flex items-center gap-1">
                                      <button onClick={handleShuffle} title="Shuffle" className="p-2 rounded-full hover:bg-slate-800"><Repeat size={18} /></button>
                                      {!isTraining && <button onClick={() => setShowWordList(!showWordList)} title="Toggle List" className="p-2 rounded-full hover:bg-slate-800"><ChevronsUpDown size={18} /></button>}
                                  </div>
                              </div>
                          </div>
  
                          <div className="flex items-center gap-4 mt-6 w-full max-w-md">
                             <button onClick={handlePrevious} disabled={history.length === 0 || isProcessing} className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50"><ArrowLeft size={24} /></button>
                              <button onClick={() => handleProgressUpdate(false)} disabled={isProcessing} className="flex-1 px-6 py-3 bg-rose-800 hover:bg-rose-700 rounded-lg font-semibold disabled:opacity-50">Don't know</button>
                              <button onClick={() => handleProgressUpdate(true)} disabled={isProcessing} className="flex-1 px-6 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg font-semibold disabled:opacity-50">Know</button>
                          </div>
  
                          {currentSet && <div className="w-full max-w-md mt-8">
                              <WordList words={currentSet.words} isVisible={showWordList && !isTraining} />
                          </div>}
                          
                          <div className="w-full max-w-md mt-8 p-4 bg-slate-800 rounded-lg">
                            <SentenceUpload onSentencesLoaded={handleSentencesLoaded} onClearSentences={handleClearSentences} hasSentences={sentences.size > 0} />
                          </div>
                      </>
                  ) : (
                      <p className="text-slate-400 mt-8">No words to review in this set for today. Well done!</p>
                  )}
              </main>
          </div>
        );
    };

    return (
      <div className="min-h-screen flex flex-col p-4 sm:p-6 md:p-8">
        {user && <FileSourceModal isOpen={isFileModalOpen} onClose={() => setIsFileModalOpen(false)} onFilesSelect={handleFilesSelect} isLoading={isLoading} />}
        <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setIsInstructionsModalOpen(false)} />
        {user && <LearnedWordsModal isOpen={isLearnedWordsModalOpen} onClose={() => setIsLearnedWordsModalOpen(false)} learnedWords={allLearnedWords} />}
        
        <main className="flex-grow flex flex-col items-center justify-center">
          {renderContent()}
        </main>
        
        <footer className="w-full text-center py-2">
            <button onClick={() => setIsInstructionsModalOpen(true)} className="text-sm text-slate-500 hover:text-indigo-400 transition-colors underline">
              Інструкція з використання (українською)
            </button>
        </footer>
      </div>
    );
}

// ----- Main App Wrapper -----
const App: React.FC = () => {
    if (firebaseError) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="w-full max-w-2xl text-center p-6 bg-rose-900/50 border border-rose-600 rounded-lg">
                    <div className="flex justify-center items-center gap-3 mb-4">
                        <AlertTriangle className="w-8 h-8 text-rose-400" />
                        <h1 className="text-2xl font-bold text-rose-300">Configuration Error</h1>
                    </div>
                    <p className="mt-2 text-rose-300">
                        The application could not connect to Firebase. This usually means the environment variables are not set up correctly.
                    </p>
                    <p className="mt-2 text-slate-400 text-sm">
                        Please follow the setup instructions in the `README.md` file to configure your Firebase project and environment variables.
                    </p>
                    <pre className="mt-4 text-xs text-left bg-slate-800 p-3 rounded text-rose-400 whitespace-pre-wrap overflow-x-auto">
                        {firebaseError}
                    </pre>
                </div>
            </div>
        );
    }
    
    // This is a guard to prevent the app from crashing before Firebase is ready.
    if (!auth) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Connecting to services...</span>
                </div>
            </div>
        );
    }
    
    return <AppContent auth={auth} />;
}

export default App;