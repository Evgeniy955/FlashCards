// FIX: Switched to Firebase v8 compatibility library to resolve "module has no exported member" errors, which typically occur when using v9 syntax with an older Firebase version.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
// FIX: Corrected import path for firebase-config
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase with the configuration from the dedicated config file.
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();
const auth = firebase.auth();
const db = firebase.firestore();

export { app, auth, db };