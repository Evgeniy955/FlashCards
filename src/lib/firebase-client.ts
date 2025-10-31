import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import { firebaseConfig } from '../firebase-config';

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get auth and firestore instances using v8 style
const auth = firebase.auth();
const db = firebase.firestore();

export { auth, db };
