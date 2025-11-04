import React, { useState } from 'react';
import { Modal } from './Modal';
import { BookUser, HelpCircle, BrainCircuit, Library, Trash2 } from 'lucide-react';

interface ProfileStats {
  totalWords: number;
  learnedCount: number;
  dontKnowCount: number;
  remainingCount: number;
  learnedPercentage: number;
  remainingPercentage: number;
  dictionaryCount?: number;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStats: ProfileStats | null;
  allTimeStats: ProfileStats | null;
  dictionaryName: string;
  onResetAllStats: () => void;
}

const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: number | string; total?: number; percentage?: number, color: string }> = ({ icon, title, value, total, percentage, color }) => (
    <div className="bg-slate-100 dark:bg-slate-700/50 p-4 rounded-lg">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${color}`}>
                {icon}
            </div>
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-white">
                    {value}
                    {total !== undefined && <span className="text-sm font-normal text-slate-500 dark:text-slate-400"> / {total}</span>}
                </p>
            </div>
        </div>
        {percentage !== undefined && (
            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2 mt-3">
                <div
                    className={`h-2 rounded-full ${color}`}
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
        )}
    </div>
);

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, currentStats, allTimeStats, dictionaryName, onResetAllStats }) => {
    const [activeTab, setActiveTab] = useState<'current' | 'allTime'>('current');

    const renderCurrentStats = () => {
        if (!currentStats) return <p className="text-center text-slate-500 dark:text-slate-400 py-8">No stats available for the current dictionary.</p>;
        const { totalWords, learnedCount, dontKnowCount, remainingCount, learnedPercentage } = currentStats;
        return (
            <>
                <div className="mb-6 text-center">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Statistics for:</h3>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold text-xl truncate" title={dictionaryName}>{dictionaryName}</p>
                </div>
                <div className="space-y-4">
                    <StatCard icon={<BookUser size={20} className="text-white" />} title="Learned Words" value={learnedCount} total={totalWords} percentage={learnedPercentage} color="bg-emerald-500" />
                    <StatCard icon={<HelpCircle size={20} className="text-white" />} title="Don't Know Words" value={dontKnowCount} total={totalWords} percentage={totalWords > 0 ? (dontKnowCount / totalWords) * 100 : 0} color="bg-rose-500" />
                    <StatCard icon={<BrainCircuit size={20} className="text-white" />} title="Remaining to Learn" value={remainingCount} total={totalWords} percentage={totalWords > 0 ? (remainingCount / totalWords) * 100 : 0} color="bg-sky-500" />
                </div>
            </>
        );
    };

    const renderAllTimeStats = () => {
        if (!allTimeStats) return <p className="text-center text-slate-500 dark:text-slate-400 py-8">No all-time stats available. Start learning to see your progress!</p>;
        const { dictionaryCount, totalWords, learnedCount, dontKnowCount, remainingCount, learnedPercentage } = allTimeStats;
        return (
            <>
                <div className="mb-6 text-center">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white">All-Time Statistics</h3>
                    <p className="text-indigo-600 dark:text-indigo-400 font-bold text-xl">{`Across ${dictionaryCount} Dictionaries`}</p>
                </div>
                <div className="space-y-4">
                    <StatCard icon={<Library size={20} className="text-white" />} title="Dictionaries Studied" value={dictionaryCount ?? 0} color="bg-violet-500" />
                    <StatCard icon={<BookUser size={20} className="text-white" />} title="Total Learned Words" value={learnedCount} total={totalWords} percentage={learnedPercentage} color="bg-emerald-500" />
                    <StatCard icon={<HelpCircle size={20} className="text-white" />} title="Total 'Don't Know'" value={dontKnowCount} total={totalWords} percentage={totalWords > 0 ? (dontKnowCount / totalWords) * 100 : 0} color="bg-rose-500" />
                    <StatCard icon={<BrainCircuit size={20} className="text-white" />} title="Total Remaining" value={remainingCount} total={totalWords} percentage={totalWords > 0 ? (remainingCount / totalWords) * 100 : 0} color="bg-sky-500" />
                </div>
                <div className="mt-8 text-center">
                    <button 
                        onClick={onResetAllStats} 
                        className="flex items-center justify-center gap-2 mx-auto px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/50 hover:bg-rose-200 dark:hover:bg-rose-800/50 rounded-lg transition-colors"
                    >
                        <Trash2 size={16} />
                        Reset All Statistics
                    </button>
                </div>
            </>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Profile & Stats">
            <div className="text-slate-600 dark:text-slate-300">
                {allTimeStats && (
                    <div className="flex justify-center mb-6 p-1 bg-slate-200 dark:bg-slate-900 rounded-lg">
                        <button onClick={() => setActiveTab('current')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'current' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}`}>
                            Current
                        </button>
                        <button onClick={() => setActiveTab('allTime')} className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'allTime' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'}`}>
                            All-Time
                        </button>
                    </div>
                )}
                
                {(!allTimeStats || activeTab === 'current') && renderCurrentStats()}
                {allTimeStats && activeTab === 'allTime' && renderAllTimeStats()}
            </div>
        </Modal>
    );
};