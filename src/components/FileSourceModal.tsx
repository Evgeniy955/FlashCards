import React, { useState } from 'react';
import { Modal } from './Modal';
import { BuiltInDictionaries } from './BuiltInDictionaries';
import { FileUp, BookMarked } from 'lucide-react';

interface FileSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (file: File) => void;
  onBuiltInSelect: (path: string, sentencesPath?: string) => void;
  isLoading: boolean;
}

export const FileSourceModal: React.FC<FileSourceModalProps> = ({ isOpen, onClose, onFileSelect, onBuiltInSelect, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'builtin' | 'upload'>('builtin');

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
     // Reset input value to allow re-uploading the same file
    if (event.target) {
        event.target.value = '';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose Word Source">
      <div>
        <div className="flex border-b border-slate-700 mb-6">
          <button
            onClick={() => setActiveTab('builtin')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${activeTab === 'builtin' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}
          >
            <BookMarked size={16} /> Built-in Dictionaries
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${activeTab === 'upload' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-white'}`}
          >
            <FileUp size={16} /> From Computer
          </button>
        </div>
        
        {activeTab === 'builtin' && (
          <BuiltInDictionaries onSelect={onBuiltInSelect} isLoading={isLoading} />
        )}
        
        {activeTab === 'upload' && (
          <div className="text-center">
            <p className="text-slate-400 mb-6">Upload your own dictionary file in .xlsx format. See instructions for the required column structure.</p>
            <label
              htmlFor="local-file-upload"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg cursor-pointer transition-colors inline-flex items-center gap-2"
            >
              <FileUp size={18} /> Select Excel File
            </label>
            <input id="local-file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={isLoading} />
            {isLoading && <p className="mt-4 text-indigo-400 animate-pulse">Processing...</p>}
          </div>
        )}
      </div>
    </Modal>
  );
};