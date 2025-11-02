import { LoadedDictionary } from '../types';

const DB_NAME = 'flashcard-local-db';
const DB_VERSION = 1;
const DICTIONARY_STORE_NAME = 'dictionaries';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
        reject('IndexedDB not supported');
        return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DICTIONARY_STORE_NAME)) {
        db.createObjectStore(DICTIONARY_STORE_NAME, { keyPath: 'name' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject('Error opening IndexedDB: ' + (event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function saveDictionaryLocally(dictionary: LoadedDictionary): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DICTIONARY_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(DICTIONARY_STORE_NAME);
    const request = store.put(dictionary);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject('Error saving dictionary: ' + request.error);
    transaction.oncomplete = () => db.close();
  });
}

export async function getLocalDictionaries(): Promise<LoadedDictionary[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DICTIONARY_STORE_NAME, 'readonly');
        const store = transaction.objectStore(DICTIONARY_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject('Error fetching dictionaries: ' + request.error);
        transaction.oncomplete = () => db.close();
    });
}

export async function deleteDictionaryLocally(name: string): Promise<void> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(DICTIONARY_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(DICTIONARY_STORE_NAME);
        const request = store.delete(name);

        request.onsuccess = () => resolve();
        request.onerror = () => reject('Error deleting dictionary: ' + request.error);
        transaction.oncomplete = () => db.close();
    });
}
