// FIX: Switched to namespace imports for 'firebase/app' and 'firebase/auth' to resolve build errors where named exports were not found.
import * as firebaseApp from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase using the v9+ modular approach
const app = firebaseApp.initializeApp(firebaseConfig);

// Get auth and firestore instances
const auth = firebaseAuth.getAuth(app);
const db = getFirestore(app);

export { app, auth, db };