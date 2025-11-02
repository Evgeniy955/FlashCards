const DB_NAME = 'flashcard-dictionaries-db';
const STORE_NAME = 'dictionaries';
const DB_VERSION = 1;

export interface StoredDictionary {
  name: string;
  file: File;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(new Error('Failed to open IndexedDB.'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
  });
};

export const saveDictionary = async (name: string, file: File): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ name, file });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getDictionaries = async (): Promise<string[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAllKeys();
        request.onsuccess = () => resolve(request.result as string[]);
        request.onerror = () => reject(request.error);
    });
};

export const getDictionary = async (name: string): Promise<StoredDictionary | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(name);
        request.onsuccess = () => resolve(request.result as StoredDictionary | undefined);
        request.onerror = () => reject(request.error);
    });
};

export const deleteDictionary = async (name: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
