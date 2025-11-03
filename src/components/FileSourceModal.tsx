import React, { useState } from 'react';
import { Modal } from './Modal';
import { FileUpload } from './FileUpload';
import { BuiltInDictionaries } from './BuiltInDictionaries';
import { LocalDictionaries } from './LocalDictionaries';
import { saveDictionary } from '../lib/indexedDB';
import { Library, Upload, Database } from 'lucide-react';
import { User } from 'firebase/auth';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase-client';


interface FileSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelect: (name: string, wordsFile: File, sentencesFile?: File) => void;
  isLoading: boolean;
  user: User | null | undefined;
}

type Tab = 'built-in' | 'local' | 'computer';

// Moved TabButton outside the component to prevent re-creation on each render.
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

  const handleLocalFileSelect = async (file: File) => {
    const dictionaryName = file.name.endsWith('.xlsx') ? file.name.slice(0, -5) : file.name;
    
    // Always save to IndexedDB for offline access and speed
    try {
      await saveDictionary(dictionaryName, file);
    } catch (error) {
        console.error("Failed to save dictionary to IndexedDB:", error);
        // This is not a critical failure, so we just log it and continue.
    }

    // If user is logged in, also upload to Firebase Storage
    if (user) {
        const storageRef = ref(storage, `user_dictionaries/${user.uid}/${file.name}`);
        try {
            await uploadBytes(storageRef, file);
        } catch (error) {
            console.error("Failed to upload dictionary to Firebase Storage:", error);
            alert(`Failed to upload dictionary to your account due to an error: ${(error as Error).message}. It will be available on this device only.`);
        }
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
          <LocalDictionaries onSelect={handleLocalDictionarySelect} user={user} />
        )}
        {activeTab === 'computer' && (
          <FileUpload onFileUpload={handleLocalFileSelect} isLoading={isLoading} />
        )}
      </div>
    </Modal>
  );
};