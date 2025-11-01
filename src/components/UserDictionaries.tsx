import React, { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { db, storage } from '../lib/firebase-client';
import { collection, query, getDocs, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { UserDictionary } from '../types';
import { Book, Loader2, Trash2, Download } from 'lucide-react';

interface UserDictionariesProps {
  user: User;
  onLoad: (dictionary: UserDictionary) => void;
  onCloseModal: () => void;
}

export const UserDictionaries: React.FC<UserDictionariesProps> = ({ user, onLoad, onCloseModal }) => {
  const [dictionaries, setDictionaries] = useState<UserDictionary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState<string | null>(null); // For load/delete actions
  const [error, setError] = useState<string | null>(null);

  const fetchDictionaries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, `users/${user.uid}/dictionaries`), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const userDictionaries: UserDictionary[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        userDictionaries.push({ id: doc.id, name: data.name, storagePath: data.storagePath });
      });
      setDictionaries(userDictionaries);
    } catch (err) {
      setError('Failed to fetch your dictionaries.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [user.uid]);

  useEffect(() => {
    fetchDictionaries();
  }, [fetchDictionaries]);

  const handleDelete = async (dictionary: UserDictionary) => {
    if (!window.confirm(`Are you sure you want to delete "${dictionary.name}"? This cannot be undone.`)) {
      return;
    }
    setIsProcessing(dictionary.id);
    setError(null);
    try {
      // Delete file from Storage
      const storageRef = ref(storage, dictionary.storagePath);
      await deleteObject(storageRef);

      // Delete document from Firestore
      await deleteDoc(doc(db, `users/${user.uid}/dictionaries`, dictionary.id));

      // Update state
      setDictionaries(prev => prev.filter(d => d.id !== dictionary.id));
    } catch (err) {
      setError('Failed to delete the dictionary.');
      console.error(err);
    } finally {
      setIsProcessing(null);
    }
  };
  
  const handleLoad = (dictionary: UserDictionary) => {
    setIsProcessing(dictionary.id);
    onLoad(dictionary);
    // The modal will be closed by the parent component after loading starts
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
        <p className="text-slate-400">You haven't saved any dictionaries yet.</p>
        <p className="text-xs text-slate-500 mt-1">Upload a file from your computer to save it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-400">Select one of your saved dictionaries:</h3>
        <ul className="max-h-64 overflow-y-auto space-y-2 pr-2">
            {dictionaries.map(dict => (
                <li key={dict.id} className="w-full flex items-center gap-2 p-2 text-left text-sm text-slate-300 bg-slate-700 rounded-md">
                    {isProcessing === dict.id ? (
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
                        onClick={() => handleDelete(dict)}
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