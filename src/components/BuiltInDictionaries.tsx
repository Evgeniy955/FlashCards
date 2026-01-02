
import React, { useState } from 'react';
import { BookMarked, Loader2 } from 'lucide-react';

interface BuiltInDictionariesProps {
    onSelect: (name: string, wordsFile: File) => void;
}

// Removed sentencesPath to rely solely on AI-generated content.
const dictionaries = [
    { name: 'Food', wordsPath: '/dictionaries/Food.xlsx' },
    { name: 'List 1', wordsPath: '/dictionaries/List1.xlsx' },
    { name: 'List 2', wordsPath: '/dictionaries/List2.xlsx' },
    { name: 'List 3', wordsPath: '/dictionaries/List3.xlsx' },
    { name: 'List 4', wordsPath: '/dictionaries/List4.xlsx' },
    { name: 'List 5', wordsPath: '/dictionaries/List5.xlsx' },
    { name: 'List 6', wordsPath: '/dictionaries/List6.xlsx' },
    { name: 'List 7', wordsPath: '/dictionaries/List7.xlsx' },
    { name: 'List 8', wordsPath: '/dictionaries/List8.xlsx' },
];

export const BuiltInDictionaries: React.FC<BuiltInDictionariesProps> = ({ onSelect }) => {
    const [isDownloading, setIsDownloading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSelect = async (dict: typeof dictionaries[0]) => {
        setIsDownloading(dict.name);
        setError(null);
        try {
            // Fetch the main words file
            const wordsResponse = await fetch(dict.wordsPath);
            if (!wordsResponse.ok) throw new Error(`Could not load ${dict.wordsPath}. Status: ${wordsResponse.status}`);
            const wordsBlob = await wordsResponse.blob();
            const wordsFile = new File([wordsBlob], dict.wordsPath.split('/').pop()!, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

            onSelect(dict.name, wordsFile);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsDownloading(null);
        }
    };

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a pre-packaged dictionary:</h3>
            <ul className="max-h-64 overflow-y-auto space-y-2 pr-2">
                {dictionaries.map(dict => (
                    <li key={dict.name}>
                        <button
                            onClick={() => handleSelect(dict)}
                            disabled={!!isDownloading}
                            className="w-full flex items-center gap-3 p-3 text-left text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition-colors disabled:opacity-50"
                        >
                            {isDownloading === dict.name ? (
                                <Loader2 className="animate-spin h-5 w-5 flex-shrink-0" />
                            ) : (
                                <BookMarked className="h-5 w-5 flex-shrink-0" />
                            )}
                            <span className="flex-grow">{dict.name}</span>
                        </button>
                    </li>
                ))}
            </ul>
            {error && <p className="mt-2 text-xs text-red-400 text-center">{error}</p>}
        </div>
    );
};
