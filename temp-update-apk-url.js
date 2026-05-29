#!/usr/bin/env node

/**
 * Script para crear un endpoint HTTP que sirve el APK con headers correctos
 * Se agrega como Cloud Function rewriteable
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
});

const db = admin.firestore();

async function updateApkUrl() {
  try {
    const newUrl = 'https://github.com/user/repo/releases/download/v5.1.7/app-release-v5.1.7.apk';
    
    console.log('Actualizar apkUrl en Firestore...');
    await db.collection('app-versions').doc('latest').update({
      apkUrl: newUrl,
      note: 'APK hosted externally due to Firebase Hosting size limitations'
    });
    
    console.log('✅ apkUrl actualizada a:',newUrl);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

updateApkUrl();
