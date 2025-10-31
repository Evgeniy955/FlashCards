// FIX: Use v8 compat layer for app and auth to resolve module export errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Get auth and firestore instances
const auth = firebase.auth();
const db = getFirestore(app);

export { app, auth, db };
