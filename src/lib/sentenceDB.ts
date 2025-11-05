
const DB_NAME = 'flashcard-sentences-db';
const STORE_NAME = 'userSentences';
const DB_VERSION = 1;

interface StoredSentences {
  id: 'local' | string; // 'local' for anonymous, UID for logged-in users
  sentences: { [key: string]: string };
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(new Error('Failed to open IndexedDB for sentences.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveSentences = async (id: 'local' | string, sentences: Map<string, string>): Promise<void> => {
    const db = await openDB();
    const sentencesObject = Object.fromEntries(sentences);
    const dataToStore: StoredSentences = { id, sentences: sentencesObject };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(dataToStore);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const loadSentences = async (id: 'local' | string): Promise<Map<string, string>> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => {
            const result = request.result as StoredSentences | undefined;
            if (result && result.sentences) {
                resolve(new Map(Object.entries(result.sentences)));
            } else {
                resolve(new Map()); // Return an empty map if no sentences are found
            }
        };
        request.onerror = () => reject(request.error);
    });
};

export const deleteSentences = async (id: 'local' | string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
