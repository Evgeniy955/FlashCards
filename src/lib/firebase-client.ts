// FIX: Replaced Firebase v9 modular imports with v8 compat imports to resolve "no exported member" errors. This suggests the project is using an older Firebase SDK version.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
// FIX: Switched to the v8 `firebase.initializeApp()` syntax.
const app = firebase.initializeApp(firebaseConfig);

// Get auth and firestore instances
// FIX: Switched to the v8 `firebase.auth()` and `firebase.firestore()` syntax.
const auth = firebase.auth();
const db = firebase.firestore();

export { app, auth, db };
