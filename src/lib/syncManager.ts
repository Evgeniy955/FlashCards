import { User } from 'firebase/auth';
import { ref, listAll, uploadBytes } from 'firebase/storage';
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
        const remoteListRef = ref(storage, `user_dictionaries/${user.uid}`);
        const remoteFilesResult = await listAll(remoteListRef);
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
                    const storageRef = ref(storage, `user_dictionaries/${user.uid}/${remoteFileName}`);
                    await uploadBytes(storageRef, dictionaryData.file);
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
