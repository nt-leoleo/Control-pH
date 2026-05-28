import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, basename } from 'path';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const fileArgIndex = args.indexOf('--file');
const versionArgIndex = args.indexOf('--version');
const destinationArgIndex = args.indexOf('--destination');
const bucketArgIndex = args.indexOf('--bucket');

const filePath = fileArgIndex >= 0 && args[fileArgIndex + 1] ? args[fileArgIndex + 1] : '../app-release-v5.1.0.apk';
const version = versionArgIndex >= 0 && args[versionArgIndex + 1] ? args[versionArgIndex + 1] : null;
const customDestination = destinationArgIndex >= 0 && args[destinationArgIndex + 1] ? args[destinationArgIndex + 1] : null;
const storageBucket = bucketArgIndex >= 0 && args[bucketArgIndex + 1] ? args[bucketArgIndex + 1] : process.env.FIREBASE_STORAGE_BUCKET || 'control-ph-82951.firebasestorage.app';

const resolvedFilePath = resolve(process.cwd(), filePath);

if (!existsSync(resolvedFilePath)) {
  console.error(`❌ No se encontró el APK en: ${resolvedFilePath}`);
  process.exit(1);
}

const serviceAccountPath = resolve(__dirname, 'firebase-admin-key.json');
if (!existsSync(serviceAccountPath)) {
  console.error(`❌ No se encontró la clave de servicio en: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket,
  projectId: 'control-ph-82951',
});

const db = admin.firestore();
const bucket = admin.storage().bucket();

const fileName = basename(resolvedFilePath);
const destination = customDestination || `apk/${fileName}`;
const token = randomUUID();

async function uploadApk() {
  try {
    console.log(`📤 Subiendo APK a Firebase Storage: ${destination}`);

    await bucket.upload(resolvedFilePath, {
      destination,
      metadata: {
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const encodedPath = encodeURIComponent(destination);
    const apkUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

    console.log(`✅ APK subido a: ${apkUrl}`);
    await updateVersionDocs(apkUrl);
    console.log('🎉 APK publicado y Firestore actualizado.');
  } catch (error) {
    console.error('❌ Error subiendo APK:', error.message || error);
    process.exit(1);
  }
}

async function updateVersionDocs(apkUrl) {
  const latestRef = db.collection('app-versions').doc('latest');
  const latestPayload = { apkUrl, url: apkUrl };
  if (version) latestPayload.version = version;

  await latestRef.set(latestPayload, { merge: true });
  console.log('✅ Se actualizó app-versions/latest.apkUrl');

  if (version) {
    const versionRef = db.collection('app-versions').doc(`v${version}`);
    await versionRef.set({ apkUrl, url: apkUrl, version }, { merge: true });
    console.log(`✅ Se actualizó app-versions/v${version}.apkUrl`);
  }
}

uploadApk();
