import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase with the standard v9 modular function
// FIX: The `initializeApp` function should be imported directly from "firebase/app" for the Firebase v9 modular SDK, not accessed via a namespace import.
const app = initializeApp(firebaseConfig);

// Get services
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };