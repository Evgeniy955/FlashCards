// FIX: The import for `initializeApp` was using a namespace import (`* as firebaseApp`),
// but `initializeApp` is a named export. The code has been updated to use a
// named import (`{ initializeApp }`) and call the function directly.
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
