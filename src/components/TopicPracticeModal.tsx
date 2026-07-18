import React from 'react';
import { Loader2, MessageSquarePlus, Send } from 'lucide-react';
import { Modal } from './Modal';
import type { ChatMessage } from '../lib/gemini';

interface TopicPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: string;
  onTopicChange: (value: string) => void;
  draftMessage: string;
  onDraftMessageChange: (value: string) => void;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  onStart: () => void;
  onSend: () => void;
}

export const TopicPracticeModal: React.FC<TopicPracticeModalProps> = ({
  isOpen,
  onClose,
  topic,
  onTopicChange,
  draftMessage,
  onDraftMessageChange,
  messages,
  isLoading,
  error,
  onStart,
  onSend,
}) => {
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

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="topic-practice-message" className="text-sm font-medium">
            Your message
          </label>
          <textarea
            id="topic-practice-message"
            value={draftMessage}
            onChange={(e) => onDraftMessageChange(e.target.value)}
            placeholder="Write your answer in English..."
            rows={4}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 dark:border-slate-600 dark:bg-slate-900"
          />
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
            onClick={onSend}
            disabled={isLoading || !topic.trim() || !draftMessage.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={16} />
            Send
          </button>
        </div>
      </div>
    </Modal>
  );
};
