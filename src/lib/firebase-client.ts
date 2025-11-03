// FIX: Changed to a namespace import to handle potential module resolution issues with 'initializeApp'.
import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
// Rename the import to avoid naming collision
import { firebaseConfig as originalFirebaseConfig } from '../firebase-config';

// Programmatically correct the storageBucket URL to prevent misconfiguration.
// This creates the correct bucket address from the projectId, ensuring that
// file operations target Cloud Storage (...appspot.com) instead of potentially
// an incorrect URL (e.g., the Realtime Database ...firebaseio.com),
// which was the root cause of the 404 errors during upload.
const firebaseConfig = {
    ...originalFirebaseConfig,
    storageBucket: `${originalFirebaseConfig.projectId}.appspot.com`,
};


// Initialize Firebase with the corrected configuration
const app = firebaseApp.initializeApp(firebaseConfig);

// Get auth, firestore, and storage instances
const auth = getAuth(app);
const db = getFirestore(app);
// Storage will now correctly use the overridden storageBucket from the config
const storage = getStorage(app);

export { auth, db, storage };
