import React, { useState, useEffect } from 'react';
import { Database, Loader2, Trash2 } from 'lucide-react';
import { getDictionaries, getDictionary, deleteDictionary, saveDictionary } from '../lib/indexedDB';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase-client';
import { collection, getDocs, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { base64ToFile, fileToBase64 } from '../utils/fileUtils';

interface LocalDictionariesProps {
  onSelect: (name: string, wordsFile: File) => void;
}

const FIRESTORE_DOC_SIZE_LIMIT = 950 * 1024; // 950 KB to be safe from 1 MiB limit

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
          // 1. Get remote dictionaries from Firestore
          const firestoreDictsRef = collection(db, `users/${user.uid}/dictionaries`);
          const querySnapshot = await getDocs(firestoreDictsRef);
          const remoteDicts = new Map<string, any>(); // key: full filename
          querySnapshot.forEach(doc => {
            remoteDicts.set(doc.id, doc.data());
          });

          // 2. Get local dictionaries from IndexedDB
          const localDictNames = await getDictionaries(); // These are base names
          const localDictFiles = new Map<string, File>(); // key: full filename
          for (const name of localDictNames) {
            const dict = await getDictionary(name);
            if (dict?.file) {
              localDictFiles.set(dict.file.name, dict.file);
            }
          }

          // 3. Compare and sync
          // 3a. Upload local-only dictionaries to Firestore
          for (const [fileName, file] of localDictFiles.entries()) {
            if (!remoteDicts.has(fileName)) {
              if (file.size > FIRESTORE_DOC_SIZE_LIMIT) {
                console.warn(`Local dictionary "${fileName}" is too large to sync to the cloud.`);
                continue; // Skip uploading this file
              }
              const base64Content = await fileToBase64(file);
              const dictionaryDocRef = doc(db, `users/${user.uid}/dictionaries/${fileName}`);
              await setDoc(dictionaryDocRef, {
                name: fileName,
                content: base64Content,
                mimeType: file.type,
                lastModified: new Date(file.lastModified),
              });
            }
          }

          // 3b. Download remote-only dictionaries to IndexedDB
          for (const [fileName, data] of remoteDicts.entries()) {
            if (!localDictFiles.has(fileName)) {
              const dictBaseName = data.name.replace(/\.xlsx$/i, '');
              const file = base64ToFile(data.content, data.name, data.mimeType);
              await saveDictionary(dictBaseName, file);
            }
          }
        }

        // 4. Fetch the definitive, synchronized list from IndexedDB to display
        const finalLocalNames = await getDictionaries();
        setSavedDicts(finalLocalNames.sort((a, b) => a.localeCompare(b)));
      } catch (err) {
        setError('Could not load or sync dictionaries. Please check your connection and security rules.');
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
      let fileNameToDelete: string | null = null;

      try {
        // Step 1: Get the full filename BEFORE any deletion attempts.
        // This also verifies that the local data is readable.
        const dictFromDb = await getDictionary(name);
        if (!dictFromDb?.file?.name) {
          throw new Error("Could not retrieve dictionary details from the local database. It might be corrupted or outdated.");
        }
        fileNameToDelete = dictFromDb.file.name;

        // Step 2: Perform deletions now that we have the full filename.
        await deleteDictionary(name); // Delete from IndexedDB

        if (user && fileNameToDelete) {
          const dictionaryDocRef = doc(db, `users/${user.uid}/dictionaries/${fileNameToDelete}`);
          await deleteDoc(dictionaryDocRef);
        }

        setSavedDicts(prev => prev.filter(d => d !== name));
      } catch (err) {
        setError(`Failed to delete "${name}". This can happen after an app update. Please reload the page and try again.`);
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
