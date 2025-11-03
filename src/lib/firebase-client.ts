// FIX: Corrected Firebase initialization to use named import for `initializeApp` as required by the modular SDK.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Get services
const auth = getAuth(app);
const db = getFirestore(app);

// Explicitly pass the storage bucket URL to prevent initialization issues.
// The URL must be in the format gs://<bucket-name>
const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);


export { auth, db, storage };