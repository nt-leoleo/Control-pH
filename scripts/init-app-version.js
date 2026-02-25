// Script para inicializar la versión de la app en Firebase usando Admin SDK
// Ejecutar con: node scripts/init-app-version.js

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar la clave privada del servicio
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'firebase-admin-key.json'), 'utf8')
);

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://control-ph-82951-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

async function initAppVersion() {
  try {
    const versionData = {
      version: '4.11.7',
      updateUrl: 'https://controlpileta.vercel.app',
      forceUpdate: false,
      releaseNotes: 'Mejoras en el sistema de actualizaciones y ajustes visuales',
      updatedAt: new Date().toISOString(),
    };

    await db.collection('appConfig').doc('version').set(versionData);
    console.log('✅ Versión de app actualizada en Firebase:', versionData);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al actualizar versión:', error);
    process.exit(1);
  }
}

initAppVersion();
