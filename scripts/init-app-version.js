// Script para inicializar la versión de la app en Firebase
// Ejecutar con: node scripts/init-app-version.js

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { config } from '../src/firebase.js';

const app = initializeApp(config);
const db = getFirestore(app);

async function initAppVersion() {
  try {
    const versionData = {
      version: '4.8.7',
      updateUrl: 'https://control-ph-web.vercel.app', // URL de tu app en Vercel
      forceUpdate: false,
      releaseNotes: 'Versión inicial del sistema de actualizaciones automáticas',
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'appConfig', 'version'), versionData);
    console.log('✅ Versión de app inicializada en Firebase:', versionData);
  } catch (error) {
    console.error('❌ Error al inicializar versión:', error);
  }
}

initAppVersion();
