import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Modal } from './Modal';
import { FileUpload } from './FileUpload';
import { BuiltInDictionaries } from './BuiltInDictionaries';
import { UserDictionaries } from './UserDictionaries';
import { Library, Upload, User as UserIcon } from 'lucide-react';
import { UserDictionary } from '../types';

interface FileSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesSelect: (name: string, wordsFile: File, sentencesFile?: File) => void;
  onUserDictionaryLoad: (dictionary: UserDictionary) => void;
  isLoading: boolean;
  user: User | null | undefined;
}

type Tab = 'built-in' | 'computer' | 'user';

// Moved TabButton outside the component to prevent re-creation on each render.
const TabButton = ({ activeTab, tab, onClick, children }: React.PropsWithChildren<{ activeTab: Tab, tab: Tab, onClick: (tab: Tab) => void }>) => (
  <button
    onClick={() => onClick(tab)}
    className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-indigo-500 text-white'
        : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
    }`}
  >
    {children}
  </button>
);


export const FileSourceModal: React.FC<FileSourceModalProps> = ({ isOpen, onClose, onFilesSelect, onUserDictionaryLoad, isLoading, user }) => {
  const [activeTab, setActiveTab] = useState<Tab>('built-in');

  const handleLocalFileSelect = (file: File) => {
    // Use filename as the dictionary name, removing the extension
    const dictionaryName = file.name.endsWith('.xlsx') ? file.name.slice(0, -5) : file.name;
    onFilesSelect(dictionaryName, file);
  };

  const handleBuiltInSelect = (name: string, wordsFile: File, sentencesFile?: File) => {
    onFilesSelect(name, wordsFile, sentencesFile);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select File Source">
      <div className="flex border-b border-slate-700">
        <TabButton activeTab={activeTab} tab="built-in" onClick={setActiveTab}><Library size={16} /> Built-in</TabButton>
        <TabButton activeTab={activeTab} tab="computer" onClick={setActiveTab}><Upload size={16} /> From Computer</TabButton>
        {user && (
           <TabButton activeTab={activeTab} tab="user" onClick={setActiveTab}><UserIcon size={16} /> My Dictionaries</TabButton>
        )}
      </div>
      <div className="pt-6">
        {activeTab === 'built-in' && (
          <BuiltInDictionaries onSelect={handleBuiltInSelect} />
        )}
        {activeTab === 'computer' && (
          <FileUpload onFileUpload={handleLocalFileSelect} isLoading={isLoading} />
        )}
        {activeTab === 'user' && user && (
          <UserDictionaries user={user} onLoad={onUserDictionaryLoad} onCloseModal={onClose} />
        )}
      </div>
    </Modal>
  );
};