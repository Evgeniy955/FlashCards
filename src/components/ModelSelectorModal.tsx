
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
          Choose a Gemini model for generating example sentences and validating answers.
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
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-3">
                    <Cpu size={20} className="flex-shrink-0" />
                    <span className="font-semibold">{model.name}</span>
                  </div>
                  {model.id === 'gemini-flash-lite-latest' && (
                    <span className="ml-8 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      High rate limits, highly efficient, ideal for high volume.
                    </span>
                  )}
                </div>
                {currentModel === model.id && <CheckCircle2 size={20} className="text-indigo-600 dark:text-indigo-400" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
            <p className="text-xs text-blue-800 dark:text-blue-300">
                <strong>Tip for Free Users:</strong> Select <strong>Flash Lite</strong> to enjoy much higher request limits and avoid "Rate limit exceeded" errors during long study sessions.
            </p>
        </div>
        <p className="mt-4 text-[10px] text-slate-500 dark:text-slate-400">
            Please refer to the <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">Gemini API billing documentation</a> for more information on the Free Tier and Pay-as-you-go limits.
        </p>
      </div>
    </Modal>
  );
};
