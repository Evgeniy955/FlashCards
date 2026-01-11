
import React, { useState, useEffect, useCallback } from 'react';
import { Database, Loader2, Trash2, Cloud, RefreshCw, BookCheck } from 'lucide-react';
import { getDictionary, deleteDictionary, getAllDictionaryDetails } from '../lib/indexedDB';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase-client';

interface LocalDictionariesProps {
  onSelect: (name: string, wordsFiles: File[]) => void;
}

interface DictionaryStatus {
    name: string;
    fileName: string;
    isLocal: boolean;
    isRemote: boolean;
}

export const LocalDictionaries: React.FC<LocalDictionariesProps> = ({ onSelect }) => {
  const [savedDicts, setSavedDicts] = useState<DictionaryStatus[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user] = useAuthState(auth);

  const fetchDictionaries = useCallback(async () => {
    setIsLoading(true);
    try {
      const details = await getAllDictionaryDetails(user?.uid);
      const statusList = details.map(d => ({
          name: d.name,
          fileName: d.fileName,
          isLocal: true,
          isRemote: !!d.userId,
      })).sort((a, b) => a.name.localeCompare(b.name));
      setSavedDicts(statusList);
    } catch (err) {
      setError('Could not load dictionaries.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDictionaries();
  }, [fetchDictionaries]);

  const toggleSelect = (name: string) => {
    const newSelected = new Set(selectedNames);
    if (newSelected.has(name)) newSelected.delete(name);
    else newSelected.add(name);
    setSelectedNames(newSelected);
  };

  const handleStudySelected = async () => {
    const files: File[] = [];
    for (const name of selectedNames) {
        const dict = await getDictionary(name, user?.uid);
        if (dict) files.push(dict.file);
    }
    if (files.length > 0) {
        onSelect("Multiple Dictionaries", files);
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-500">Select dictionaries to study:</h3>
            {selectedNames.size > 0 && (
                <button 
                    onClick={handleStudySelected}
                    className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-full hover:bg-indigo-700 transition-colors shadow-lg"
                >
                    <BookCheck size={14} /> Study Selected ({selectedNames.size})
                </button>
            )}
        </div>

        <ul className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {savedDicts.map(dict => (
                <li key={dict.name} className="flex items-center gap-2">
                    <button
                        onClick={() => toggleSelect(dict.name)}
                        className={`flex-grow flex items-center justify-between p-3 text-sm rounded-lg border transition-all ${
                            selectedNames.has(dict.name) 
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <input 
                                type="checkbox" 
                                checked={selectedNames.has(dict.name)} 
                                readOnly 
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <Database size={16} className="text-slate-400" />
                            <span className="font-medium dark:text-slate-200">{dict.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           {dict.isRemote && <Cloud size={14} className="text-amber-500" />}
                        </div>
                    </button>
                </li>
            ))}
        </ul>
    </div>
  );
};
