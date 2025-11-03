import React, { useState, useEffect, useCallback } from 'react';
import { Database, Loader2, Trash2, Cloud, AlertTriangle } from 'lucide-react';
import { getDictionaries, getDictionary, deleteDictionary, saveDictionary } from '../lib/indexedDB';
import { User } from 'firebase/auth';
import { storage } from '../lib/firebase-client';
import { ref, listAll, getDownloadURL, deleteObject } from 'firebase/storage';

interface LocalDictionariesProps {
  onSelect: (name: string, wordsFile: File) => void;
  user: User | null | undefined;
}

interface DictionarySource {
    name: string;
    source: 'local' | 'cloud';
}

export const LocalDictionaries: React.FC<LocalDictionariesProps> = ({ onSelect, user }) => {
  const [savedDicts, setSavedDicts] = useState<DictionarySource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<{ name: string, type: 'select' | 'delete' } | null>(null);

  // This state will track if a cloud fetch has failed, to prevent repeated requests.
  const [cloudFetchFailed, setCloudFetchFailed] = useState(false);
  
  const uid = user?.uid;

  // Reset cloud error state when user logs in or out, allowing a fresh attempt to connect.
  useEffect(() => {
    setCloudFetchFailed(false);
  }, [uid]);


  const fetchDictionaries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sources = new Map<string, 'local' | 'cloud'>();
      
      // Always fetch local dictionaries from IndexedDB first.
      const localNames = await getDictionaries();
      for (const name of localNames) {
        sources.set(name, 'local');
      }

      // Attempt to fetch from the cloud ONLY if logged in and a fetch hasn't failed yet in this session.
      if (uid && !cloudFetchFailed) {
        const listRef = ref(storage, `user_dictionaries/${uid}`);
        try {
          const res = await listAll(listRef);
          for (const itemRef of res.items) {
              const cleanName = itemRef.name.endsWith('.xlsx') ? itemRef.name.slice(0, -5) : itemRef.name;
              // Cloud source takes precedence if it exists
              sources.set(cleanName, 'cloud');
          }
        } catch (storageError) {
            console.error("Firebase Storage error while listing files:", storageError);
            setError("Could not connect to cloud storage. Your local dictionaries are still available.");
            setCloudFetchFailed(true); // Set failed flag to prevent retries
        }
      }

      const combinedDicts: DictionarySource[] = Array.from(sources.entries()).map(([name, source]) => ({ name, source }));
      setSavedDicts([...combinedDicts].sort((a, b) => a.name.localeCompare(b.name)));

    } catch (err) {
      setError('Could not load dictionaries from this device.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [uid, cloudFetchFailed]);

  useEffect(() => {
    fetchDictionaries();
  }, [fetchDictionaries]);

  const handleSelect = async (name: string) => {
    setActionInProgress({ name, type: 'select' });
    setError(null);
    try {
      // Always try local first for speed
      const localDict = await getDictionary(name);
      if (localDict) {
        onSelect(localDict.name, localDict.file);
        return;
      }

      // If not local and user is logged in, try fetching from Storage
      if (user) {
        const fileRef = ref(storage, `user_dictionaries/${user.uid}/${name}.xlsx`);
        const url = await getDownloadURL(fileRef);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Download failed.');
        
        const blob = await response.blob();
        const file = new File([blob], `${name}.xlsx`, { type: blob.type });

        // Save downloaded file to IndexedDB for future offline use
        await saveDictionary(name, file);
        onSelect(name, file);
      } else {
          throw new Error("Dictionary not found locally. Please log in to access cloud dictionaries.");
      }
    } catch (err) {
      setError(`Failed to load dictionary: ${name}. ${(err as Error).message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This will remove it from this device and from your account if you are logged in.`)) {
      setActionInProgress({ name, type: 'delete' });
      setError(null);
      try {
        await deleteDictionary(name);
        
        if (user) {
            const fileRef = ref(storage, `user_dictionaries/${user.uid}/${name}.xlsx`);
            // deleteObject will not throw an error if the file doesn't exist.
            await deleteObject(fileRef).catch(error => {
                // We can ignore 'object-not-found' as it might have been only local.
                // @ts-ignore
                if (error.code !== 'storage/object-not-found') throw error;
            });
        }
        setSavedDicts(prev => prev.filter(d => d.name !== name));
      } catch (err) {
        setError(`Failed to delete dictionary: ${name}`);
      } finally {
        setActionInProgress(null);
      }
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>;
  }
  
  if (!error && savedDicts.length === 0) {
    return <p className="text-center text-slate-500 dark:text-slate-400">No dictionaries saved. Upload one from your computer to save it here.</p>;
  }

  return (
    <div className="space-y-3">
        {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/20 rounded-md">
                <AlertTriangle size={20} className="flex-shrink-0" />
                <span>{error}</span>
            </div>
        )}
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a saved dictionary:</h3>
        {savedDicts.length > 0 ? (
            <ul className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {savedDicts.map(dict => (
                    <li key={dict.name} className="flex items-center gap-2">
                        <button
                            onClick={() => handleSelect(dict.name)}
                            disabled={!!actionInProgress}
                            className="w-full flex items-center gap-3 p-3 text-left text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                        >
                            {actionInProgress?.name === dict.name && actionInProgress.type === 'select' ? (
                                <Loader2 className="animate-spin h-5 w-5 flex-shrink-0" />
                            ) : (
                                <Database className="h-5 w-5 flex-shrink-0" />
                            )}
                            <span className="flex-grow truncate" title={dict.name}>{dict.name}</span>
                            {dict.source === 'cloud' && <Cloud size={14} className="text-sky-500 flex-shrink-0" />}
                        </button>
                        <button 
                            onClick={() => handleDelete(dict.name)} 
                            disabled={!!actionInProgress}
                            className="p-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white rounded-md transition-colors disabled:opacity-50 flex-shrink-0"
                            aria-label={`Delete ${dict.name}`}
                        >
                            {actionInProgress?.name === dict.name && actionInProgress.type === 'delete' ? (
                                <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                                <Trash2 size={18} />
                            )}
                        </button>
                    </li>
                ))}
            </ul>
        ) : (
           <p className="text-center text-slate-500 dark:text-slate-400">No dictionaries found on this device.</p>
        )}
    </div>
  );
};