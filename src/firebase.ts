import {initializeApp} from 'firebase/app';
import {getAuth} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';

// Public Firebase Web App configuration provided for Spark Edu.
// These values are not administrator credentials. Firestore security rules
// enforce authorization on the server. Vercel VITE_* values override defaults.
const defaults = {
  apiKey: 'AIzaSyA3VWp8Lpn_dzRQisgQ0yHsH1ndENRd8PY',
  authDomain: 'speak-d6e7f.firebaseapp.com',
  projectId: 'speak-d6e7f',
  storageBucket: 'speak-d6e7f.firebasestorage.app',
  messagingSenderId: '624210314657',
  appId: '1:624210314657:web:2b87f5851044d04fb',
};

export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaults.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaults.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaults.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaults.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaults.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaults.appId,
});
export const auth = getAuth(app);
export const db = getFirestore(app);
