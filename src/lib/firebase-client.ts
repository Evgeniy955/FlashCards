// FIX: The import for `initializeApp` was causing an error when using a named
// import. Switched to a namespace import (`* as firebase`) and accessed
// `initializeApp` through it to potentially resolve module resolution issues.
import * as firebase from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Get auth and firestore instances
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };