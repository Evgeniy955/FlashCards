
import React, { useState, useEffect, useCallback } from 'react';
import { Database, Loader2, Trash2, Cloud, RefreshCw } from 'lucide-react';
import { getDictionary, deleteDictionary, saveDictionary, getAllDictionaryDetails } from '../lib/indexedDB';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../lib/firebase-client';
import { base64ToFile } from '../utils/fileUtils';

interface LocalDictionariesProps {
  onSelect: (name: string, wordsFile: File) => void;
}

interface DictionaryStatus {
    name: string; // base name for display
    fileName: string; // full file name, e.g., "List1.xlsx"
    isLocal: boolean;
    isRemote: boolean;
    isNewerRemote?: boolean;
}

const FIRESTORE_DOC_SIZE_LIMIT = 950 * 1024; // 950 KB to be safe from 1 MiB limit

export const LocalDictionaries: React.FC<LocalDictionariesProps> = ({ onSelect }) => {
  const [savedDicts, setSavedDicts] = useState<DictionaryStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<{ name: string, type: 'select' | 'delete' | 'sync' } | null>(null);
  const [user] = useAuthState(auth);

  const syncAndFetchDictionaries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Step 1: Fetch remote state (active dicts and deleted dicts/tombstones)
      const remoteDictMap = new Map<string, any>();
      const remoteTombstones = new Set<string>();
      if (user) {
          // FIX: Use compat API for Firestore
          const firestoreDictsRef = db.collection('users').doc(user.uid).collection('dictionaries');
          const querySnapshot = await firestoreDictsRef.get();
          querySnapshot.forEach(docSnap => {
              const data = docSnap.data();
              if (data.deleted) {
                  remoteTombstones.add(docSnap.id);
              } else {
                  remoteDictMap.set(docSnap.id, data);
              }
          });
      }
      
      // Step 2: Sync remote deletions to local storage
      let allLocalDicts = await getAllDictionaryDetails(user?.uid);
      const localCleanupPromises = allLocalDicts
        .filter(localDict => remoteTombstones.has(localDict.fileName))
        .map(dictToDelete => deleteDictionary(dictToDelete.name, user?.uid));
      
      if (localCleanupPromises.length > 0) {
        await Promise.all(localCleanupPromises);
        allLocalDicts = await getAllDictionaryDetails(user?.uid); // Re-fetch after cleanup
      }

      // Step 3: Two-way sync (Check for missing OR newer files)
      if (user) {
        const allLocalDictsMap = new Map(allLocalDicts.map(dict => [dict.fileName, dict]));
        const userUploadedLocalDictsMap = new Map(allLocalDicts.filter(d => !d.isBuiltIn).map(d => [d.fileName, d]));

        // 3a. Upload local-only dictionaries or update if local is newer
        for (const [fileName, localData] of userUploadedLocalDictsMap.entries()) {
            const remoteData = remoteDictMap.get(fileName);
            let shouldUpload = false;

            if (!remoteData) {
                shouldUpload = true;
            } else {
                // Compare timestamps. 
                // Firestore Timestamp conversion:
                const remoteTime = remoteData.lastModified?.toDate ? remoteData.lastModified.toDate().getTime() : new Date(remoteData.lastModified).getTime();
                // If local is significantly newer (> 2 seconds difference to account for clock drift/processing)
                if (localData.lastModified > remoteTime + 2000) {
                    shouldUpload = true;
                }
            }

            if (shouldUpload) {
                const file = base64ToFile(localData.content, localData.fileName, localData.mimeType, localData.lastModified);
                if (file.size > FIRESTORE_DOC_SIZE_LIMIT) continue;
                
                const dictionaryDocRef = db.collection('users').doc(user.uid).collection('dictionaries').doc(fileName);
                await dictionaryDocRef.set({
                    name: fileName,
                    content: localData.content,
                    mimeType: localData.mimeType,
                    lastModified: new Date(localData.lastModified), // Store upload time matches local file mod time
                });
            }
        }

        // 3b. Download remote-only dictionaries or update if remote is newer
        for (const [fileName, remoteData] of remoteDictMap.entries()) {
            const localData = allLocalDictsMap.get(fileName);
            let shouldDownload = false;

            const remoteTime = remoteData.lastModified?.toDate ? remoteData.lastModified.toDate().getTime() : new Date(remoteData.lastModified).getTime();

            if (!localData) {
                shouldDownload = true;
            } else {
                 // If remote is significantly newer (> 2 seconds)
                 if (remoteTime > localData.lastModified + 2000) {
                     shouldDownload = true;
                 }
            }

            if (shouldDownload) {
                const dictBaseName = remoteData.name.replace(/\.xlsx$/i, '');
                const file = base64ToFile(remoteData.content, remoteData.name, remoteData.mimeType, remoteTime);
                await saveDictionary(dictBaseName, file, user.uid);
            }
        }
      }

      // Step 4: Re-fetch all data *after* all sync operations to build the final UI list
      const finalLocalDicts = await getAllDictionaryDetails(user?.uid);
      const finalUserUploadedLocalDicts = finalLocalDicts.filter(d => !d.isBuiltIn);

      const finalRemoteDicts = new Map<string, any>();
      if (user) {
          const finalQuerySnapshot = await db.collection('users').doc(user.uid).collection('dictionaries').get();
          finalQuerySnapshot.forEach(docSnap => {
              if (!docSnap.data().deleted) {
                  finalRemoteDicts.set(docSnap.id, docSnap.data());
              }
          });
      }

      const uiFileNames = new Set([...finalRemoteDicts.keys(), ...finalUserUploadedLocalDicts.map(d => d.fileName)]);
      const statusList = Array.from(uiFileNames).map(fileName => ({
          name: fileName.replace(/\.xlsx$/i, ''),
          fileName: fileName,
          isLocal: finalUserUploadedLocalDicts.some(d => d.fileName === fileName),
          isRemote: finalRemoteDicts.has(fileName),
      })).sort((a, b) => a.name.localeCompare(b.name));
      
      setSavedDicts(statusList);

    } catch (err) {
      setError('Could not load or sync dictionaries. Please check your connection.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    syncAndFetchDictionaries();
  }, [syncAndFetchDictionaries]);

  const handleSelect = async (name: string) => {
    setActionInProgress({ name, type: 'select' });
    setError(null);
    try {
      const localDict = await getDictionary(name, user?.uid);
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

  const handleDelete = async (dict: DictionaryStatus) => {
    if (window.confirm(`Are you sure you want to delete "${dict.name}"? This will permanently remove it from this device and from the cloud if synced.`)) {
      setActionInProgress({ name: dict.name, type: 'delete' });
      setError(null);
      try {
        if (user && dict.isRemote) {
          const dictionaryDocRef = db.collection('users').doc(user.uid).collection('dictionaries').doc(dict.fileName);
          await dictionaryDocRef.update({ deleted: true, deletedAt: new Date() });
        } else if (dict.isLocal) {
          await deleteDictionary(dict.name, user?.uid);
        }
        await syncAndFetchDictionaries();
      } catch (err) {
        setError(`Failed to delete "${dict.name}". Please check your connection and try again.`);
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
     return (
       <div className="text-center space-y-2">
         <p className="text-rose-500 dark:text-rose-400">{error}</p>
         <button onClick={syncAndFetchDictionaries} className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-center gap-2 w-full">
           <RefreshCw size={16} /> Retry
         </button>
       </div>
     );
  }

  return (
    <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a saved dictionary:</h3>
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
                            <Database className="h-5 w-5 flex-shrink-0 text-slate-500" />
                        )}
                        <span className="flex-grow truncate" title={dict.name}>{dict.name}</span>
                        <div className="flex items-center gap-2">
                           {dict.isLocal && <span title="Saved locally on this device"><Database size={16} className="text-sky-500" /></span>}
                           {dict.isRemote && <span title="Saved in the cloud"><Cloud size={16} className="text-amber-500" /></span>}
                        </div>
                    </button>
                    <button 
                        onClick={() => handleDelete(dict)} 
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
    </div>
  );
};
