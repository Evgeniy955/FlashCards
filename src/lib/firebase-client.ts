// FIX: Changed to a namespace import to resolve potential module resolution issues for initializeApp.
import * as firebaseApp from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
const app = firebaseApp.initializeApp(firebaseConfig);

// Get services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };