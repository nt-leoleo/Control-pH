// Script para actualizar la versión en Firebase desde package.json
// Ejecutar con: npm run update-version

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar package.json para obtener la versión
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
);

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

async function updateFirebaseVersion() {
  try {
    const version = packageJson.version;
    
    const versionData = {
      version: version,
      updateUrl: 'https://controlpileta.vercel.app',
      forceUpdate: false,
      releaseNotes: `Versión ${version}`,
      updatedAt: new Date().toISOString(),
    };

    await db.collection('appConfig').doc('version').set(versionData);
    console.log(`✅ Versión ${version} actualizada en Firebase`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al actualizar versión:', error);
    process.exit(1);
  }
}

updateFirebaseVersion();
