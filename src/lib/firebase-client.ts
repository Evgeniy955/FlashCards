// FIX: The `import { initializeApp }` was causing a "no exported member" error.
// This is likely due to a misconfiguration in the project's TypeScript or module
// resolution setup. Switching to a namespace import (`* as firebaseApp`) is a
// robust way to access the function that can bypass such issues.
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
