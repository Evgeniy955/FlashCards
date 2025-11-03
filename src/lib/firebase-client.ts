// FIX: The original import for `initializeApp` was causing an error. This has been corrected to align with Firebase v9+ modular SDK standards.
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
const storage = getStorage(app);

export { auth, db, storage };
