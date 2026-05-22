/**
 * Configura la estructura de versiones en Firestore sin pisar la release vigente.
 * Ejecutar una sola vez o durante deploy: node scripts/setup-app-versions.js
 */

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(__dirname, 'firebase-admin-key.json');

try {
  if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: 'https://control-ph-82951-default-rtdb.firebaseio.com',
      projectId: 'control-ph-82951',
    });
  } else {
    admin.initializeApp();
  }
} catch (error) {
  console.error('No se pudo inicializar Firebase Admin:', error);
  process.exit(1);
}

const db = admin.firestore();

async function setupAppVersions() {
  try {
    console.log('Configurando coleccion app-versions en Firestore...\n');

    const latestRef = db.collection('app-versions').doc('latest');
    const latestDoc = await latestRef.get();

    if (!latestDoc.exists) {
      const latestVersionData = {
        version: '0.0.0',
        apkUrl: '',
        url: '',
        zipUrl: '',
        changelog: 'Configura apkUrl/url y zipUrl para publicar la primera version.',
        mandatory: false,
        releaseDate: admin.firestore.Timestamp.now(),
        isActive: false,
        minVersion: '0.0.0',
        supportedPlatforms: ['android'],
        notes: 'Documento inicial. No se sobrescribe automaticamente en deploys futuros.',
      };

      await latestRef.set(latestVersionData, { merge: true });
      await db.collection('app-versions').doc('v0.0.0').set({
        ...latestVersionData,
        createdAt: admin.firestore.Timestamp.now(),
        downloads: 0,
        rolloutPercentage: 0,
      }, { merge: true });

      console.log('Documento "latest" inicial creado.');
    } else {
      console.log('Documento "latest" ya existe; no se sobrescribe version, apkUrl ni zipUrl.');
    }

    const appConfigData = {
      updateCheckInterval: 3600000,
      forceUpdateVersion: null,
      maintenanceMode: false,
      maintenanceMessage: 'Sistema en mantenimiento. Volvemos en breve.',
      analyticsEnabled: true,
    };

    await db.collection('app-config').doc('settings').set(appConfigData, { merge: true });
    console.log('Documento "settings" creado/actualizado en app-config.');

    console.log('\nConfiguracion de Firestore completada.');
    console.log('   - app-versions/latest: version publicada');
    console.log('   - app-config/settings: configuracion global');
    console.log('   - update-logs: analytics de descargas\n');

    process.exit(0);
  } catch (error) {
    console.error('Error configurando Firestore:', error);
    process.exit(1);
  }
}

setupAppVersions();
