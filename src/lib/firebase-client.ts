// FIX: Switched to namespace imports for firebase/app and firebase/auth to resolve issues where named exports could not be found, likely due to a build configuration or dependency issue. This is a more robust way of importing from these modules.
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