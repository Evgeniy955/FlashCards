// FIX: Updated to use Firebase v8 syntax to match the likely installed package version, resolving the import error for `initializeApp`.
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/storage';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase with the v8 API
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Get auth and firestore instances using the v8 API
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

export { auth, db, storage };
