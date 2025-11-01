import * as XLSX from 'xlsx';
import type { Word, WordSet, LoadedDictionary } from '../types';

const MAX_SET_SIZE = 30;

export const parseDictionaryFile = async (file: File): Promise<LoadedDictionary> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData: (string | null)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  const sets: WordSet[] = [];
  let originalSetIndex = 0;

  if (jsonData.length === 0) {
    throw new Error('The file is empty or in an unsupported format.');
  }

  // Process sets starting from columns A, E, I, ... (0, 4, 8, ...)
  for (let col = 0; col < (jsonData[0]?.length || 0); col += 4) {
    const currentWords: Word[] = [];
    let setName: string | null = null;
    
    // Attempt to find a set name in the first row of the current set's columns
    if (jsonData[0] && jsonData[0][col]) {
      const headerCandidate = String(jsonData[0][col]).trim();
      // Heuristic: if the first cell doesn't have a matching translation cell, it might be a header.
      if (headerCandidate && !jsonData[0][col + 2]) {
        setName = headerCandidate;
      }
    }

    for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row) continue;
        
        const ru = row[col] ? String(row[col]).trim() : '';
        const en = row[col + 2] ? String(row[col + 2]).trim() : '';

        // If this row was the header, skip it.
        if (i === 0 && setName && ru === setName) {
            continue;
        }

        if (ru && en) {
            currentWords.push({ ru, en });
        }
    }


    if (currentWords.length > 0) {
      const baseSetName = setName || `Set ${originalSetIndex + 1}`;
      if (currentWords.length > MAX_SET_SIZE) {
        for (let i = 0; i < currentWords.length; i += MAX_SET_SIZE) {
          const chunk = currentWords.slice(i, i + MAX_SET_SIZE);
          const part = i / MAX_SET_SIZE + 1;
          sets.push({
            name: `${baseSetName} (Part ${part})`,
            words: chunk,
            originalSetIndex,
          });
        }
      } else {
        sets.push({
          name: baseSetName,
          words: currentWords,
          originalSetIndex,
        });
      }
      originalSetIndex++;
    }
  }

  if (sets.length === 0) {
    throw new Error('No valid word sets found in the file. Please check the file structure (Column A: word, Column C: translation).');
  }
  
  const dictionaryName = file.name.endsWith('.xlsx') ? file.name.slice(0, -5) : file.name;

  return { name: dictionaryName, sets };
};
