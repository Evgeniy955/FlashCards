import * as XLSX from 'xlsx';
import type { Word, WordSet, LoadedDictionary } from '../types';

const MAX_SET_SIZE = 30;

export const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

const extractWordsFromColumns = (jsonData: (string | null)[][], ruCol: number, enCol: number): Word[] => {
    const words: Word[] = [];
    for (const rowData of jsonData) {
        const ru = rowData?.[ruCol];
        const en = rowData?.[enCol];
        if (ru && en) {
            words.push({ ru: String(ru).trim(), en: String(en).trim() });
        }
    }
    return words;
};

const splitIntoSubsets = (words: Word[], baseSetName: string, originalSetIndex: number, originalJsonData: (string | null)[][]): WordSet[] => {
    if (words.length <= MAX_SET_SIZE) {
        // Count non-empty rows for the current set in the original data
        const originalSetWordCount = originalJsonData.filter(row => row?.[originalSetIndex * 4] && row?.[originalSetIndex * 4 + 2]).length;
        // If there's only one set, it's small, and it matches the original count, don't add a range to the name.
        if (words.length < MAX_SET_SIZE && words.length === originalSetWordCount) {
             return [{ name: baseSetName, words, originalSetIndex }];
        }
    }
    
    const subsets: WordSet[] = [];
    for (let i = 0; i < words.length; i += MAX_SET_SIZE) {
        const chunk = words.slice(i, i + MAX_SET_SIZE);
        subsets.push({
            name: `${baseSetName} (${i + 1}-${i + chunk.length})`,
            words: chunk,
            originalSetIndex,
        });
    }

    // If splitting results in a single subset that contains all original words, just use the base name.
    if (subsets.length === 1 && subsets[0].words.length === words.length) {
        return [{ name: baseSetName, words, originalSetIndex }];
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

        if (!jsonData || jsonData.length === 0) {
            throw new Error("The file is empty or in an incorrect format.");
        }

        const allSets: WordSet[] = [];
        let originalSetIndexCounter = 0;
        const maxCols = jsonData[0]?.length || 0;

        for (let col = 0; col < maxCols; col += 4) {
            const words = extractWordsFromColumns(jsonData, col, col + 2);

            if (words.length > 0) {
                const baseSetName = `Set ${originalSetIndexCounter + 1}`;
                const subsets = splitIntoSubsets(words, baseSetName, originalSetIndexCounter, jsonData);
                allSets.push(...subsets);
                originalSetIndexCounter++;
            }
        }
        
        if (allSets.length === 0) {
            throw new Error("No valid word sets found. Ensure columns A/C, E/G, etc., contain words.");
        }
        return { name: file.name, sets: allSets };
    } catch (err) {
        console.error("Parsing error:", err);
        throw err instanceof Error ? err : new Error('Failed to parse the dictionary file.');
    }
};
