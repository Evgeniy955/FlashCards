import React, { useEffect, useState } from 'react';
import { Flame, BookCheck, X } from 'lucide-react';

interface StudyStatsToastProps {
  streak: number;
  wordsLearned: number;
  onClose: () => void;
}

export const StudyStatsToast: React.FC<StudyStatsToastProps> = ({ streak, wordsLearned, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Mount animation
    requestAnimationFrame(() => {
        setIsVisible(true);
    });

    const timer = setTimeout(() => {
      handleClose();
    }, 8000); // Auto-close after 8 seconds
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to finish before calling parent's onClose
  };
  
  const getGreeting = () => {
      if (streak > 1) return `You're on a ${streak}-day streak!`;
      if (wordsLearned > 0) return "Great job on your last session!";
      return "Welcome back!";
  }

  return (
    <div 
        className={`fixed top-6 right-6 w-full max-w-sm p-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 transition-all duration-300 ease-in-out ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}
        role="alert"
        aria-live="assertive"
    >
        <div className="flex items-start">
            <div className="flex-shrink-0 pt-0.5">
                <div className="w-10 h-10 rounded-full bg-indigo-500 dark:bg-indigo-600 flex items-center justify-center">
                    <Flame className="w-6 h-6 text-white" />
                </div>
            </div>
            <div className="ml-3 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {getGreeting()}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    You learned <span className="font-bold text-slate-700 dark:text-slate-200">{wordsLearned}</span> new words in your last session. Keep the momentum going!
                </p>
            </div>
            <div className="ml-4 flex-shrink-0 flex">
                <button
                    onClick={handleClose}
                    className="inline-flex text-slate-400 dark:text-slate-500 hover:text-slate-500 dark:hover:text-slate-300"
                    aria-label="Close notification"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
        </div>
    </div>
  );
};
