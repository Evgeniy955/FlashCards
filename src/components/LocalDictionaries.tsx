import React, { useState, useEffect } from 'react';
import { Database, Loader2, Trash2 } from 'lucide-react';
import { getDictionaries, getDictionary, deleteDictionary, saveDictionary } from '../lib/indexedDB';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase-client';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { base64ToFile } from '../utils/fileUtils';

interface LocalDictionariesProps {
  onSelect: (name: string, wordsFile: File) => void;
}

export const LocalDictionaries: React.FC<LocalDictionariesProps> = ({ onSelect }) => {
  const [savedDicts, setSavedDicts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<{ name: string, type: 'select' | 'delete' } | null>(null);
  const [user] = useAuthState(auth);

  useEffect(() => {
    const syncAndFetchDictionaries = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (user) {
          // Sync from Firestore to IndexedDB
          const firestoreDictsRef = collection(db, `users/${user.uid}/dictionaries`);
          const querySnapshot = await getDocs(firestoreDictsRef);
          
          for (const doc of querySnapshot.docs) {
            const data = doc.data();
            const dictBaseName = data.name.replace('.xlsx', '');
            const file = base64ToFile(data.content, data.name, data.mimeType);
            await saveDictionary(dictBaseName, file); // This will add or overwrite
          }
        }
        
        // Fetch from IndexedDB to display
        const finalLocalNames = await getDictionaries();
        setSavedDicts(finalLocalNames.sort((a, b) => a.localeCompare(b)));
      } catch (err) {
        setError('Could not load dictionaries.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    syncAndFetchDictionaries();
  }, [user]);

  const handleSelect = async (name: string) => {
    setActionInProgress({ name, type: 'select' });
    setError(null);
    try {
      const localDict = await getDictionary(name);
      if (localDict) {
        onSelect(localDict.name, localDict.file);
      } else {
        throw new Error("Dictionary not found on this device.");
      }
    } catch (err) {
      setError(`Failed to load dictionary: ${name}. ${(err as Error).message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This will permanently remove it from this device and from the cloud if synced.`)) {
      setActionInProgress({ name, type: 'delete' });
      setError(null);
      try {
        let fileNameToDelete: string | null = null;
        const dictFromDb = await getDictionary(name);
        if (dictFromDb) {
            fileNameToDelete = dictFromDb.file.name;
        }

        await deleteDictionary(name); // Deletes from IndexedDB

        if (user && fileNameToDelete) {
            const dictionaryDocRef = doc(db, `users/${user.uid}/dictionaries/${fileNameToDelete}`);
            await deleteDoc(dictionaryDocRef);
        }

        setSavedDicts(prev => prev.filter(d => d !== name));
      } catch (err) {
        setError(`Failed to delete dictionary: ${name}`);
        console.error(err);
      } finally {
        setActionInProgress(null);
      }
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>;
  }
  
  if (savedDicts.length === 0) {
    return <p className="text-center text-slate-500 dark:text-slate-400">No dictionaries saved. Upload one from your computer to save it here.</p>;
  }
  
  if (error) {
     return <p className="text-center text-rose-500 dark:text-rose-400">{error}</p>;
  }

  return (
    <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a saved dictionary:</h3>
        <ul className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {savedDicts.map(dictName => (
                <li key={dictName} className="flex items-center gap-2">
                    <button
                        onClick={() => handleSelect(dictName)}
                        disabled={!!actionInProgress}
                        className="w-full flex items-center gap-3 p-3 text-left text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                    >
                        {actionInProgress?.name === dictName && actionInProgress.type === 'select' ? (
                            <Loader2 className="animate-spin h-5 w-5 flex-shrink-0" />
                        ) : (
                            <Database className="h-5 w-5 flex-shrink-0" />
                        )}
                        <span className="flex-grow truncate" title={dictName}>{dictName}</span>
                    </button>
                    <button 
                        onClick={() => handleDelete(dictName)} 
                        disabled={!!actionInProgress}
                        className="p-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white rounded-md transition-colors disabled:opacity-50 flex-shrink-0"
                        aria-label={`Delete ${dictName}`}
                    >
                        {actionInProgress?.name === dictName && actionInProgress.type === 'delete' ? (
                            <Loader2 className="animate-spin h-5 w-5" />
                        ) : (
                            <Trash2 size={18} />
                        )}
                    </button>
                </li>
            ))}
        </ul>
    </div>
  );
};
