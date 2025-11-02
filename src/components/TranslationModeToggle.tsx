import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { TranslationMode } from '../types';

interface TranslationModeToggleProps {
  mode: TranslationMode;
  onModeChange: (mode: TranslationMode) => void;
  lang1: string;
  lang2: string;
}

export const TranslationModeToggle: React.FC<TranslationModeToggleProps> = ({ mode, onModeChange, lang1, lang2 }) => {
  const handleToggle = () => {
    onModeChange(mode === 'standard' ? 'reverse' : 'standard');
  };

  const firstLang = mode === 'standard' ? lang1 : lang2;
  const secondLang = mode === 'standard' ? lang2 : lang1;

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      aria-label={`Current mode: ${firstLang} to ${secondLang}. Click to switch.`}
    >
      <span className="text-sm font-medium">{firstLang}</span>
      <ArrowRightLeft size={18} />
      <span className="text-sm font-medium">{secondLang}</span>
    </button>
  );
};