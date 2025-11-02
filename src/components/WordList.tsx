import React from 'react';
import type { Word } from '../types';

interface WordListProps {
  words: Word[];
  isVisible: boolean;
  lang1: string;
  lang2: string;
}

export const WordList: React.FC<WordListProps> = ({ words, isVisible, lang1, lang2 }) => {
  return (
    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isVisible ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="mt-8 p-4 bg-slate-800 rounded-lg max-h-80 overflow-y-auto">
        <h3 className="text-lg font-semibold mb-2 text-slate-300">All Words in Set</h3>
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-300 uppercase bg-slate-700 sticky top-0">
            <tr>
              <th scope="col" className="px-4 py-2 rounded-l-lg">
                {lang1}
              </th>
              <th scope="col" className="px-4 py-2 rounded-r-lg">
                {lang2}
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            {words.map((word, index) => (
              <tr key={index} className="border-b border-slate-700 hover:bg-slate-700/50">
                <td className="px-4 py-2 font-medium text-slate-200 break-all">{word.lang1}</td>
                <td className="px-4 py-2 break-all">{word.lang2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
