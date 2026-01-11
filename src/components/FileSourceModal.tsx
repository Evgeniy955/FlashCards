
import React, { useState } from 'react';
import { Modal } from './Modal';
import { FileUpload } from './FileUpload';
import { BuiltInDictionaries } from './BuiltInDictionaries';
import { LocalDictionaries } from './LocalDictionaries';
import { saveDictionary } from '../lib/indexedDB';
import { Library, Upload, Database } from 'lucide-react';
import { firebase, db } from '../lib/firebase-client';
import { fileToBase64 } from '../utils/fileUtils';


interface FileSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelect: (name: string, wordsFiles: File[]) => void;
  isLoading: boolean;
  user: any;
}

type Tab = 'built-in' | 'local' | 'computer';

const TabButton = ({ activeTab, tab, onClick, children }: React.PropsWithChildren<{ activeTab: Tab, tab: Tab, onClick: (tab: Tab) => void }>) => (
  <button
    onClick={() => onClick(tab)}
    className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-indigo-500 text-indigo-600 dark:text-white'
        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900'
    }`}
  >
    {children}
  </button>
);


export const FileSourceModal: React.FC<FileSourceModalProps> = ({ isOpen, onClose, onFilesSelect, isLoading, user }) => {
  const [activeTab, setActiveTab] = useState<Tab>('built-in');

  const handleFileUpload = async (file: File) => {
    const dictionaryName = file.name.replace(/\.xlsx$/i, '');
    await saveDictionary(dictionaryName, file, user?.uid);
    setActiveTab('local');
  };

  const handleBuiltInSelect = async (name: string, wordsFile: File) => {
    onFilesSelect(name, [wordsFile]);
  };
  
  const handleLocalDictionarySelect = (name: string, wordsFiles: File[]) => {
    onFilesSelect(name, wordsFiles);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Dictionary Source">
      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <TabButton activeTab={activeTab} tab="built-in" onClick={setActiveTab}><Library size={16} /> Built-in</TabButton>
        <TabButton activeTab={activeTab} tab="local" onClick={setActiveTab}><Database size={16} /> Saved</TabButton>
        <TabButton activeTab={activeTab} tab="computer" onClick={setActiveTab}><Upload size={16} /> Upload</TabButton>
      </div>
      <div className="pt-6">
        {activeTab === 'built-in' && <BuiltInDictionaries onSelect={handleBuiltInSelect} />}
        {activeTab === 'local' && <LocalDictionaries onSelect={handleLocalDictionarySelect} />}
        {activeTab === 'computer' && <FileUpload onFileUpload={handleFileUpload} isLoading={isLoading} />}
      </div>
    </Modal>
  );
};
