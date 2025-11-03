import React, { useState } from 'react';
import { Modal } from './Modal';
import { FileUpload } from './FileUpload';
import { BuiltInDictionaries } from './BuiltInDictionaries';
import { LocalDictionaries } from './LocalDictionaries';
import { saveDictionary } from '../lib/indexedDB';
import { Library, Upload, Database } from 'lucide-react';
import { User } from 'firebase/auth';
import { db } from '../lib/firebase-client';
import { doc, setDoc } from 'firebase/firestore';
import { fileToBase64 } from '../utils/fileUtils';


interface FileSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelect: (name: string, wordsFile: File, sentencesFile?: File) => void;
  isLoading: boolean;
  user: User | null | undefined;
}

type Tab = 'built-in' | 'local' | 'computer';

const FIRESTORE_DOC_SIZE_LIMIT = 950 * 1024; // 950 KB to be safe from 1 MiB limit

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
    const dictionaryName = file.name.replace(/\.xlsx$/i, '');
    setIsUploading(true);

    try {
      await saveDictionary(dictionaryName, file);

      // Sync to Firestore if user is logged in and file is within size limits
      if (user) {
        if (file.size > FIRESTORE_DOC_SIZE_LIMIT) {
          alert(`Dictionary "${file.name}" has been saved locally, but it's too large to sync to the cloud (over 950KB). It won't be available on other devices.`);
          console.warn(`File ${file.name} is too large (${file.size} bytes) to sync to Firestore. It's saved locally.`);
        } else {
          try {
            const base64Content = await fileToBase64(file);
            const dictionaryDocRef = doc(db, `users/${user.uid}/dictionaries/${file.name}`);
            await setDoc(dictionaryDocRef, {
              name: file.name,
              content: base64Content,
              mimeType: file.type,
              lastModified: new Date(),
            });
          } catch (error) {
            console.error("Firestore dictionary sync failed:", error);
            alert(`Dictionary saved locally, but failed to sync to the cloud. Please check your internet connection and Firestore permissions. Error: ${(error as Error).message}`);
          }
        }
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
