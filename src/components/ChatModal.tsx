import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Send, Mic, MicOff, Volume2, User as UserIcon, Bot, RefreshCcw, MessageSquare, Briefcase, Coffee, Plane, Stethoscope } from 'lucide-react';
import { chatWithAI, type ChatMessage } from '../lib/gemini';

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    userName?: string;
}

const PRESET_SCENARIOS = [
    {
        id: 'coffee',
        icon: <Coffee size={20} />,
        title: 'At a Cafe',
        prompt: 'You are a barista at a trendy coffee shop. I am a customer ordering a drink and a snack.'
    },
    {
        id: 'job',
        icon: <Briefcase size={20} />,
        title: 'Job Interview',
        prompt: 'You are a hiring manager interviewing me for a job. Ask me about my experience and strengths.'
    },
    {
        id: 'travel',
        icon: <Plane size={20} />,
        title: 'Airport Customs',
        prompt: 'You are an immigration officer at an airport in London. Ask me about my travel plans.'
    },
    {
        id: 'doctor',
        icon: <Stethoscope size={20} />,
        title: 'At the Doctor',
        prompt: 'You are a doctor. I am a patient coming in because I do not feel well. Ask me about my symptoms.'
    },
];

export const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, userName }) => {
    const [mode, setMode] = useState<'free' | 'roleplay'>('free');
    const [topic, setTopic] = useState('');
    const [isChatActive, setIsChatActive] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Conversation Modes: 'ptt' (Push to Talk) or 'continuous' (Hands-free with delay)
    const [conversationMode, setConversationMode] = useState<'ptt' | 'continuous'>('ptt');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Speech Recognition Refs
    const recognitionRef = useRef<any>(null);
    const isListeningRef = useRef(false); // Tracks intent to listen (vs browser actual state)
    const inputRef = useRef(''); // Ref to keep track of input inside closures
    const finalTranscriptRef = useRef(''); // Accumulator for text across restarts
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSendingRef = useRef(false);

    // Sync input ref
    useEffect(() => {
        inputRef.current = input;
    }, [input]);

    // Scroll to bottom on new message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initial greeting when chat starts
    useEffect(() => {
        if (isChatActive && messages.length === 0) {
            handleSendMessage(true);
        }
    }, [isChatActive]);

    // Cleanup on close
    useEffect(() => {
        if (!isOpen) {
            stopRecognition();
            setTopic('');
            setIsChatActive(false);
            setMessages([]);
            setError(null);
            setInput('');
            window.speechSynthesis.cancel();
        }
    }, [isOpen]);

    const startRecognition = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }

            const recognition = new SpeechRecognition();
            recognitionRef.current = recognition;

            recognition.lang = 'en-US';
            recognition.interimResults = true;
            recognition.continuous = true; // Always true to allow holding button or long sentences

            // Mark intent to listen
            isListeningRef.current = true;

            recognition.onstart = () => {
                setIsRecording(true);
                setError(null);
            };

            recognition.onend = () => {
                setIsRecording(false);

                // If we still intend to listen (e.g. holding button or continuous mode active),
                // but browser stopped (timeout/error), RESTART immediately.
                if (isListeningRef.current) {
                    // Preserve what was already typed/spoken so we don't lose it on restart
                    if (inputRef.current) {
                        finalTranscriptRef.current = inputRef.current + ' ';
                    }
                    try {
                        recognition.start();
                    } catch (e) {
                        console.error("Restart failed", e);
                        isListeningRef.current = false;
                    }
                }
            };

            recognition.onerror = (event: any) => {
                if (event.error === 'not-allowed') {
                    setError("Microphone access denied.");
                    isListeningRef.current = false;
                    setIsRecording(false);
                } else if (event.error !== 'no-speech') {
                    console.error("Speech recognition error", event.error);
                }
            };

            recognition.onresult = (event: any) => {
                let currentSessionTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    currentSessionTranscript += event.results[i][0].transcript;
                }

                // Combine accumulated text (from previous restarts) with current session text
                const fullText = finalTranscriptRef.current + currentSessionTranscript;
                setInput(fullText);

                // Continuous Mode Logic: Auto-send after 3 seconds of silence
                if (conversationMode === 'continuous') {
                    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

                    silenceTimerRef.current = setTimeout(() => {
                        if (fullText.trim()) {
                            stopRecognition(); // Stop listening intent
                            handleSendMessage(); // Send the text
                        }
                    }, 3000); // Wait 3 seconds
                }
            };

            recognition.start();
        } else {
            alert("Speech recognition is not supported in this browser (Try Chrome).");
        }
    };

    const stopRecognition = () => {
        isListeningRef.current = false; // Clear intent
        finalTranscriptRef.current = ''; // Clear accumulator
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    // PTT Handlers
    const handlePTTStart = () => {
        if (conversationMode !== 'ptt') return;
        setInput('');
        finalTranscriptRef.current = ''; // Reset accumulator
        startRecognition();
    };

    const handlePTTEnd = () => {
        if (conversationMode !== 'ptt') return;

        // Stop intent immediately
        stopRecognition();

        // Send what we have
        setTimeout(() => {
            if (inputRef.current.trim()) {
                handleSendMessage();
            }
        }, 200);
    };

    // Continuous Toggle
    const toggleContinuousSession = () => {
        if (isListeningRef.current) {
            stopRecognition();
        } else {
            setInput('');
            finalTranscriptRef.current = '';
            startRecognition();
        }
    };

    const speakText = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';

            const voices = window.speechSynthesis.getVoices();
            const preferred = voices.find(v => v.lang.startsWith('en-US') && !v.name.includes('Google')) || voices.find(v => v.lang.startsWith('en'));
            if(preferred) utterance.voice = preferred;

            // Resume listening only if we are still in continuous mode and the chat is open
            utterance.onend = () => {
                if (conversationMode === 'continuous' && isChatActive && isOpen) {
                    setTimeout(() => {
                        setInput('');
                        finalTranscriptRef.current = '';
                        startRecognition();
                    }, 500);
                }
            };

            window.speechSynthesis.speak(utterance);
        }
    };

    const handleSendMessage = async (isInitial = false) => {
        const textToSend = isInitial ? '' : inputRef.current;

        if ((!textToSend.trim() && !isInitial) || isLoading || isSendingRef.current) return;

        isSendingRef.current = true;

        const newMessages = [...messages];
        if (!isInitial) {
            newMessages.push({ role: 'user', text: textToSend });
            setMessages(newMessages);
            setInput('');
        }

        setIsLoading(true);
        setError(null);

        try {
            const activeScenario = mode === 'roleplay' ? topic : topic;
            const historyToSend = isInitial ? [] : newMessages;

            const aiResponse = await chatWithAI(historyToSend, activeScenario, mode, userName);

            const updatedMessages: ChatMessage[] = [...newMessages, { role: 'model', text: aiResponse }];
            setMessages(updatedMessages);
            speakText(aiResponse);
        } catch (err: any) {
            setError(err.message || "Failed to get response");
        } finally {
            setIsLoading(false);
            isSendingRef.current = false;
        }
    };

    const handleReset = () => {
        stopRecognition();
        window.speechSynthesis.cancel();
        setTopic('');
        setIsChatActive(false);
        setMessages([]);
        setError(null);
        setInput('');
    };

    const startScenario = (prompt: string, title: string) => {
        setMode('roleplay');
        setTopic(prompt);
        setIsChatActive(true);
    };

    const startFreeTalk = (e: React.FormEvent) => {
        e.preventDefault();
        if(topic.trim()) {
            setMode('free');
            setIsChatActive(true);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="AI Conversation Practice">
            <div className="h-[70vh] flex flex-col">
                {!isChatActive ? (
                    <div className="flex flex-col h-full overflow-y-auto pr-2">

                        {/* Free Talk Section */}
                        <div className="mb-8">
                            <div className="flex items-center gap-2 mb-3">
                                <MessageSquare className="text-indigo-600 dark:text-indigo-400" />
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Free Talk</h3>
                            </div>
                            <form onSubmit={startFreeTalk} className="flex gap-2">
                                <input
                                    type="text"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    placeholder="Enter any topic (e.g. Hobbies, Food)..."
                                    className="flex-1 p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={!topic.trim()}
                                    className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                                >
                                    Start
                                </button>
                            </form>
                        </div>

                        {/* Roleplay Section */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <UserIcon className="text-emerald-600 dark:text-emerald-400" />
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Roleplay Scenarios</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {PRESET_SCENARIOS.map((scenario) => (
                                    <button
                                        key={scenario.id}
                                        onClick={() => startScenario(scenario.prompt, scenario.title)}
                                        className="flex flex-col items-start p-4 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:shadow-md hover:border-indigo-400 dark:hover:border-indigo-500 transition-all text-left group"
                                    >
                                        <div className="mb-2 p-2 bg-slate-100 dark:bg-slate-600 rounded-lg text-slate-600 dark:text-slate-300 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {scenario.icon}
                                        </div>
                                        <span className="font-semibold text-slate-800 dark:text-white">{scenario.title}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Active Chat Header */}
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-700 mb-2">
                            <div className="flex flex-col items-start">
                                <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {mode === 'roleplay' ? 'Scenario' : 'Topic'}:
                        </span>
                                    <span className="font-medium text-indigo-600 dark:text-indigo-400 truncate max-w-[150px]">
                            {mode === 'roleplay' ? PRESET_SCENARIOS.find(s => s.prompt === topic)?.title || 'Roleplay' : topic}
                        </span>
                                </div>
                                <div className="flex items-center gap-4 mt-1">
                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                                        <input
                                            type="radio"
                                            checked={conversationMode === 'ptt'}
                                            onChange={() => { setConversationMode('ptt'); stopRecognition(); }}
                                            className="accent-indigo-600"
                                        />
                                        <span className="text-slate-600 dark:text-slate-300">Hold to Talk</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                                        <input
                                            type="radio"
                                            checked={conversationMode === 'continuous'}
                                            onChange={() => { setConversationMode('continuous'); stopRecognition(); }}
                                            className="accent-indigo-600"
                                        />
                                        <span className="text-slate-600 dark:text-slate-300">Continuous</span>
                                    </label>
                                </div>
                            </div>
                            <button onClick={handleReset} className="text-xs flex items-center gap-1 text-slate-500 hover:text-rose-500 transition-colors">
                                <RefreshCcw size={14} /> End
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-grow overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin">
                            {messages.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`flex gap-2 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                            {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                                        </div>
                                        <div className={`p-3 rounded-2xl text-sm leading-relaxed ${
                                            msg.role === 'user'
                                                ? 'bg-indigo-600 text-white rounded-tr-none'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'
                                        }`}>
                                            {msg.text}
                                            {msg.role === 'model' && (
                                                <button onClick={() => speakText(msg.text)} className="ml-2 inline-block align-bottom opacity-50 hover:opacity-100 transition-opacity">
                                                    <Volume2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                                        <Bot size={16} className="text-emerald-600" />
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                            <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {error && (
                            <div className="mb-2 text-center p-2 text-xs text-rose-500 bg-rose-50 dark:bg-rose-900/20 rounded-lg">
                                {error}
                            </div>
                        )}

                        {/* Input Area */}
                        <div className="flex items-center gap-2 mt-auto">
                            {conversationMode === 'ptt' ? (
                                // Push to Talk Button
                                <button
                                    onMouseDown={handlePTTStart}
                                    onMouseUp={handlePTTEnd}
                                    onMouseLeave={handlePTTEnd}
                                    onTouchStart={(e) => { e.preventDefault(); handlePTTStart(); }}
                                    onTouchEnd={(e) => { e.preventDefault(); handlePTTEnd(); }}
                                    disabled={isLoading}
                                    className={`p-4 rounded-full transition-all duration-200 shadow-md flex-shrink-0 ${
                                        isRecording
                                            ? 'bg-rose-500 text-white scale-110 shadow-rose-500/40'
                                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    title="Hold to Speak"
                                >
                                    {isRecording ? <Mic size={24} /> : <MicOff size={24} />}
                                </button>
                            ) : (
                                // Continuous Mode Toggle
                                <button
                                    onClick={toggleContinuousSession}
                                    disabled={isLoading}
                                    className={`p-4 rounded-full transition-all duration-300 shadow-md flex-shrink-0 ${
                                        isRecording
                                            ? 'bg-rose-500 text-white animate-pulse shadow-rose-500/40'
                                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                                    } disabled:opacity-50`}
                                    title={isRecording ? "Stop Conversation" : "Start Continuous Conversation"}
                                >
                                    {isRecording ? <Mic size={24} /> : <MicOff size={24} />}
                                </button>
                            )}

                            <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }} className="flex-1 flex gap-2">
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder={
                                        isRecording
                                            ? (conversationMode === 'continuous' ? "Listening (pauses auto-send)..." : "Listening...")
                                            : (conversationMode === 'ptt' ? "Hold mic to speak" : "Press mic to start")
                                    }
                                    className="flex-1 p-3 rounded-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition-colors"
                                />
                                <button
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};
