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