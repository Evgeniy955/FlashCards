import React, { useState, useEffect, useCallback } from 'react';
import { LoadedDictionary } from '../types';
import { getLocalDictionaries, deleteDictionaryLocally } from '../lib/localDb';
import { Book, Loader2, Trash2, Download } from 'lucide-react';

interface LocalDictionariesProps {
  onLoad: (dictionary: LoadedDictionary) => void;
}

export const LocalDictionaries: React.FC<LocalDictionariesProps> = ({ onLoad }) => {
  const [dictionaries, setDictionaries] = useState<LoadedDictionary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDictionaries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const localDictionaries = await getLocalDictionaries();
      setDictionaries(localDictionaries.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError('Failed to fetch your local dictionaries.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDictionaries();
  }, [fetchDictionaries]);

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" from this device? This cannot be undone.`)) {
      return;
    }
    setIsProcessing(name);
    setError(null);
    try {
      await deleteDictionaryLocally(name);
      setDictionaries(prev => prev.filter(d => d.name !== name));
    } catch (err) {
      setError('Failed to delete the dictionary.');
      console.error(err);
    } finally {
      setIsProcessing(null);
    }
  };
  
  const handleLoad = (dictionary: LoadedDictionary) => {
    setIsProcessing(dictionary.name);
    onLoad(dictionary);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-400">{error}</p>;
  }

  if (dictionaries.length === 0) {
    return (
      <div className="text-center h-48 flex flex-col justify-center items-center">
        <Book className="h-10 w-10 text-slate-500 mb-3" />
        <p className="text-slate-400">You haven't saved any dictionaries locally.</p>
        <p className="text-xs text-slate-500 mt-1">Upload a file from your computer to save it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400">Select a dictionary saved on this device:</h3>
        <ul className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {dictionaries.map(dict => (
                <li key={dict.name} className="w-full flex items-center gap-2 p-2 text-left text-sm text-slate-300 bg-slate-700 rounded-md">
                    {isProcessing === dict.name ? (
                        <Loader2 className="animate-spin h-5 w-5 flex-shrink-0" />
                    ) : (
                        <Book className="h-5 w-5 flex-shrink-0 text-slate-400" />
                    )}
                    <span className="flex-grow truncate">{dict.name}</span>
                    <button
                        onClick={() => handleLoad(dict)}
                        disabled={!!isProcessing}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                        title="Load dictionary"
                    >
                        <Download size={16} />
                    </button>
                    <button
                        onClick={() => handleDelete(dict.name)}
                        disabled={!!isProcessing}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                        title="Delete dictionary"
                    >
                        <Trash2 size={16} />
                    </button>
                </li>
            ))}
        </ul>
    </div>
  );
};
