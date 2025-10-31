// FIX: Reverted to named imports for 'firebase/app' and 'firebase/auth' as it is the standard for Firebase v9+ and resolves errors where initializeApp and getAuth were not found on the namespace import.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase using the v9+ modular approach
const app = initializeApp(firebaseConfig);

// Get auth and firestore instances
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
