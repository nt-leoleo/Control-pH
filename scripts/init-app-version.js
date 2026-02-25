// Script para inicializar la versión de la app en Firebase
// Ejecutar con: node scripts/init-app-version.js

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyConw7QnmXL23KMl7fdHBeWM3LBKJNbJH0',
  authDomain: 'control-ph-82951.firebaseapp.com',
  databaseURL: 'https://control-ph-82951-default-rtdb.firebaseio.com',
  projectId: 'control-ph-82951',
  storageBucket: 'control-ph-82951.firebasestorage.app',
  messagingSenderId: '102545501878',
  appId: '1:102545501878:web:3bccaf5edcba28b6990017',
  measurementId: 'G-M7VSKSPSJV'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initAppVersion() {
  try {
    const versionData = {
      version: '4.9.1',
      updateUrl: 'https://controlpileta.vercel.app',
      forceUpdate: false,
      releaseNotes: 'Versión inicial del sistema de actualizaciones automáticas',
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'appConfig', 'version'), versionData);
    console.log('✅ Versión de app inicializada en Firebase:', versionData);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar versión:', error);
    process.exit(1);
  }
}

initAppVersion();
