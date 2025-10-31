import React from 'react';
import { BookOpen } from 'lucide-react';

const dictionaries = [
  { name: 'A1 - Common Nouns', path: '/dictionaries/A1_Nouns.xlsx', sentencesPath: '/dictionaries/A1_Nouns_Sentences.xlsx' },
  { name: 'A2 - Common Adjectives', path: '/dictionaries/A2_Adjectives.xlsx', sentencesPath: '/dictionaries/A2_Adjectives_Sentences.json' },
  { name: 'B1 - Travel Verbs', path: '/dictionaries/B1_Verbs.xlsx' },
  { name: 'B2 - Business Vocabulary', path: '/dictionaries/B2_Business.xlsx' },
];

interface BuiltInDictionariesProps {
  onSelect: (path: string, sentencesPath?: string) => void;
  isLoading: boolean;
}

export const BuiltInDictionaries: React.FC<BuiltInDictionariesProps> = ({ onSelect, isLoading }) => {
  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-300 mb-4">Choose a dictionary:</h3>
      <div className="space-y-3">
        {dictionaries.map((dict) => (
          <button
            key={dict.name}
            onClick={() => onSelect(dict.path, dict.sentencesPath)}
            disabled={isLoading}
            className="w-full flex items-center gap-4 p-4 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
          >
            <div className="flex-shrink-0">
                <BookOpen className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <span className="font-semibold text-white">{dict.name}</span>
              {dict.sentencesPath && (
                  <p className="text-xs text-slate-400">Includes example sentences</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};