import { User } from 'firebase/auth';
// FIX: Updated to use Firebase v8 syntax. `ref`, `listAll`, etc. are now methods on the storage instance.
import 'firebase/storage';
import { storage } from './firebase-client';
import { getDictionaries, getDictionary } from './indexedDB';

/**
 * Compares local dictionaries with cloud dictionaries and uploads any that are missing from the cloud.
 * This function is designed to be called on user login or app start to ensure synchronization.
 */
export const syncLocalDictionariesToCloud = async (user: User): Promise<void> => {
    if (!user) return;

    console.log('Starting dictionary sync...');

    try {
        // 1. Get list of remote dictionaries
        // FIX: Use v8 syntax for storage reference.
        const remoteListRef = storage.ref(`user_dictionaries/${user.uid}`);
        // FIX: Use v8 syntax for listing files.
        const remoteFilesResult = await remoteListRef.listAll();
        const remoteNames = new Set(remoteFilesResult.items.map(item => item.name));

        // 2. Get list of local dictionaries
        const localNames = await getDictionaries();

        // 3. Find local dictionaries that are not in the cloud
        for (const localName of localNames) {
            const remoteFileName = `${localName}.xlsx`;
            if (!remoteNames.has(remoteFileName)) {
                console.log(`Syncing "${localName}" to the cloud...`);

                // 4. Get the file from IndexedDB
                const dictionaryData = await getDictionary(localName);
                if (dictionaryData && dictionaryData.file) {
                    
                    // 5. Upload to Firebase Storage
                    // FIX: Use v8 syntax for storage reference.
                    const storageRef = storage.ref(`user_dictionaries/${user.uid}/${remoteFileName}`);
                    // FIX: Use v8 syntax for uploading files (`put` instead of `uploadBytes`).
                    await storageRef.put(dictionaryData.file);
                    console.log(`Successfully synced "${localName}".`);
                }
            }
        }
        console.log('Dictionary sync finished.');
    } catch (error) {
        console.error("Dictionary synchronization failed:", error);
        // We don't throw or alert here to avoid interrupting the user.
        // Syncing is a background process.
    }
};
