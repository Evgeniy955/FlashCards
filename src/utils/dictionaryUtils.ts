import * as XLSX from 'xlsx';
import type { Word, WordSet, LoadedDictionary } from '../types';

const MAX_SET_SIZE = 30;

export const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

// A more robust way to uniquely identify a word pair
export const getWordId = (word: Word): string => {
    return `${word.lang1}|${word.lang2}`;
};

const extractWordsFromColumns = (jsonData: (string | null)[][], col1: number, col2: number): Word[] => {
    const words: Word[] = [];
    // Skip the header row by starting at index 1
    for (let i = 1; i < jsonData.length; i++) {
        const rowData = jsonData[i];
        const lang1Word = rowData?.[col1];
        const lang2Word = rowData?.[col2];
        if (lang1Word && lang2Word) {
            words.push({ lang1: String(lang1Word).trim(), lang2: String(lang2Word).trim() });
        }
    }
    return words;
};

const splitIntoSubsets = (words: Word[], baseSetName: string, originalSetIndex: number, lang1: string, lang2: string): WordSet[] => {
    if (words.length <= MAX_SET_SIZE) {
        return [{ name: baseSetName, words, originalSetIndex, lang1, lang2 }];
    }
    
    const subsets: WordSet[] = [];
    for (let i = 0; i < words.length; i += MAX_SET_SIZE) {
        const chunk = words.slice(i, i + MAX_SET_SIZE);
        subsets.push({
            name: `${baseSetName} (${i + 1}-${i + chunk.length})`,
            words: chunk,
            originalSetIndex,
            lang1,
            lang2,
        });
    }

    if (subsets.length === 1 && subsets[0].words.length === words.length) {
        return [{ name: baseSetName, words, originalSetIndex, lang1, lang2 }];
    }

    return subsets;
};

export const parseDictionaryFile = async (file: File): Promise<LoadedDictionary> => {
    try {
        const buffer = await file.arrayBuffer();
        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: (string | null)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (!jsonData || jsonData.length < 1) { // Needs at least one row (header or data)
            throw new Error("The file is empty or in an incorrect format.");
        }

        const allSets: WordSet[] = [];
        let originalSetIndexCounter = 0;
        const maxCols = jsonData[0]?.length || 0;
        
        // Check if the first row looks like a header (i.e., contains non-empty strings)
        const hasHeader = jsonData[0]?.some(cell => typeof cell === 'string' && cell.trim() !== '');

        for (let col = 0; col < maxCols; col += 4) {
             // Default language names if no header is found
            let lang1 = `Language ${String.fromCharCode(65 + col)}`; // Language A, E, etc.
            let lang2 = `Language ${String.fromCharCode(65 + col + 2)}`; // Language C, G, etc.

            if (hasHeader && jsonData[0]) {
                 lang1 = String(jsonData[0][col] || lang1).trim();
                 lang2 = String(jsonData[0][col + 2] || lang2).trim();
            }

            const dataToParse = hasHeader ? jsonData.slice(1) : jsonData;

            const words: Word[] = [];
            for (const rowData of dataToParse) {
                const lang1Word = rowData?.[col];
                const lang2Word = rowData?.[col + 2];
                if (lang1Word && lang2Word) {
                    words.push({ lang1: String(lang1Word).trim(), lang2: String(lang2Word).trim() });
                }
            }
            
            if (words.length > 0) {
                const baseSetName = `Set ${originalSetIndexCounter + 1}`;
                const subsets = splitIntoSubsets(words, baseSetName, originalSetIndexCounter, lang1, lang2);
                allSets.push(...subsets);
                originalSetIndexCounter++;
            }
        }
        
        if (allSets.length === 0) {
            throw new Error("No valid word sets found. Ensure columns A/C, E/G, etc., contain words, optionally with a header in the first row.");
        }
        return { name: file.name, sets: allSets };
    } catch (err) {
        console.error("Parsing error:", err);
        throw err instanceof Error ? err : new Error('Failed to parse the dictionary file.');
    }
};
