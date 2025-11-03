import React, { useState, useEffect, useCallback } from 'react';
import { Database, Loader2, Trash2 } from 'lucide-react';
import { getDictionaries as getLocalDictionaries, getDictionary as getLocalDictionary, deleteDictionary as deleteLocalDictionary } from '../lib/indexedDB';
import { db, storage } from '../lib/firebase-client';
import { collection, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ref, getBlob, deleteObject } from 'firebase/storage';
import { User } from 'firebase/auth';

interface LocalDictionariesProps {
  onSelect: (name: string, wordsFile: File) => void;
  refreshKey: number;
  user: User | null | undefined;
}

export const LocalDictionaries: React.FC<LocalDictionariesProps> = ({ onSelect, refreshKey, user }) => {
  const [savedDicts, setSavedDicts] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchDictionaries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let names: string[];
      if (user) {
        // Fetch from Firestore for logged-in user
        const querySnapshot = await getDocs(collection(db, `users/${user.uid}/dictionaries`));
        names = querySnapshot.docs.map(doc => doc.id);
      } else {
        // Fetch from IndexedDB for anonymous user
        names = await getLocalDictionaries();
      }
      setSavedDicts(names.sort((a, b) => a.localeCompare(b)));
    } catch (err) {
      setError('Could not load saved dictionaries.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDictionaries();
  }, [fetchDictionaries, refreshKey]);

  const handleSelect = async (name: string) => {
    setActionInProgress(name);
    try {
      if (user) {
        // Get from Firebase Storage
        const docRef = doc(db, `users/${user.uid}/dictionaries/${name}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const fileName = docSnap.data().fileName;
            const storageRef = ref(storage, `user_dictionaries/${user.uid}/${fileName}`);
            const blob = await getBlob(storageRef);
            const file = new File([blob], fileName, { type: blob.type });
            onSelect(name, file);
        } else {
            throw new Error("Dictionary metadata not found in Firestore.");
        }
      } else {
        // Get from IndexedDB
        const dict = await getLocalDictionary(name);
        if (dict) {
          onSelect(dict.name, dict.file);
        } else {
          throw new Error("Dictionary not found in local storage.");
        }
      }
    } catch (err) {
      console.error(err);
      setError(`Failed to load dictionary: ${name}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This will remove it from all your devices.`)) {
      setActionInProgress(name);
      try {
        if (user) {
            // Delete from Firestore and Firebase Storage
            const docRef = doc(db, `users/${user.uid}/dictionaries/${name}`);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const fileName = docSnap.data().fileName;
                const storageRef = ref(storage, `user_dictionaries/${user.uid}/${fileName}`);
                await deleteObject(storageRef);
            }
            await deleteDoc(docRef);
        } else {
            // Delete from IndexedDB
            await deleteLocalDictionary(name);
        }
        setSavedDicts(prev => prev.filter(d => d !== name));
      } catch (err) {
        console.error(err);
        setError(`Failed to delete dictionary: ${name}`);
      } finally {
        setActionInProgress(null);
      }
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-40"><Loader2 className="animate-spin h-8 w-8 text-slate-400" /></div>;
  }
  
  if (error) {
    return <p className="text-center text-red-400">{error}</p>;
  }
  
  if (savedDicts.length === 0) {
    const message = user 
        ? "No dictionaries found in your account. Upload one to get started."
        : "No dictionaries saved locally. Upload one to save it here for future sessions.";
    return <p className="text-center text-slate-500 dark:text-slate-400">{message}</p>;
  }

  return (
    <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Select one of your dictionaries:</h3>
        <ul className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {savedDicts.map(name => (
                <li key={name} className="flex items-center gap-2">
                    <button
                        onClick={() => handleSelect(name)}
                        disabled={!!actionInProgress}
                        className="w-full flex items-center gap-3 p-3 text-left text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                    >
                         {actionInProgress === name && !window.confirm ? (
                            <Loader2 className="animate-spin h-5 w-5 flex-shrink-0" />
                        ) : (
                            <Database className="h-5 w-5 flex-shrink-0" />
                        )}
                        <span className="flex-grow truncate" title={name}>{name}</span>
                    </button>
                    <button 
                        onClick={() => handleDelete(name)} 
                        disabled={!!actionInProgress}
                        className="p-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-rose-500 hover:text-white rounded-md transition-colors disabled:opacity-50 flex-shrink-0"
                        aria-label={`Delete ${name}`}
                    >
                        <Trash2 size={18} />
                    </button>
                </li>
            ))}
        </ul>
    </div>
  );
};