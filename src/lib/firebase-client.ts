// The correct import for the Firebase v9+ modular SDK
// FIX: Using a namespace import to address potential module resolution issues.
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