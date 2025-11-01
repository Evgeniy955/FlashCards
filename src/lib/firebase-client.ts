// FIX: Changed to a namespace import to resolve an issue where 'initializeApp' was not found as a named export.
import * as firebaseApp from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
const app = firebaseApp.initializeApp(firebaseConfig);

// Get auth and firestore instances using v9+ style
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };