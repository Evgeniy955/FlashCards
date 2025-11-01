import React, { useState, useEffect, useMemo, useCallback } from 'react';
// Assuming lodash-es is a dependency
import { shuffle, sampleSize } from 'lodash-es';
import { ArrowDownUp, BrainCircuit, Shuffle, Type, List, CheckSquare } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';

import type { Word, LoadedDictionary, WordProgress } from './types';
import { parseDictionaryFile } from './utils/dictionaryUtils';
import { Flashcard } from './components/Flashcard';
import { SetSelector } from './components/SetSelector';
import { ProgressBar } from './components/ProgressBar';
import { FileSourceModal } from './components/FileSourceModal';
import { InstructionsModal } from './components/InstructionsModal';
import { LearnedWordsModal } from './components/LearnedWordsModal';
import { WordList } from './components/WordList';
import { SentenceUpload } from './components/SentenceUpload';
import { TrainingModeInput, AnswerState } from './components/TrainingModeInput';
import { MultipleChoice } from './components/MultipleChoice';
import { Auth } from './components/Auth';
import { auth } from './lib/firebase-client';

const SRS_STAGES = [1, 2, 4, 8, 16, 32, 64]; // in days
type TrainingMode = 'flashcard' | 'type-in' | 'multiple-choice';

// Local storage helpers
const getLocalStorage = <T,>(key: string, defaultValue: T): T => {
    try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) { console.error(error); return defaultValue; }
};
const setLocalStorage = <T,>(key: string, value: T) => {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) { console.error(error); }
};


const App: React.FC = () => {
  const [user] = useAuthState(auth);
  const [dictionary, setDictionary] = useState<LoadedDictionary | null>(null);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFileModalOpen, setFileModalOpen] = useState(true);
  const [isInstructionsModalOpen, setInstructionsModalOpen] = useState(false);
  const [isLearnedWordsModalOpen, setLearnedWordsModalOpen] = useState(false);
  const [isWordListVisible, setWordListVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [wordProgress, setWordProgress] = useState<Map<string, WordProgress>>(new Map());
  const [dontKnowWords, setDontKnowWords] = useState<Map<string, Set<string>>>(new Map());

  const [sessionQueue, setSessionQueue] = useState<Word[]>([]);
  const [isTrainingDontKnow, setIsTrainingDontKnow] = useState(false);
  const [sentences, setSentences] = useState<Map<string, string>>(new Map());
  const [isPronouncing, setIsPronouncing] = useState(false);

  const [trainingMode, setTrainingMode] = useState<TrainingMode>('flashcard');
  const [answer, setAnswer] = useState('');
  const [answerState, setAnswerState] = useState<AnswerState>('idle');
  const [mcOptions, setMcOptions] = useState<Word[]>([]);
  const [selectedMcOption, setSelectedMcOption] = useState<Word | null>(null);

  // Load/Save progress
  useEffect(() => {
    if (dictionary) {
        const progressKey = `progress-${dictionary.name}`;
        const dontKnowKey = `dontknow-${dictionary.name}`;
        setWordProgress(new Map(getLocalStorage<[string, WordProgress][]>(progressKey, [])));
        setDontKnowWords(new Map(getLocalStorage<[string, string[]][]>(dontKnowKey, []).map(([k, v]) => [k, new Set(v)])));
    }
  }, [dictionary]);

  useEffect(() => {
    if (dictionary && wordProgress.size > 0) {
        setLocalStorage(`progress-${dictionary.name}`, Array.from(wordProgress.entries()));
    }
  }, [wordProgress, dictionary]);

  useEffect(() => {
    if (dictionary) {
        const serializable = Array.from(dontKnowWords.entries()).map(([k, v]) => [k, Array.from(v)]);
        setLocalStorage(`dontknow-${dictionary.name}`, serializable);
    }
  }, [dontKnowWords, dictionary]);
  

  const handleFilesSelect = async (name: string, wordsFile: File, sentencesFile?: File) => {
    setIsLoading(true);
    setError(null);
    setFileModalOpen(false);
    try {
      const loadedDict = await parseDictionaryFile(wordsFile);
      setDictionary(loadedDict);
      setSelectedSetIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file.');
      setFileModalOpen(true);
    } finally {
      setIsLoading(false);
    }
  };
  
  const activeSet = useMemo(() => dictionary && selectedSetIndex !== null ? dictionary.sets[selectedSetIndex] : null, [dictionary, selectedSetIndex]);

  const createSessionQueue = useCallback(() => {
    if (!activeSet) return [];
    const now = new Date();
    const reviewWords = activeSet.words.filter(word => {
      const progress = wordProgress.get(word.en);
      return !progress || new Date(progress.nextReviewDate) <= now;
    });
    return shuffle(reviewWords);
  }, [activeSet, wordProgress]);

  useEffect(() => {
    if (activeSet) {
      setSessionQueue(createSessionQueue());
      setCurrentWordIndex(0);
      setIsFlipped(false);
      setIsTrainingDontKnow(false);
      setWordListVisible(false);
    }
  }, [activeSet, createSessionQueue]);

  const currentWord = useMemo(() => sessionQueue[currentWordIndex] || null, [sessionQueue, currentWordIndex]);
  
  // Setup MC options when word changes
  useEffect(() => {
    if (trainingMode === 'multiple-choice' && currentWord && activeSet) {
        const others = activeSet.words.filter(w => w.en !== currentWord.en);
        setMcOptions(shuffle([currentWord, ...sampleSize(others, 3)]));
        setSelectedMcOption(null);
    }
  }, [currentWord, trainingMode, activeSet]);

  const goToNextWord = useCallback(() => {
    if (currentWordIndex < sessionQueue.length - 1) {
      setCurrentWordIndex(i => i + 1);
    } else {
      setSessionQueue(createSessionQueue());
      setCurrentWordIndex(0);
    }
    setIsFlipped(false);
    setAnswer('');
    setAnswerState('idle');
  }, [currentWordIndex, sessionQueue.length, createSessionQueue]);

  const handleProgressUpdate = useCallback((word: Word, knewIt: boolean) => {
    const currentProgress = wordProgress.get(word.en);
    let nextStage: number;

    if (knewIt) {
        const currentStage = currentProgress ? currentProgress.srsStage : -1;
        nextStage = Math.min(currentStage + 1, SRS_STAGES.length - 1);
        if(isTrainingDontKnow && activeSet) {
            setDontKnowWords(p => {
                const newMap = new Map(p);
                // FIX: Explicitly type new Set() to avoid 'unknown' type inference.
                const set = newMap.get(activeSet.name) || new Set<string>();
                set.delete(word.en);
                newMap.set(activeSet.name, set);
                return newMap;
            });
        }
    } else {
        nextStage = 0; // Reset progress
        if (!isTrainingDontKnow && activeSet) {
             setDontKnowWords(p => {
                const newMap = new Map(p);
                // FIX: Explicitly type new Set() to avoid 'unknown' type inference.
                const set = newMap.get(activeSet.name) || new Set<string>();
                set.add(word.en);
                newMap.set(activeSet.name, set);
                return newMap;
            });
        }
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + (knewIt && nextStage > -1 ? SRS_STAGES[nextStage] : 1));
    
    setWordProgress(p => new Map(p).set(word.en, { srsStage: nextStage, nextReviewDate: nextReviewDate.toISOString() }));

    goToNextWord();

  }, [wordProgress, activeSet, isTrainingDontKnow, goToNextWord]);


  const startTrainingDontKnow = () => {
    if (!activeSet) return;
    const wordsToTrain = dontKnowWords.get(activeSet.name) || new Set();
    if (wordsToTrain.size > 0) {
        const wordMap = new Map(activeSet.words.map(w => [w.en, w]));
        const queue = Array.from(wordsToTrain).map(en => wordMap.get(en)).filter(Boolean) as Word[];
        setSessionQueue(shuffle(queue));
        setCurrentWordIndex(0);
        setIsFlipped(false);
        setIsTrainingDontKnow(true);
    }
  };

  const handleResetProgress = () => {
    if (window.confirm('Are you sure you want to reset all progress for this dictionary? This action cannot be undone.')) {
        if(dictionary) {
            window.localStorage.removeItem(`progress-${dictionary.name}`);
            window.localStorage.removeItem(`dontknow-${dictionary.name}`);
            setWordProgress(new Map());
            setDontKnowWords(new Map());
        }
    }
  };
  
  const handlePronounce = useCallback(() => {
    if (!currentWord || isPronouncing) return;
    setIsPronouncing(true);
    const utterance = new SpeechSynthesisUtterance(currentWord.en);
    utterance.lang = 'en-US';
    utterance.onend = () => setIsPronouncing(false);
    utterance.onerror = () => setIsPronouncing(false);
    window.speechSynthesis.speak(utterance);
  }, [currentWord, isPronouncing]);

  const learnedWordsList = useMemo(() => {
    if (!dictionary) return [];
    const allWords = dictionary.sets.flatMap(s => s.words);
    return allWords
      .map(word => ({ ...word, progress: wordProgress.get(word.en) }))
      .filter((item): item is Word & { progress: WordProgress } => !!item.progress)
      .sort((a, b) => b.progress.srsStage - a.progress.srsStage);
  }, [dictionary, wordProgress]);
  
  const currentSentence = currentWord ? (sentences.get(currentWord.en.toLowerCase()) || null) : null;
  const dontKnowCountForSet = activeSet ? (dontKnowWords.get(activeSet.name)?.size || 0) : 0;
  
  const handleChangeDictionary = () => {
      setDictionary(null);
      setSelectedSetIndex(null);
      setFileModalOpen(true);
  };

  // Handlers for Type-in mode
  const handleCheckAnswer = () => {
    if (!currentWord) return;
    setAnswerState(answer.trim().toLowerCase() === currentWord.en.toLowerCase() ? 'correct' : 'incorrect');
  };
  const handleNextAfterAnswer = () => {
    if(!currentWord) return;
    handleProgressUpdate(currentWord, answerState === 'correct');
  };

  // Handler for Multiple-choice mode
  const handleSelectMcOption = (selected: Word) => {
    if (!currentWord || selectedMcOption) return;
    setSelectedMcOption(selected);
    const isCorrect = selected.en === currentWord.en;
    setTimeout(() => {
        handleProgressUpdate(currentWord, isCorrect);
    }, 1000);
  };

  if (!dictionary || !activeSet) {
    return (
      <main className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
        <FileSourceModal isOpen={isFileModalOpen} onClose={() => { if(dictionary) setFileModalOpen(false) }} onFilesSelect={handleFilesSelect} isLoading={isLoading}/>
        <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setInstructionsModalOpen(false)} />
        {!isLoading && (
          <div className="text-center">
            <BrainCircuit size={64} className="mx-auto text-indigo-500" />
            <h1 className="text-4xl font-bold mt-4">SRS Flashcards</h1>
            <p className="text-slate-400 mt-2">Your smart language learning companion.</p>
            <button onClick={() => setFileModalOpen(true)} className="mt-8 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-semibold transition-transform hover:scale-105">Get Started</button>
            <button onClick={() => setInstructionsModalOpen(true)} className="mt-4 text-sm text-slate-400 hover:text-white">How to use?</button>
          </div>
        )}
        {isLoading && <p>Loading dictionary...</p>}
        {error && <p className="text-red-400 mt-4">{error}</p>}
      </main>
    );
  }
  
  const ModeButton = ({ mode, icon, label }: {mode: TrainingMode, icon: React.ReactNode, label: string}) => (
    <button onClick={() => setTrainingMode(mode)} className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors ${trainingMode === mode ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>{icon}{label}</button>
  )

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col">
      <header className="w-full p-4 flex justify-between items-center gap-4 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-800">
         <div className="flex-1 min-w-0"><h1 className="text-lg font-bold truncate" title={dictionary.name}>{dictionary.name}</h1><p className="text-xs text-slate-400 truncate">{activeSet.name}</p></div>
         <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <button onClick={() => setLearnedWordsModalOpen(true)} className="px-3 py-1.5 text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 rounded-md transition-colors">Learned: {learnedWordsList.length}</button>
            <button onClick={handleResetProgress} className="px-3 py-1.5 text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 rounded-md transition-colors">Reset</button>
            <button onClick={handleChangeDictionary} className="px-3 py-1.5 text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors">Change</button>
            <Auth user={user} />
         </div>
      </header>

      <main className="w-full max-w-4xl mx-auto p-4 sm:p-6 flex-grow flex flex-col">
        <SetSelector sets={dictionary.sets} selectedSetIndex={selectedSetIndex} onSelectSet={setSelectedSetIndex} />
        
        {!currentWord ? (
          <div className="flex-grow flex flex-col items-center justify-center text-center">
            <h2 className="text-2xl font-bold text-emerald-400">Session Complete!</h2>
            <p className="text-slate-400 mt-2">You've reviewed all due cards for this set.</p>
            {dontKnowCountForSet > 0 && (<button onClick={startTrainingDontKnow} className="mt-8 px-6 py-3 bg-rose-600 hover:bg-rose-700 rounded-lg font-semibold transition-transform hover:scale-105">Train {dontKnowCountForSet} "Don't Know" word{dontKnowCountForSet > 1 ? 's' : ''}</button>)}
            {isTrainingDontKnow && (<button onClick={() => { setIsTrainingDontKnow(false); setSessionQueue(createSessionQueue()); }} className="mt-4 text-sm text-slate-400 hover:text-white">Return to main session</button>)}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between"><div className="text-sm text-slate-400">{isTrainingDontKnow ? 'Training "Don\'t Know"' : 'Reviewing'}</div><div className="text-sm font-mono text-slate-400">{currentWordIndex + 1} / {sessionQueue.length}</div></div>
            <ProgressBar current={currentWordIndex + 1} total={sessionQueue.length} />

            <div className="relative">
              <Flashcard word={currentWord} sentence={currentSentence} isFlipped={isFlipped || answerState !== 'idle' || !!selectedMcOption} onFlip={() => setIsFlipped(!isFlipped)} onPronounce={handlePronounce} isPronouncing={isPronouncing}/>
              <div className="absolute -top-10 right-0 flex gap-2"><button onClick={() => setWordListVisible(!isWordListVisible)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Toggle Word List"><ArrowDownUp size={18} /></button><button onClick={() => setSessionQueue(shuffle([...sessionQueue]))} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Shuffle remaining cards"><Shuffle size={18} /></button></div>
            </div>
            
            <div className="w-full max-w-lg mx-auto mt-6">
              <div className="flex justify-center gap-2 mb-6"><ModeButton mode="flashcard" icon={<CheckSquare size={14}/>} label="Review"/><ModeButton mode="type-in" icon={<Type size={14}/>} label="Type"/><ModeButton mode="multiple-choice" icon={<List size={14}/>} label="Choice"/></div>
              {trainingMode === 'flashcard' && (<div className="flex gap-4"><button onClick={() => handleProgressUpdate(currentWord, false)} className="flex-1 py-4 text-lg font-semibold bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors">Don't know</button><button onClick={() => handleProgressUpdate(currentWord, true)} className="flex-1 py-4 text-lg font-semibold bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">Know</button></div>)}
              {trainingMode === 'type-in' && (<TrainingModeInput answer={answer} setAnswer={setAnswer} onCheck={handleCheckAnswer} onNext={handleNextAfterAnswer} answerState={answerState}/>)}
              {trainingMode === 'multiple-choice' && (<MultipleChoice questionWord={currentWord} options={mcOptions} onSelectOption={handleSelectMcOption} selectedOption={selectedMcOption} correctOption={currentWord}/>)}
            </div>
          </>
        )}
        <WordList words={activeSet.words} isVisible={isWordListVisible} />
      </main>
       <footer className="w-full max-w-4xl mx-auto p-4 sm:p-6 mt-auto">
            <div className="p-4 bg-slate-800 rounded-lg"><SentenceUpload onSentencesLoaded={setSentences} onClearSentences={() => setSentences(new Map())} hasSentences={sentences.size > 0} /></div>
       </footer>
      <InstructionsModal isOpen={isInstructionsModalOpen} onClose={() => setInstructionsModalOpen(false)} />
      <LearnedWordsModal isOpen={isLearnedWordsModalOpen} onClose={() => setLearnedWordsModalOpen(false)} learnedWords={learnedWordsList} />
    </div>
  );
};

export default App;