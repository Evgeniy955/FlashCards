import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase with the modern v9+ API
const app = initializeApp(firebaseConfig);

// Get auth and firestore instances using the v9+ modular functions
const auth = getAuth(app);
const db = getFirestore(app);
// Explicitly provide the storage bucket URL to getStorage to prevent ambiguity.
const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);

export { auth, db, storage };
