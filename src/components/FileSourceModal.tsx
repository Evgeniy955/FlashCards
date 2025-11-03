import React, { useState } from 'react';
import { Modal } from './Modal';
import { FileUpload } from './FileUpload';
import { BuiltInDictionaries } from './BuiltInDictionaries';
import { LocalDictionaries } from './LocalDictionaries';
import { saveDictionary as saveDictionaryLocally } from '../lib/indexedDB';
import { db, storage } from '../lib/firebase-client';
import { ref, uploadBytes } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { Library, Upload, Database } from 'lucide-react';

interface FileSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelect: (name: string, wordsFile: File, sentencesFile?: File) => void;
  isLoading: boolean;
  user: User | null | undefined;
}

type Tab = 'built-in' | 'local' | 'computer';

const TabButton = ({ activeTab, tab, onClick, children }: React.PropsWithChildren<{ activeTab: Tab, tab: Tab, onClick: (tab: Tab) => void }>) => (
  <button
    onClick={() => onClick(tab)}
    className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-indigo-500 text-indigo-600 dark:text-white'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
    }`}
  >
    {children}
  </button>
);


export const FileSourceModal: React.FC<FileSourceModalProps> = ({ isOpen, onClose, onFilesSelect, isLoading, user }) => {
  const [activeTab, setActiveTab] = useState<Tab>('built-in');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleFileUploaded = async (file: File) => {
    const dictionaryName = file.name.endsWith('.xlsx') ? file.name.slice(0, -5) : file.name;
    
    try {
      if (user) {
        // Logged-in user: save to Firebase Storage and Firestore
        const storageRef = ref(storage, `user_dictionaries/${user.uid}/${file.name}`);
        await uploadBytes(storageRef, file);
        
        const docRef = doc(db, `users/${user.uid}/dictionaries/${dictionaryName}`);
        await setDoc(docRef, {
            fileName: file.name,
            createdAt: new Date().toISOString()
        });
        
      } else {
        // Anonymous user: save to IndexedDB
        await saveDictionaryLocally(dictionaryName, file);
      }
      
      setRefreshKey(k => k + 1); // Trigger refresh in LocalDictionaries
      setActiveTab('local'); // Switch to local tab to show the new entry

    } catch (error) {
        console.error("Failed to save dictionary:", error);
        alert("Could not save the dictionary for future sessions, but it will be loaded for the current one.");
    }
    onFilesSelect(dictionaryName, file);
  };

  const handleBuiltInSelect = (name: string, wordsFile: File, sentencesFile?: File) => {
    onFilesSelect(name, wordsFile, sentencesFile);
  };
  
  const handleLocalDictionarySelect = (name: string, wordsFile: File) => {
    onFilesSelect(name, wordsFile);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select File Source">
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <TabButton activeTab={activeTab} tab="built-in" onClick={setActiveTab}><Library size={16} /> Built-in</TabButton>
        <TabButton activeTab={activeTab} tab="local" onClick={setActiveTab}><Database size={16} /> My Dictionaries</TabButton>
        <TabButton activeTab={activeTab} tab="computer" onClick={setActiveTab}><Upload size={16} /> From Computer</TabButton>
      </div>
      <div className="pt-6">
        {activeTab === 'built-in' && (
          <BuiltInDictionaries onSelect={handleBuiltInSelect} />
        )}
        {activeTab === 'local' && (
          <LocalDictionaries onSelect={handleLocalDictionarySelect} refreshKey={refreshKey} user={user} />
        )}
        {activeTab === 'computer' && (
          <FileUpload onFileUpload={handleFileUploaded} isLoading={isLoading} />
        )}
      </div>
    </Modal>
  );
};