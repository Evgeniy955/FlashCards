import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
// FIX: The original code used a namespace import for Firebase which is incorrect for the v9+ modular SDK.
// `initializeApp` must be imported as a named export from 'firebase/app'.
const app = initializeApp(firebaseConfig);

// Get services
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };