// FIX: The named import for initializeApp was failing. Switched to a namespace
// import (`* as firebaseApp`) as a workaround for a potential module resolution issue.
import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase with the modern v9+ API
const app = firebaseApp.initializeApp(firebaseConfig);

// Get auth and firestore instances using the v9+ modular functions
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
