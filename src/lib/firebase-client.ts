import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// FIX: Switched to Firebase compat API for Firestore to resolve module loading errors.
// This uses the v8 API surface for database operations.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { firebaseConfig } from '../firebase-config';

// Initialize modular app for Auth (required by react-firebase-hooks)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Initialize compat app for Firestore
// Check if it's already initialized to prevent errors.
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

export { auth, db, firebase };
