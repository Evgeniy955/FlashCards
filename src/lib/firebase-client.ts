import * as firebaseApp from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
// FIX: Switched to a namespace import to handle potential module resolution issues that can cause the 'no exported member' error.
const app = firebaseApp.initializeApp(firebaseConfig);

// Get services
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };