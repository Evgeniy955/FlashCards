// Fix: Changed to a namespace import to resolve potential module resolution issues.
import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase with the modern v9+ API
const app = firebaseApp.initializeApp(firebaseConfig);

// Get auth and firestore instances using the v9+ modular functions
const auth = getAuth(app);
const db = getFirestore(app);
// With the corrected storageBucket in firebaseConfig, we can rely on the default.
const storage = getStorage(app);

export { auth, db, storage };