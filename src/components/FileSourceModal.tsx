import React, { useState } from 'react';
import { Modal } from './Modal';
import { FileUpload } from './FileUpload';
import { BuiltInDictionaries } from './BuiltInDictionaries';
import { LocalDictionaries } from './LocalDictionaries';
import { saveDictionary } from '../lib/indexedDB';
import { Library, Upload, Database } from 'lucide-react';
import { User } from 'firebase/auth';
import { storage } from '../lib/firebase-client';
import { ref, uploadBytes } from 'firebase/storage';


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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCounter, setUploadCounter] = useState(0);

  const handleFileUpload = async (file: File) => {
    const dictionaryName = file.name.endsWith('.xlsx') ? file.name.slice(0, -5) : file.name;
    setIsUploading(true);
    
    try {
      await saveDictionary(dictionaryName, file);

      // If user is logged in, save to Firebase Storage after a delay.
      // This is a "fire and forget" operation from the user's perspective.
      if (user) {
        setTimeout(async () => {
          try {
            const storageRef = ref(storage, `users/${user.uid}/dictionaries/${file.name}`);
            await uploadBytes(storageRef, file);
          } catch (error) {
            console.error("Background dictionary sync to Firebase failed:", error);
            // We don't alert the user as this is a background task.
          }
        }, 5000);
      }

      setIsUploading(false);
      // Switch to the 'My Dictionaries' tab to show the newly added file
      setActiveTab('local');
      // Increment a counter to force the LocalDictionaries component to re-mount and fetch the new list
      setUploadCounter(c => c + 1);
    } catch (error) {
        console.error("Failed to save dictionary to IndexedDB:", error);
        alert(`Failed to save dictionary locally: ${(error as Error).message}. Please try again.`);
        setIsUploading(false);
    }
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
          <LocalDictionaries key={uploadCounter} onSelect={handleLocalDictionarySelect} />
        )}
        {activeTab === 'computer' && (
          <FileUpload onFileUpload={handleFileUpload} isLoading={isUploading} />
        )}
      </div>
    </Modal>
  );
};