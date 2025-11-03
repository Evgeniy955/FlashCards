// FIX: Changed to a namespace import to handle potential module resolution issues with 'initializeApp'.
import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase with the modern v9+ API
const app = firebaseApp.initializeApp(firebaseConfig);

// Get auth and firestore instances
const auth = getAuth(app);
const db = getFirestore(app);

// Explicitly construct the correct storage bucket URL from the project ID.
// This corrects potential misconfigurations where the Realtime Database URL
// might be used instead of the correct Cloud Storage bucket URL, which was
// causing 404 errors on file downloads.
const correctStorageBucket = `gs://${firebaseConfig.projectId}.appspot.com`;
const storage = getStorage(app, correctStorageBucket);

export { auth, db, storage };
