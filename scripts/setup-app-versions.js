/**
 * Script para configurar la estructura de versiones en Firestore
 * Ejecutar una sola vez: node scripts/setup-app-versions.js
 */

import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar Firebase Admin
const serviceAccountPath = path.join(__dirname, 'firebase-admin-key.json');

try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://control-ph-82951-default-rtdb.firebaseio.com',
    projectId: 'control-ph-82951'
  });
} catch (error) {
  console.error('⚠️ Sin firebase-admin-key.json, usando credenciales por defecto');
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Crear documento de versión actual
 */
async function setupAppVersions() {
  try {
    console.log('📝 Configurando colección app-versions en Firestore...\n');

    // 1. Crear documento "latest" con versión actual
    const latestVersionData = {
      version: '5.0.0',
      url: 'https://control-ph-82951.web.app/dist/',
      changelog: 'Versión inicial con sistema OTA. Incluye: Dashboard, Dosificación, Gráficos, Sincronización en tiempo real',
      mandatory: false,
      releaseDate: admin.firestore.Timestamp.now(),
      isActive: true,
      minVersion: '5.0.0',
      supportedPlatforms: ['android', 'ios', 'web'],
      notes: 'Primera versión con soporte OTA. Los usuarios recibirán esta automáticamente.'
    };

    await db.collection('app-versions').doc('latest').set(latestVersionData, { merge: true });
    console.log('✅ Documento "latest" creado/actualizado');

    // 2. Crear documento "5.0.0" para historial
    const versionHistoryData = {
      ...latestVersionData,
      createdAt: admin.firestore.Timestamp.now(),
      downloads: 0,
      rolloutPercentage: 100
    };

    await db.collection('app-versions').doc('v5.0.0').set(versionHistoryData, { merge: true });
    console.log('✅ Documento "v5.0.0" creado para historial');

    // 3. Crear colección de configuración de app
    const appConfigData = {
      updateCheckInterval: 3600000, // 1 hora en ms
      forceUpdateVersion: null, // null = sin fuerza, '5.0.0' = forzar esta versión
      maintenanceMode: false,
      maintenanceMessage: 'Sistema en mantenimiento. Volvemos en breve.',
      analyticsEnabled: true
    };

    await db.collection('app-config').doc('settings').set(appConfigData, { merge: true });
    console.log('✅ Documento "settings" creado en app-config');

    // 4. Crear colección para rastrear descargas
    console.log('✅ Colección update-logs lista para rastrear descargas');

    console.log('\n✅ ¡Configuración de Firestore completada!\n');
    console.log('📊 Estructura creada:');
    console.log('   • app-versions/latest - Versión actual a descargar');
    console.log('   • app-versions/v5.0.0 - Historial de versión');
    console.log('   • app-config/settings - Configuración global');
    console.log('   • update-logs (vacía) - Rastreará descargas\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error configurando Firestore:', error);
    process.exit(1);
  }
}

setupAppVersions();
