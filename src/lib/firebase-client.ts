// FIX: The namespace import `* as firebaseApp` was incorrect and caused a type error.
// Switched to a named import for `initializeApp` as is standard for the Firebase v9+ modular SDK.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get auth and firestore instances
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };