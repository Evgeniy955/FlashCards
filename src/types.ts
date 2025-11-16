export interface Word {
  lang1: string; // Corresponds to the first language (e.g., from column A)
  lang2: string; // Corresponds to the second language (e.g., from column C)
}

export interface WordSet {
  name: string;
  words: Word[];
  originalSetIndex: number; // To keep colors consistent for related sets
  lang1: string; // Name of the first language
  lang2: string; // Name of the second language
}

export interface LoadedDictionary {
  name: string;
  sets: WordSet[];
}

export interface WordProgress {
  srsStage: number;
  nextReviewDate: string; // ISO 8601 date string
}

export interface WordStats {
  knowCount: number;
  totalAttempts: number;
}

export type TranslationMode = 'standard' | 'reverse'; // standard: lang1 -> lang2, reverse: lang2 -> lang1

export type Theme = 'light' | 'dark';