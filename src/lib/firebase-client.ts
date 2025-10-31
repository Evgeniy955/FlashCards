
// Ensured import for Firebase v9+ SDK.
// Fix: Use '-exp' suffix for imports, as this project appears to be using an early version of Firebase v9 (e.g., 9.0.0) where modular APIs were experimental.
import { initializeApp } from 'firebase/app-exp';
import { getAuth } from 'firebase/auth-exp';
import { getFirestore } from 'firebase/firestore-exp';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get auth and firestore instances
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };