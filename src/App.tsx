
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
import { Auth } from './components/Auth';
import { Tooltip } from './components/Tooltip';
import { Word, LoadedDictionary, WordProgress, TranslationMode, Theme, WordStats } from './types';
import { parseDictionaryFile, shuffleArray, getWordId } from './utils/dictionaryUtils';
import { Shuffle, ChevronsUpDown, Info, BookUser, Trash2, Repeat, Library, Loader2, User as UserIcon, RefreshCw, Flame, Maximize2, Minimize2, Volume2, VolumeX, Cpu, Monitor, LayoutTemplate, X, ChevronRight, ChevronLeft } from 'lucide-react';
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
import { ModelSelectorModal } from './components/ModelSelectorModal';

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const App: React.FC = () => {
    const [user, authLoading] = useAuthState(auth as any);
    const [loadedDictionary, setLoadedDictionary] = useState<LoadedDictionary | null>(null);
    const [selectedSetIndex, setSelectedSetIndex] = useState<number | null>(null);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [reviewWords, setReviewWords] = useState<Word[]>([]);
    const [isShuffled, setIsShuffled] = useState(false);

    // Mini Mode State
    const [isMiniMode, setIsMiniMode] = useState(false);
    const [miniCorner, setMiniCorner] = useState<Corner>('top-left');

    const [sessionProgress, setSessionProgress] = useState(0);
    const [sessionTotal, setSessionTotal] = useState(0);
    const [sessionActive, setSessionActive] = useState(false);

    const [learnedWords, setLearnedWords] = useState<Map<string, WordProgress>>(new Map());
    const [dontKnowWords, setDontKnowWords] = useState<Map<number, Word[]>>(new Map());
    const [wordStats, setWordStats] = useState<Map<string, WordStats>>(new Map());
    const [sentences, setSentences] = useState<Map<string, string>>(new Map());
    const [hasLoadedSentences, setHasLoadedSentences] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isProgressLoading, setIsProgressLoading] = useState(true);
    const [isWordListVisible, setIsWordListVisible] = useState(false);
    const [isDontKnowMode, setIsDontKnowMode] = useState(false);
    const [isPracticeMode, setIsPracticeMode] = useState(false);
    const [isChangingWord, setIsChangingWord] = useState(false);
    const [isInstantChange, setIsInstantChange] = useState(false);
    const [progressSaveCounter, setProgressSaveCounter] = useState(0);

    const [userAnswer, setUserAnswer] = useState('');
    const [answerState, setAnswerState] = useState<AnswerState>('idle');
    const [trainingMode, setTrainingMode] = useState<'write' | 'guess'>('write');
    const [translationMode, setTranslationMode] = useState<TranslationMode>('standard');
    const [guessOptions, setGuessOptions] = useState<string[]>([]);

    const [isGeneratingSentence, setIsGeneratingSentence] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [isValidatingAnswer, setIsValidatingAnswer] = useState(false);
    const [aiFeedback, setAiFeedback] = useState<string>('');

    const [isFileSourceModalOpen, setFileSourceModalOpen] = useState(false);
    const [isInstructionsModalOpen, setInstructionsModalOpen] = useState(false);
    const [isLearnedWordsModalOpen, setLearnedWordsModalOpen] = useState(false);
    const [isProfileModalOpen, setProfileModalOpen] = useState(false);
    const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);
    const [theme, setTheme] = useState<Theme>('dark');
    const [allTimeStats, setAllTimeStats] = useState<any | null>(null);

    const [currentStreak, setCurrentStreak] = useState(0);
    const [welcomeStats, setWelcomeStats] = useState<any | null>(null);
    const [showWelcomeToast, setShowWelcomeToast] = useState(false);

    const [isZenMode, setIsZenMode] = useState(false);
    const [isMuted, setIsMuted] = useState(sounds.getMuted());
    const [isSyncing, setIsSyncing] = useState(false);
    
    const geminiModels = useMemo(() => [
        { id: 'gemini-flash-lite-latest', name: 'Gemini 2.5 Flash Lite (Best for Free Tier)' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Balanced)' },
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Smartest)' },
    ], []);
    const [selectedGeminiModel, setSelectedGeminiModel] = useState(geminiModels[0].id);

    const dictionaryId = useMemo(() => loadedDictionary?.name.replace(/[./]/g, '_'), [loadedDictionary]);

    // Handle corner cycles
    const cycleCorner = () => {
        const corners: Corner[] = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
        const next = corners[(corners.indexOf(miniCorner) + 1) % 4];
        setMiniCorner(next);
    };

    const loadAndSetDictionary = useCallback(async (name: string, wordsFiles: File[]) => {
        setIsLoading(true);
        setIsProgressLoading(true);
        try {
            setLearnedWords(new Map());
            setDontKnowWords(new Map());
            setWordStats(new Map());

            // Support multiple files
            const combinedSets: any[] = [];
            for (const file of wordsFiles) {
                const dict = await parseDictionaryFile(file);
                combinedSets.push(...dict.sets);
            }

            const combinedDict: LoadedDictionary = {
                name: wordsFiles.length > 1 ? `Study Group (${wordsFiles.length} dicts)` : name,
                sets: combinedSets
            };

            setLoadedDictionary(combinedDict);
            setSelectedSetIndex(0);
            setFileSourceModalOpen(false);
            setSessionActive(false);

            if (wordsFiles.length === 1) {
                localStorage.setItem('lastUsedDictionary', name);
            }

        } catch (error) {
            alert((error as Error).message);
            setLoadedDictionary(null);
        } finally {
            setIsLoading(false);
            setIsProgressLoading(false);
        }
    }, []);

    const updateWordIndex = () => {
        const nextIndex = currentWordIndex + 1;
        if (nextIndex < reviewWords.length) {
            setCurrentWordIndex(nextIndex);
            setSessionProgress(prev => prev + 1);
        } else {
            setReviewWords([]);
            sounds.play('success');
            setSessionActive(false);
            setIsPracticeMode(false);
            if (isMiniMode) setIsMiniMode(false);
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
            setSessionActive(false);
        }
    }, [loadedDictionary, learnedWords]);

    useEffect(() => {
        if (selectedSetIndex !== null && !isProgressLoading && !sessionActive) {
            startReviewSession(selectedSetIndex);
        }
    }, [selectedSetIndex, isProgressLoading, sessionActive, startReviewSession]);

    // Initial Loading
    useEffect(() => {
        const last = localStorage.getItem('lastUsedDictionary');
        if (last) {
            getDictionary(last, user?.uid).then(d => {
                if (d) loadAndSetDictionary(d.name, [d.file]);
                setIsInitialLoading(false);
            });
        } else {
            setIsInitialLoading(false);
        }
    }, [user, loadAndSetDictionary]);

    const handleFlip = useCallback(() => {
        sounds.play('flip');
        setIsFlipped(prev => !prev);
    }, []);

    const handleKnow = () => {
        sounds.play('correct');
        const nextIndex = currentWordIndex + 1;
        if (nextIndex < reviewWords.length) {
            setIsFlipped(false);
            setCurrentWordIndex(nextIndex);
            setSessionProgress(prev => prev + 1);
        } else {
            setReviewWords([]);
            setSessionActive(false);
            if (isMiniMode) setIsMiniMode(false);
        }
    };

    const handleDontKnow = () => {
        sounds.play('incorrect');
        const nextIndex = currentWordIndex + 1;
        if (nextIndex < reviewWords.length) {
            setIsFlipped(false);
            setCurrentWordIndex(nextIndex);
            setSessionProgress(prev => prev + 1);
        } else {
            setReviewWords([]);
            setSessionActive(false);
            if (isMiniMode) setIsMiniMode(false);
        }
    };

    const currentWord = useMemo(() => reviewWords[currentWordIndex], [reviewWords, currentWordIndex]);
    const currentSet = useMemo(() => selectedSetIndex !== null ? loadedDictionary?.sets[selectedSetIndex] : null, [selectedSetIndex, loadedDictionary]);

    // Mini Mode Layout
    if (isMiniMode && currentWord && currentSet) {
        const cornerClasses = {
            'top-left': 'top-4 left-4',
            'top-right': 'top-4 right-4',
            'bottom-left': 'bottom-4 left-4',
            'bottom-right': 'bottom-4 right-4',
        };

        return (
            <div className={`fixed ${cornerClasses[miniCorner]} z-[9999] w-72 bg-white dark:bg-slate-800 shadow-2xl rounded-2xl border border-slate-200 dark:border-slate-700 p-4 animate-fade-in`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                        <button onClick={cycleCorner} className="p-1 text-slate-400 hover:text-indigo-500 transition-colors">
                            <LayoutTemplate size={16} />
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono">{sessionProgress}/{sessionTotal}</span>
                    </div>
                    <button onClick={() => setIsMiniMode(false)} className="p-1 text-slate-400 hover:text-rose-500 transition-colors">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex flex-col items-center text-center py-2" onClick={handleFlip}>
                    <div className="text-sm text-slate-400 mb-1">{translationMode === 'standard' ? currentSet.lang1 : currentSet.lang2}</div>
                    <div className="text-xl font-bold mb-3 dark:text-white leading-tight">
                        {translationMode === 'standard' ? currentWord.lang1 : currentWord.lang2}
                    </div>
                    
                    <div className="w-full border-t border-slate-100 dark:border-slate-700 my-2 pt-3">
                        <div className="text-[10px] text-slate-400 mb-0.5">{translationMode === 'standard' ? currentSet.lang2 : currentSet.lang1}</div>
                        <div className={`text-lg font-semibold text-indigo-600 dark:text-indigo-400 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0'}`}>
                            {translationMode === 'standard' ? currentWord.lang2 : currentWord.lang1}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2 mt-4">
                    <button onClick={handleDontKnow} className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-xs font-bold transition-colors">Don't Know</button>
                    <button onClick={handleKnow} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors">Know</button>
                </div>
            </div>
        );
    }

    if (isInitialLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

    if (!loadedDictionary) {
        return (
            <div className="min-h-screen flex flex-col">
                <header className="p-6 flex justify-end gap-2">
                    <ThemeToggle theme={theme} setTheme={setTheme} />
                    <Auth user={user} />
                </header>
                <main className="flex-grow flex flex-col items-center justify-center p-4">
                    <FileSourceModal isOpen={isFileSourceModalOpen} onClose={() => setFileSourceModalOpen(false)} onFilesSelect={loadAndSetDictionary} isLoading={isLoading} user={user} />
                    <h1 className="text-5xl font-bold mb-4">Flashcard App</h1>
                    <button onClick={() => setFileSourceModalOpen(true)} className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold">
                        Select Dictionary
                    </button>
                </main>
            </div>
        );
    }

    return (
        <main className="min-h-screen flex flex-col items-center p-6">
            {!isZenMode && (
                <header className="w-full max-w-5xl flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setFileSourceModalOpen(true)} className="flex items-center gap-2 text-sm text-slate-500"><Library size={18} /> Change</button>
                        <button onClick={() => setIsMiniMode(true)} className="flex items-center gap-2 text-sm text-indigo-500 font-bold"><Monitor size={18} /> Mini Mode</button>
                    </div>
                    <div className="text-center font-bold">{loadedDictionary.name}</div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle theme={theme} setTheme={setTheme} />
                        <Auth user={user} />
                    </div>
                </header>
            )}

            <div className="w-full max-w-md">
                {!isZenMode && <SetSelector sets={loadedDictionary.sets} selectedSetIndex={selectedSetIndex} onSelectSet={setSelectedSetIndex} learnedWords={learnedWords} />}

                {reviewWords.length > 0 && currentWord && currentSet ? (
                    <div className="flex flex-col items-center">
                        <div className="text-center text-sm text-slate-500 mb-2">{sessionProgress} / {sessionTotal}</div>
                        <ProgressBar current={sessionProgress} total={sessionTotal} />
                        <Flashcard 
                            word={currentWord} 
                            isFlipped={isFlipped} 
                            onFlip={handleFlip} 
                            translationMode={translationMode} 
                            lang1={currentSet.lang1} 
                            knowAttempts={0} 
                            totalAttempts={0} 
                        />
                        <div className="flex gap-4 mt-6 w-full">
                            <button onClick={handleDontKnow} className="flex-1 py-3 bg-rose-600 text-white rounded-lg font-bold">Don't know</button>
                            <button onClick={handleKnow} className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-bold">Know</button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center my-16">
                        <h2 className="text-2xl font-bold">Session Complete!</h2>
                        <button onClick={() => startReviewSession(selectedSetIndex || 0)} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg">Restart</button>
                    </div>
                )}
            </div>

            <FileSourceModal isOpen={isFileSourceModalOpen} onClose={() => setFileSourceModalOpen(false)} onFilesSelect={loadAndSetDictionary} isLoading={isLoading} user={user} />
        </main>
    );
};

export default App;
