import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquarePlus, Mic, MicOff } from 'lucide-react';
import { Modal } from './Modal';
import type { ChatMessage } from '../lib/gemini';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface TopicPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: string;
  onTopicChange: (value: string) => void;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onStart: () => void;
  onSendTranscript: (transcript: string) => void;
}

export const TopicPracticeModal: React.FC<TopicPracticeModalProps> = ({
  isOpen,
  onClose,
  topic,
  onTopicChange,
  messages,
  isLoading,
  error,
  onStart,
  onSendTranscript,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [heardText, setHeardText] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef('');

  const speechRecognitionCtor = useMemo(
    () => globalThis.window?.SpeechRecognition || globalThis.window?.webkitSpeechRecognition,
    []
  );

  useEffect(() => {
    if (!isOpen) {
      recognitionRef.current?.stop();
      setIsListening(false);
      transcriptRef.current = '';
      setHeardText('');
      setSpeechError(null);
    }
  }, [isOpen]);

  const startListening = () => {
    if (!speechRecognitionCtor) {
      setSpeechError('Speech recognition is not available in this browser.');
      return;
    }

    if (!topic.trim()) {
      setSpeechError('Choose a topic first.');
      return;
    }

    if ('speechSynthesis' in globalThis) {
      globalThis.speechSynthesis.cancel();
    }

    const recognition = new speechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    transcriptRef.current = '';
    setHeardText('');
    setSpeechError(null);
    setIsListening(true);

    recognition.onresult = (event) => {
      let combinedTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        combinedTranscript += result[0]?.transcript || '';
      }
      transcriptRef.current = combinedTranscript.trim();
      setHeardText(transcriptRef.current);
    };

    recognition.onerror = (event) => {
      const message = event.error === 'not-allowed'
        ? 'Microphone access was denied.'
        : event.error === 'no-speech'
          ? 'No speech was detected. Please try again.'
          : 'Voice input failed. Please try again.';
      setSpeechError(message);
    };

    recognition.onend = () => {
      setIsListening(false);
      const finalTranscript = transcriptRef.current.trim();
      if (finalTranscript) {
        onSendTranscript(finalTranscript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Topic Practice">
      <div className="flex max-h-[75vh] flex-col gap-4 text-slate-700 dark:text-slate-200">
        <div className="space-y-2">
          <label htmlFor="topic-practice-topic" className="text-sm font-medium">
            Topic
          </label>
          <input
            id="topic-practice-topic"
            type="text"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            placeholder="Example: travel, movies, work, food"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            The AI will stay on this topic and correct your tense mistakes.
          </p>
        </div>

        <div className="min-h-[260px] flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-500 dark:text-slate-400">
              <MessageSquarePlus size={28} />
              <p>Choose a topic and start a conversation to practice what you learned.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-xl px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'ml-8 bg-indigo-600 text-white'
                      : 'mr-8 bg-white text-slate-800 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  {message.text}
                </div>
              ))}
              {isLoading && (
                <div className="mr-8 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                  <Loader2 size={16} className="animate-spin" />
                  Thinking...
                </div>
              )}
            </div>
          )}
        </div>

        {(error || speechError) && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
            {error || speechError}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="mb-1 text-sm font-medium">Voice Input</div>
          <div className="text-sm text-slate-600 dark:text-slate-300">
            {heardText || (isListening ? 'Listening...' : 'Tap the microphone and speak in English.')}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onStart}
            disabled={isLoading || !topic.trim()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Start Topic
          </button>
          <button
            onClick={toggleListening}
            disabled={isLoading || !topic.trim()}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isListening ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            {isListening ? 'Stop' : 'Speak'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
