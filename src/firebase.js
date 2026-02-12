import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';

// Tu configuración de Firebase (reemplazar con la tuya)
const firebaseConfig = {
  apiKey: "AIzaSyConw7QnmXL23KMl7fdHBeWM3LBKJNbJH0",
  authDomain: "control-ph-82951.firebaseapp.com",
  databaseURL: "https://control-ph-82951-default-rtdb.firebaseio.com",
  projectId: "control-ph-82951",
  storageBucket: "control-ph-82951.firebasestorage.app",
  messagingSenderId: "102545501878",
  appId: "1:102545501878:web:3bccaf5edcba28b6990017",
  measurementId: "G-M7VSKSPSJV"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Servicios
export const auth = getAuth(app);
export const db = getFirestore(app);
export const database = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

// Configuración adicional para Google Auth
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export default app;