import React, { useState, useEffect, useCallback } from 'react';
import { ChevronsUpDown, Upload, FileUp, Repeat, ArrowLeft, RotateCcw, BookCheck, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SetSelector } from './components/SetSelector';
import { Flashcard } from './components/Flashcard';
import { ProgressBar } from './components/ProgressBar';
import { WordList } from './components/WordList';
import { SentenceUpload } from './components/SentenceUpload';
import { FileSourceModal } from './components/FileSourceModal';
import { InstructionsModal } from './components/InstructionsModal';
import { LearnedWordsModal } from './components/LearnedWordsModal';
import { Auth } from './components/Auth';
import type { Word, WordSet, LoadedDictionary, WordProgress } from './types';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './lib/firebase-client';
import { doc, getDoc, setDoc, deleteDoc, writeBatch, collection, getDocs } from 'firebase/firestore';


const MAX_WORDS_PER_BLOCK = 30;
const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 90, 180, 365];
const DICTIONARY_STORAGE_KEY = 'flashcardApp_dictionary';
const SENTENCES_STORAGE_KEY = 'flashcardApp_sentences';

const getSrsStorageKey = (dictName: string, originalSetIdx: number) => `srs_${dictName}_${originalSetIdx}`;
const getUnknownWordsStorageKey = (dictName: string, originalSetIdx: number) => `unknown_${dictName}_${originalSetIdx}`;

// ----- Main App Component -----
const App: React.FC = () => {
    // --- Auth State ---
    const [user, setUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);

    // --- App State ---
    const [loadedDictionary, setLoadedDictionary] = useState<LoadedDictionary | null>(() => {
        try {
            const saved = localStorage.getItem(DICTIONARY_STORAGE_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
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
    const [sentences, setSentences] = useState<Map<string, string>>(() => {
        try {
            const saved = localStorage.getItem(SENTENCES_STORAGE_KEY);
            return saved ? new Map(JSON.parse(saved)) : new Map();
        } catch { return new Map(); }
    });
    const [sessionWords, setSessionWords] = useState<Word[]>([]);
    const [history, setHistory] = useState<number[]>([]);
    const [srsProgress, setSrsProgress] = useState<Map<string, WordProgress>>(new Map());
    const [isProcessing, setIsProcessing] = useState(false);

    const currentSet = loadedDictionary && selectedSetIndex !== null ? loadedDictionary.sets[selectedSetIndex] : null;
    const currentWord = sessionWords[currentWordIndex];

    // --- Firestore Helper Functions ---
    const getSrsDocRef = (userId: string, dictName: string, originalSetIdx: number) => doc(db, 'users', userId, 'srs_progress', `${dictName}_${originalSetIdx}`);
    const getUnknownWordsDocRef = (userId: string, dictName: string, originalSetIdx: number) => doc(db, 'users', userId, 'unknown_words', `${dictName}_${originalSetIdx}`);
    const getSentencesDocRef = (userId: string) => doc(db, 'users', userId, 'sentences', 'global');
    
    // --- Data Persistence ---
    useEffect(() => {
        if (loadedDictionary) {
            localStorage.setItem(DICTIONARY_STORAGE_KEY, JSON.stringify(loadedDictionary));
        } else {
            localStorage.removeItem(DICTIONARY_STORAGE_KEY);
        }
    }, [loadedDictionary]);
    
    useEffect(() => {
        localStorage.setItem(SENTENCES_STORAGE_KEY, JSON.stringify(Array.from(sentences.entries())));
    }, [sentences]);

    const updateSrsProgress = useCallback((newProgress: Map<string, WordProgress>) => {
        setSrsProgress(newProgress);
        if (currentSet && loadedDictionary) {
            const key = getSrsStorageKey(loadedDictionary.name, currentSet.originalSetIndex);
            localStorage.setItem(key, JSON.stringify(Array.from(newProgress.entries())));
            if (user) {
                const docRef = getSrsDocRef(user.uid, loadedDictionary.name, currentSet.originalSetIndex);
                setDoc(docRef, { progress: Array.from(newProgress.entries()) }).catch(e => console.error("Firestore SRS save failed:", e));
            }
        }
    }, [currentSet, loadedDictionary, user]);

    const updateUnknownWords = useCallback((newUnknownWords: Word[]) => {
        setUnknownWords(newUnknownWords);
        if (currentSet && loadedDictionary) {
            const key = getUnknownWordsStorageKey(loadedDictionary.name, currentSet.originalSetIndex);
            localStorage.setItem(key, JSON.stringify(newUnknownWords));
            if (user) {
                const docRef = getUnknownWordsDocRef(user.uid, loadedDictionary.name, currentSet.originalSetIndex);
                setDoc(docRef, { words: newUnknownWords }).catch(e => console.error("Firestore unknown words save failed:", e));
            }
        }
    }, [currentSet, loadedDictionary, user]);

    // --- Auth and Syncing ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUser(user);
                setIsSyncing(true);
                // --- Sync data on login ---
                const remoteSentencesRef = getSentencesDocRef(user.uid);
                const remoteSentencesSnap = await getDoc(remoteSentencesRef);

                if (remoteSentencesSnap.exists()) {
                    // Remote sentences exist, overwrite local
                    setSentences(new Map(remoteSentencesSnap.data().sentences));
                } else {
                    // No remote sentences, upload local
                    const localSentences = localStorage.getItem(SENTENCES_STORAGE_KEY);
                    if (localSentences) {
                        await setDoc(remoteSentencesRef, { sentences: JSON.parse(localSentences) });
                    }
                }
                setIsSyncing(false);
            } else {
                setUser(null);
                // On sign out, clear user-specific state to avoid data leaks
                // but keep the dictionary and sentences for the next "guest" user.
                if(loadedDictionary) {
                     loadedDictionary.sets.forEach(set => {
                        localStorage.removeItem(getSrsStorageKey(loadedDictionary.name, set.originalSetIndex));
                        localStorage.removeItem(getUnknownWordsStorageKey(loadedDictionary.name, set.originalSetIndex));
                     });
                }
                setSrsProgress(new Map());
                setUnknownWords([]);
            }
            setAuthLoading(false);
        });
        return () => unsubscribe();
    }, [loadedDictionary]); // Rerun if dictionary changes while auth state is being determined


    // Check if the set is finished
    useEffect(() => {
        const isFinished = currentWordIndex >= sessionWords.length;
        if (isFinished && sessionWords.length > 0) {
            setIsSetFinished(true);
        }
    }, [currentWordIndex, sessionWords]);

    // Pre-load default sentences if none exist
    useEffect(() => {
        if (sentences.size === 0 && !localStorage.getItem(SENTENCES_STORAGE_KEY)) {
            fetch('/sentences/phrases1.json')
                .then(res => res.ok ? res.json() : null)
                .then(jsonObj => {
                    if (!jsonObj) return;
                    const sentenceMap = new Map<string, string>();
                    for (const key in jsonObj) {
                        if (typeof jsonObj[key] === 'string') {
                            sentenceMap.set(key.trim().toLowerCase(), jsonObj[key]);
                        }
                    }
                    if (sentenceMap.size > 0) {
                        setSentences(sentenceMap);
                    }
                })
                .catch(err => console.error("Could not pre-load sentences:", err));
        }
    }, []);

    // --- File & Data Handling ---
    const resetStateForNewDictionary = () => {
        setSelectedSetIndex(null);
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setUnknownWords([]);
        setIsTraining(false);
        setIsSetFinished(false);
        setSessionWords([]);
        setHistory([]);
        setSrsProgress(new Map());
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
          const maxCols = Math.max(...jsonData.map(row => row.length));
          for (let col = 0; col <= maxCols - 3; col += 4) {
            const wordsInSet: Word[] = [];
            for (const row of jsonData) {
              const ru = String(row[col] || '').trim();
              const en = String(row[col + 2] || '').trim();
              if (ru && en) {
                wordsInSet.push({ ru, en });
              }
            }
            if (wordsInSet.length > 0) {
              if (wordsInSet.length > MAX_WORDS_PER_BLOCK) {
                for (let i = 0; i < wordsInSet.length; i += MAX_WORDS_PER_BLOCK) {
                  const chunk = wordsInSet.slice(i, i + MAX_WORDS_PER_BLOCK);
                  allSets.push({ name: `Set ${originalSetCounter + 1} (${i + 1}-${i + chunk.length})`, words: chunk, originalSetIndex: originalSetCounter });
                }
              } else {
                allSets.push({ name: `Set ${originalSetCounter + 1}`, words: wordsInSet, originalSetIndex: originalSetCounter });
              }
              originalSetCounter++;
            }
          }
        });
        return allSets;
    };
    
    const processSentenceFile = async (file: File): Promise<Map<string, string>> => {
      const sentenceMap = new Map<string, string>();
      if (file.name.endsWith('.json')) {
        const text = await file.text();
        const jsonObj = JSON.parse(text);
        for (const key in jsonObj) {
          if (typeof jsonObj[key] === 'string') {
            sentenceMap.set(key.trim().toLowerCase(), jsonObj[key]);
          }
        }
      } else if (file.name.endsWith('.xlsx')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: string[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        jsonData.forEach(row => {
          if (row && row[0] && row[1]) {
            sentenceMap.set(String(row[0]).trim().toLowerCase(), String(row[1]).trim());
          }
        });
      }
      return sentenceMap;
    };

    const handleFilesSelect = async (name: string, wordsFile: File, sentencesFile?: File) => {
        setIsLoading(true);
        resetStateForNewDictionary();
        try {
            const wordSetsFromFile = await processWordFile(wordsFile);
            if (wordSetsFromFile.length > 0) {
                const newDictionary = { name, sets: wordSetsFromFile };
                setLoadedDictionary(newDictionary);
                handleSelectSet(0, newDictionary); // Select first set of new dictionary
            } else {
                alert("No valid words found. Ensure format is 'Russian - Empty Column - English'.");
            }
            if (sentencesFile) {
              const newSentences = await processSentenceFile(sentencesFile);
              handleSentencesLoaded(newSentences, true); // Overwrite sentences
            }
        } catch (error) {
            console.error("Error processing files:", error);
            alert("Failed to process files.");
        } finally {
            setIsLoading(false);
            setIsFileModalOpen(false);
        }
    };
    
    const handleSentencesLoaded = async (newSentences: Map<string, string>, overwrite = false) => {
      const merged = overwrite ? newSentences : new Map([...sentences, ...newSentences]);
      setSentences(merged);
      if (user) {
        const sentencesDocRef = getSentencesDocRef(user.uid);
        await setDoc(sentencesDocRef, { sentences: Array.from(merged.entries()) });
      }
    };

    const handleClearSentences = async () => {
        setSentences(new Map());
        localStorage.removeItem(SENTENCES_STORAGE_KEY);
        if (user) {
            const sentencesDocRef = getSentencesDocRef(user.uid);
            await deleteDoc(sentencesDocRef);
        }
    };

    const handleKnow = () => {
        if (!currentWord || !loadedDictionary || !currentSet || isProcessing) return;
        setIsProcessing(true);

        const currentProgress = srsProgress.get(currentWord.en) || { srsStage: 0, nextReviewDate: new Date().toISOString() };
        const newStage = Math.min(currentProgress.srsStage + 1, SRS_INTERVALS_DAYS.length);
        const intervalDays = SRS_INTERVALS_DAYS[newStage - 1];
        const nextReviewDate = new Date();
        nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
        const updatedProgress: WordProgress = { srsStage: newStage, nextReviewDate: nextReviewDate.toISOString() };
        
        const newProgressMap = new Map(srsProgress);
        newProgressMap.set(currentWord.en, updatedProgress);
        updateSrsProgress(newProgressMap);
        
        setHistory(prev => [...prev, currentWordIndex]);
        setIsFlipped(false);
        setTimeout(() => {
          if (isTraining) {
              const updatedUnknown = unknownWords.filter(w => w.en !== currentWord.en || w.ru !== currentWord.ru);
              updateUnknownWords(updatedUnknown);
              setSessionWords(prev => prev.filter(w => w.en !== currentWord.en || w.ru !== currentWord.ru));
              
              if (updatedUnknown.length === 0) setIsSetFinished(true);
          } else {
              setCurrentWordIndex(prev => prev + 1);
          }
          setIsProcessing(false);
        }, 250);
    };

    const handleDontKnow = () => {
      if (!currentWord || !loadedDictionary || !currentSet || isProcessing) return;
      setIsProcessing(true);

      const newProgressMap = new Map(srsProgress);
      if (newProgressMap.has(currentWord.en)) {
        const updatedProgress: WordProgress = { srsStage: 0, nextReviewDate: new Date().toISOString() };
        newProgressMap.set(currentWord.en, updatedProgress);
        updateSrsProgress(newProgressMap);
      }

      setHistory(prev => [...prev, currentWordIndex]);
      setIsFlipped(false);
      setTimeout(() => {
        if (!isTraining) {
            const isAlreadyInList = unknownWords.some(w => w.en === currentWord.en && w.ru === currentWord.ru);
            if (!isAlreadyInList) {
                updateUnknownWords([...unknownWords, currentWord]);
            }
        }
        setCurrentWordIndex(prev => prev + 1);
        setIsProcessing(false);
      }, 250);
    };

    const handleSelectSet = useCallback(async (index: number, dict = loadedDictionary) => {
        if (!dict) return;
        const set = dict.sets[index];
        
        let progressMap: Map<string, WordProgress> = new Map();
        let loadedUnknowns: Word[] = [];

        if (user) { // Logged in: fetch from Firestore
            const srsDocRef = getSrsDocRef(user.uid, dict.name, set.originalSetIndex);
            const unknownDocRef = getUnknownWordsDocRef(user.uid, dict.name, set.originalSetIndex);
            const [srsSnap, unknownSnap] = await Promise.all([getDoc(srsDocRef), getDoc(unknownDocRef)]);
            if (srsSnap.exists()) progressMap = new Map(srsSnap.data().progress);
            if (unknownSnap.exists()) loadedUnknowns = unknownSnap.data().words || [];
        } else { // Logged out: fetch from localStorage
            const srsKey = getSrsStorageKey(dict.name, set.originalSetIndex);
            const unknownKey = getUnknownWordsStorageKey(dict.name, set.originalSetIndex);
            try {
                const savedSrs = localStorage.getItem(srsKey);
                if (savedSrs) progressMap = new Map(JSON.parse(savedSrs));
                const savedUnknown = localStorage.getItem(unknownKey);
                if(savedUnknown) loadedUnknowns = JSON.parse(savedUnknown);
            } catch (e) { console.error("Failed to load from localStorage", e); }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const wordsForReview = set.words.filter(word => {
            const progress = progressMap.get(word.en);
            if (!progress) return true;
            const reviewDate = new Date(progress.nextReviewDate);
            return reviewDate <= today;
        });
        
        const shuffledWords = wordsForReview.sort(() => Math.random() - 0.5);

        setSelectedSetIndex(index);
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setIsSetFinished(false);
        setIsTraining(false);
        setSessionWords(shuffledWords);
        setSrsProgress(progressMap);
        setUnknownWords(loadedUnknowns);
        setHistory([]);
    }, [user]);

    const startTraining = async () => {
      if (!loadedDictionary || selectedSetIndex === null) return;
      const set = loadedDictionary.sets[selectedSetIndex];
      let wordsToTrain: Word[];
      if(user) {
        const docRef = getUnknownWordsDocRef(user.uid, loadedDictionary.name, set.originalSetIndex);
        const docSnap = await getDoc(docRef);
        wordsToTrain = docSnap.exists() ? (docSnap.data().words || []) : [];
      } else {
        const key = getUnknownWordsStorageKey(loadedDictionary.name, set.originalSetIndex);
        wordsToTrain = JSON.parse(localStorage.getItem(key) || '[]');
      }
      
      const shuffledWords = [...wordsToTrain].sort(() => Math.random() - 0.5);
      
      setUnknownWords(wordsToTrain);
      setSessionWords(shuffledWords);
      setIsTraining(true);
      setCurrentWordIndex(0);
      setIsSetFinished(false);
      setHistory([]);
    };
    
    const handleResetAllProgress = async () => {
        if (!loadedDictionary || !window.confirm("Are you sure? This will delete all learning progress for this dictionary.")) return;

        const uniqueOriginalIndexes = [...new Set(loadedDictionary.sets.map(s => s.originalSetIndex))];

        if (user) {
            const batch = writeBatch(db);
            for (const index of uniqueOriginalIndexes) {
                batch.delete(getSrsDocRef(user.uid, loadedDictionary.name, index));
                batch.delete(getUnknownWordsDocRef(user.uid, loadedDictionary.name, index));
            }
            await batch.commit();
        }
        
        for (const index of uniqueOriginalIndexes) {
            localStorage.removeItem(getSrsStorageKey(loadedDictionary.name, index));
            localStorage.removeItem(getUnknownWordsStorageKey(loadedDictionary.name, index));
        }

        setAllLearnedWords([]);
        if (isLearnedWordsModalOpen) setIsLearnedWordsModalOpen(false);
        if (selectedSetIndex !== null) handleSelectSet(selectedSetIndex); // Reload current set
        
        alert("Learning progress has been reset.");
    };

    const handleShowLearnedWords = async () => {
        if (!loadedDictionary) return;
        const learnedWordsMap = new Map<string, Word & { progress: WordProgress }>();
        const uniqueOriginalIndexes = [...new Set(loadedDictionary.sets.map(s => s.originalSetIndex))];
        const allOriginalWords = new Map<string, Word>();
        loadedDictionary.sets.forEach(set => set.words.forEach(word => allOriginalWords.set(word.en, word)));

        for (const index of uniqueOriginalIndexes) {
             let progressMap: Map<string, WordProgress> = new Map();
             if(user) {
                const srsDocRef = getSrsDocRef(user.uid, loadedDictionary.name, index);
                const srsSnap = await getDoc(srsDocRef);
                if (srsSnap.exists()) progressMap = new Map(srsSnap.data().progress);
             } else {
                const savedSrs = localStorage.getItem(getSrsStorageKey(loadedDictionary.name, index));
                if (savedSrs) progressMap = new Map(JSON.parse(savedSrs));
             }

            for (const [enWord, progress] of progressMap.entries()) {
                if (progress.srsStage > 0) {
                    const word = allOriginalWords.get(enWord);
                    if (word) learnedWordsMap.set(enWord, { ...word, progress });
                }
            }
        }
        
        const sortedLearnedWords = Array.from(learnedWordsMap.values()).sort((a, b) => a.ru.localeCompare(b.ru));
        setAllLearnedWords(sortedLearnedWords);
        setIsLearnedWordsModalOpen(true);
    };

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
        setIsProcessing(false);
      };
      
      const handleShuffle = () => {
        if (sessionWords.length < 2) return;
        const shuffledWords = [...sessionWords].sort(() => Math.random() - 0.5);
        setSessionWords(shuffledWords);
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setIsSetFinished(false);
        setHistory([]);
      };
  
      const handleReturnToSetSelection = () => {
        setSelectedSetIndex(null); 
        setIsSetFinished(false);   
        setCurrentWordIndex(0);    
        setIsTraining(false);      
      };

    // --- Render Logic ---
    const renderContent = () => {
      if (authLoading) return <Loader2 className="h-12 w-12 animate-spin text-indigo-400" />;
      
      if (!loadedDictionary) {
        return (
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-bold mb-2">Flashcard Trainer</h1>
            <p className="text-slate-400 mb-8">Your personal tool for mastering new words.</p>
            <button
              onClick={() => setIsFileModalOpen(true)}
              className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-lg rounded-lg font-semibold transition-colors flex items-center gap-3 shadow-lg mx-auto"
            >
              <FileUp size={20} /> Load Dictionary
            </button>
          </div>
        );
      }
      
      if (isSetFinished) {
        return (
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-200 text-center mb-6">{loadedDictionary.name}</h1>
            <h2 className="text-3xl font-bold mb-4">{isTraining ? "Practice Round Finished!" : "Set Finished!"}</h2>
            {isTraining && unknownWords.length > 0 && <p className="text-slate-400 mb-6">{unknownWords.length} word(s) still to learn.</p>}
            
            {unknownWords.length > 0 ? (
               <button
                  onClick={startTraining}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto"
                >
                  <Repeat size={18} /> {isTraining ? 'Practice Again' : `Train ${unknownWords.length} "Don't Know" word(s)`}
                </button>
            ) : (
               <p className="text-emerald-400 mb-6">{isTraining ? 'Well done! No more unknown words in this set.' : 'Congratulations! All words reviewed.'}</p>
            )}
             <button
                onClick={handleReturnToSetSelection}
                className="mt-4 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-colors flex items-center gap-2 mx-auto"
            >
                Select New Set
            </button>
          </div>
        );
      }
  
      if (selectedSetIndex === null) {
        return (
          <div className="w-full max-w-2xl">
              <header className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                  <h1 className="text-2xl font-bold text-slate-200 text-center">{loadedDictionary.name}</h1>
                   <div className="flex items-center gap-2">
                      <button onClick={handleShowLearnedWords} className="px-4 py-2 bg-sky-700 hover:bg-sky-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2" title="View all learned words"><BookCheck size={16} /> Learned Words</button>
                      <button onClick={handleResetAllProgress} className="px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2" title="Reset all learning progress for this dictionary"><RotateCcw size={16} /> Reset</button>
                      <button onClick={() => setIsFileModalOpen(true)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"><Upload size={16} /> Change Dictionary</button>
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
                      <button onClick={handleShowLearnedWords} className="px-4 py-2 bg-sky-700 hover:bg-sky-600 rounded-lg text-sm font-semibold" title="View all learned words"><BookCheck size={16} /></button>
                      <button onClick={handleResetAllProgress} className="px-4 py-2 bg-rose-700 hover:bg-rose-600 rounded-lg text-sm font-semibold" title="Reset all learning progress"><RotateCcw size={16} /></button>
                      <button onClick={() => setIsFileModalOpen(true)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold"><Upload size={16} /></button>
                   </div>
              </header>
  
              <main className="flex flex-col items-center">
                  {!isTraining && ( <SetSelector sets={loadedDictionary.sets} selectedSetIndex={selectedSetIndex} onSelectSet={handleSelectSet} /> )}
                  {isTraining && <h2 className="text-xl font-semibold text-rose-400 mb-6">Training Mode</h2>}
                  
                  {currentSet && currentWord ? (
                      <>
                          <Flashcard word={currentWord} isFlipped={isFlipped} onFlip={() => setIsFlipped(!isFlipped)} exampleSentence={sentences.get(currentWord.en.toLowerCase().trim())} />
                          <div className="w-full max-w-md mt-6">
                              <ProgressBar current={currentWordIndex} total={sessionWords.length} />
                              <div className="flex justify-between items-center text-sm text-slate-400">
                                  <span>{currentWordIndex + 1} / {sessionWords.length}</span>
                                  <div className="flex items-center gap-1">
                                      <button onClick={handleShuffle} title="Shuffle Words" className="p-2 rounded-full hover:bg-slate-800 transition-colors" aria-label="Shuffle current set"><Repeat size={18} /></button>
                                      {!isTraining && (<button onClick={() => setShowWordList(!showWordList)} title="Toggle Word List" className="p-2 rounded-full hover:bg-slate-800 transition-colors"><ChevronsUpDown size={18} /></button>)}
                                  </div>
                              </div>
                          </div>
  
                          <div className="flex items-center gap-4 mt-6 w-full max-w-md">
                             <button onClick={handlePrevious} disabled={history.length === 0 || isProcessing} className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-wait" aria-label="Previous card"><ArrowLeft size={24} /></button>
                             <button onClick={handleDontKnow} disabled={isProcessing} className="flex-1 px-6 py-3 bg-rose-800 hover:bg-rose-700 rounded-lg font-semibold transition-colors text-center disabled:opacity-50 disabled:cursor-wait">Don't know</button>
                             <button onClick={handleKnow} disabled={isProcessing} className="flex-1 px-6 py-3 bg-emerald-800 hover:bg-emerald-700 rounded-lg font-semibold transition-colors text-center disabled:opacity-50 disabled:cursor-wait">Know</button>
                          </div>
  
                          <div className="w-full max-w-md mt-8"><WordList words={currentSet.words} isVisible={showWordList && !isTraining} /></div>
                          <div className="w-full max-w-md mt-8 p-4 bg-slate-800 rounded-lg"><SentenceUpload onSentencesLoaded={handleSentencesLoaded} onClearSentences={handleClearSentences} hasSentences={sentences.size > 0} /></div>
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
        <FileSourceModal isOpen={isFileModalOpen} onClose={() => setIsFileModalOpen(false)} onFilesSelect={handleFilesSelect} isLoading={isLoading} />
        <LearnedWordsModal isOpen={isLearnedWordsModalOpen} onClose={() => setIsLearnedWordsModalOpen(false)} learnedWords={allLearnedWords} />
        <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setIsInstructionsModalOpen(false)} />
        
        <header className="absolute top-4 right-4 z-10">
          {!authLoading && <Auth user={user} />}
        </header>

        <main className="flex-grow flex flex-col items-center justify-center">
          {isSyncing ? <Loader2 className="h-12 w-12 animate-spin text-indigo-400" /> : renderContent()}
        </main>

        <footer className="w-full text-center py-2">
            <button onClick={() => setIsInstructionsModalOpen(true)} className="text-sm text-slate-500 hover:text-indigo-400 transition-colors underline">
              Інструкція з використання (українською)
            </button>
        </footer>
      </div>
    );
};

export default App;