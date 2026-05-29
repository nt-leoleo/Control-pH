#!/usr/bin/env node

/**
 * Script para subir APK a Firebase Storage con configuración correcta para descargas
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializar Firebase
const credentialsPath = path.join(__dirname, 'scripts', 'firebase-admin-key.json');
const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
  // No especificar storageBucket, dejar que Firebase lo configure automáticamente
});

const storage = admin.storage();
const bucket = storage.bucket();
const db = admin.firestore();

async function uploadApkToStorage() {
  try {
    const apkPath = path.join(__dirname, '..', 'app-release-v5.1.7.apk');
    
    if (!fs.existsSync(apkPath)) {
      throw new Error(`APK file not found: ${apkPath}`);
    }

    console.log('📤 Subiendo APK a Firebase Storage...');
    
    const destination = 'apk/app-release-v5.1.7.apk';
    
    // Subir archivo con metadata apropiada
    await bucket.upload(apkPath, {
      destination: destination,
      metadata: {
        contentType: 'application/vnd.android.package-archive',
        cacheControl: 'public, max-age=86400',
        // Esto hace que el navegador descargue en lugar de abrir
        metadata: {
          'Content-Disposition': 'attachment; filename="app-release-v5.1.7.apk"'
        }
      }
    });
    
    console.log('✅ APK subido a Storage');
    
    // Generar URL firmada válida por 7 días
    const file = bucket.file(destination);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 días
      responseDisposition: 'attachment; filename="app-release-v5.1.7.apk"'
    });
    
    console.log('🔗 URL firmada generada (válida por 7 días)');
    
    // Actualizar Firestore con esta URL
    await db.collection('app-versions').doc('latest').update({
      apkUrl: signedUrl,
      apkStoragePath: destination,
      apkUploadedAt: new Date()
    });
    
    console.log('✅ Firestore actualizado con URL de Storage');
    console.log(`📍 APK URL: ${signedUrl.substring(0, 80)}...`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

uploadApkToStorage();
