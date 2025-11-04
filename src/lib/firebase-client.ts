import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase using the compatibility library
const app = firebase.initializeApp(firebaseConfig);

// Get services
// FIX: Use v8 compat auth to solve import errors.
const auth = firebase.auth();
// Use v9 modular firestore, which is used throughout the app.
const db = getFirestore(app);

export { auth, db };
