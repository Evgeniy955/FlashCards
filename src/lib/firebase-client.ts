// FIX: The original named import `import { initializeApp } from 'firebase/app'` was causing a module resolution error.
// Using a namespace import (`* as firebaseApp`) is a robust alternative that often resolves such issues in complex build environments.
import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
const app = firebaseApp.initializeApp(firebaseConfig);

// Get auth and firestore instances
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
