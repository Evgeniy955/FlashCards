import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase using the modular v9+ SDK
const app = initializeApp(firebaseConfig);

// Get modular services
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };