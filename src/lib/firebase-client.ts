// FIX: Using namespace import for firebase/app to work around a potential module resolution issue.
import * as firebase from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase with the standard v9 modular function
const app = firebase.initializeApp(firebaseConfig);

// Get services
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
