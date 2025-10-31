// Fix: Use named import for firebase/app to address the module export error with modular SDK.
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