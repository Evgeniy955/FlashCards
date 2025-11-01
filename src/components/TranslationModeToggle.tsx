import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { TranslationMode } from '../types';

interface TranslationModeToggleProps {
  mode: TranslationMode;
  onModeChange: (mode: TranslationMode) => void;
}

export const TranslationModeToggle: React.FC<TranslationModeToggleProps> = ({ mode, onModeChange }) => {
  const handleToggle = () => {
    onModeChange(mode === 'standard' ? 'reverse' : 'standard');
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      aria-label={`Current mode: ${mode === 'standard' ? 'Russian to English' : 'English to Russian'}. Click to switch.`}
    >
      <span className="text-sm font-medium">{mode === 'standard' ? 'RU' : 'EN'}</span>
      <ArrowRightLeft size={18} />
      <span className="text-sm font-medium">{mode === 'standard' ? 'EN' : 'RU'}</span>
    </button>
  );
};
