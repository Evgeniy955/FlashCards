import { fileToBase64, base64ToFile } from '../utils/fileUtils';

const DB_NAME = 'flashcard-dictionaries-db';
const STORE_NAME = 'dictionaries';
const DB_VERSION = 3; // Version 2 had 'name' as key. Version 3 uses a user-scoped 'id'.

// The object structure stored in IndexedDB
export interface StoredDictionaryObject {
    id: string; // The keyPath, e.g., "uid_MyList" or "local_MyList"
    userId?: string; // The UID of the user, or undefined for local-only/anonymous dictionaries
    name: string; // The base name for display, e.g., "MyList"
    fileName: string; // The full original filename, e.g., "MyList.xlsx"
    mimeType: string;
    content: string; // base64 encoded file content
    lastModified: number; // timestamp
    isBuiltIn?: boolean;
}


// The convenient structure returned to the app
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
      // If the object store exists, it's from an old schema. Delete and recreate.
      if (db.objectStoreNames.contains(STORE_NAME)) {
        db.deleteObjectStore(STORE_NAME);
      }
      // Create new store with 'id' as keyPath and an index on 'userId' for efficient querying.
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('by_userId', 'userId', { unique: false });
    };
  });
};

export const saveDictionary = async (name: string, file: File, userId?: string | null, isBuiltIn: boolean = false): Promise<void> => {
    const db = await openDB();
    const base64Content = await fileToBase64(file);
    const id = (userId || 'local') + `_${name}`; // e.g., "uid123_MyList" or "local_MyList"

    const objectToStore: StoredDictionaryObject = {
        id,
        userId: userId || undefined,
        name,
        fileName: file.name,
        mimeType: file.type,
        content: base64Content,
        lastModified: file.lastModified,
        isBuiltIn,
    };

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(objectToStore);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getDictionaries = async (userId?: string | null): Promise<string[]> => {
    const details = await getAllDictionaryDetails(userId);
    return details.map(d => d.name);
};

export const getAllDictionaryDetails = async (userId?: string | null): Promise<StoredDictionaryObject[]> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('by_userId');
        const query = index.getAll(userId || undefined); // Query for the specific UID, or `undefined` for local-only dictionaries

        query.onsuccess = () => {
            resolve(query.result as StoredDictionaryObject[]);
        };
        query.onerror = () => {
            reject(query.error);
        };
    });
};

export const getDictionary = async (name: string, userId?: string | null): Promise<StoredDictionary | undefined> => {
    const db = await openDB();
    const id = (userId || 'local') + `_${name}`;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = () => {
            const result = request.result as StoredDictionaryObject | undefined;
            if (result) {
                const file = base64ToFile(result.content, result.fileName, result.mimeType);
                resolve({ name: result.name, file });
            } else {
                resolve(undefined);
            }
        };
        request.onerror = () => reject(request.error);
    });
};

export const deleteDictionary = async (name: string, userId?: string | null): Promise<void> => {
    const db = await openDB();
    const id = (userId || 'local') + `_${name}`;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        transaction.onerror = () => reject(transaction.error);
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};