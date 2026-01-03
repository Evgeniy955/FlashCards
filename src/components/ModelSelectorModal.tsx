
import React from 'react';
import { Modal } from './Modal';
import { Cpu, CheckCircle2 } from 'lucide-react';

interface ModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  availableModels: { id: string; name: string }[];
}

export const ModelSelectorModal: React.FC<ModelSelectorModalProps> = ({
  isOpen,
  onClose,
  currentModel,
  onSelectModel,
  availableModels,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select AI Model">
      <div className="text-slate-600 dark:text-slate-300 max-h-[70vh] flex flex-col">
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          Choose a Gemini model for generating example sentences and validating answers. Different models may have varying capabilities and cost implications.
        </p>
        <ul className="space-y-3">
          {availableModels.map((model) => (
            <li key={model.id}>
              <button
                onClick={() => onSelectModel(model.id)}
                className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  currentModel === model.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Cpu size={20} className="flex-shrink-0" />
                  <span className="font-semibold">{model.name}</span>
                </div>
                {currentModel === model.id && <CheckCircle2 size={20} className="text-indigo-600 dark:text-indigo-400" />}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            Note: "Flash" models are generally faster and cheaper. "Pro" models are more capable but may incur higher costs or have stricter rate limits.
            Please refer to the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Gemini API billing documentation</a> for details.
        </p>
      </div>
    </Modal>
  );
};
