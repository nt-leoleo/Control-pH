import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

const fallbackFirebaseConfig = {
  apiKey: 'AIzaSyConw7QnmXL23KMl7fdHBeWM3LBKJNbJH0',
  authDomain: 'control-ph-82951.firebaseapp.com',
  databaseURL: 'https://control-ph-82951-default-rtdb.firebaseio.com',
  projectId: 'control-ph-82951',
  storageBucket: 'control-ph-82951.firebasestorage.app',
  messagingSenderId: '102545501878',
  appId: '1:102545501878:web:3bccaf5edcba28b6990017',
  measurementId: 'G-M7VSKSPSJV'
};

const envFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const firebaseConfig = {
  apiKey: envFirebaseConfig.apiKey || fallbackFirebaseConfig.apiKey,
  authDomain: envFirebaseConfig.authDomain || fallbackFirebaseConfig.authDomain,
  databaseURL: envFirebaseConfig.databaseURL || fallbackFirebaseConfig.databaseURL,
  projectId: envFirebaseConfig.projectId || fallbackFirebaseConfig.projectId,
  storageBucket: envFirebaseConfig.storageBucket || fallbackFirebaseConfig.storageBucket,
  messagingSenderId: envFirebaseConfig.messagingSenderId || fallbackFirebaseConfig.messagingSenderId,
  appId: envFirebaseConfig.appId || fallbackFirebaseConfig.appId,
  measurementId: envFirebaseConfig.measurementId || fallbackFirebaseConfig.measurementId
};

const missingFirebaseVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_DATABASE_URL',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
].filter((key) => !import.meta.env[key]);

if (missingFirebaseVars.length > 0) {
  console.warn(
    'Firebase env vars faltantes, usando fallback embebido:',
    missingFirebaseVars.join(', ')
  );
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const database = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;
