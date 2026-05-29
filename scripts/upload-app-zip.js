import admin from 'firebase-admin';
import { readFileSync, existsSync, copyFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, basename } from 'path';
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const fileArgIndex = args.indexOf('--file');
const versionArgIndex = args.indexOf('--version');
const destinationArgIndex = args.indexOf('--destination');
const bucketArgIndex = args.indexOf('--bucket');
const typeArgIndex = args.indexOf('--type');

const filePath = fileArgIndex >= 0 && args[fileArgIndex + 1] ? args[fileArgIndex + 1] : '../update-v5.1.0.zip';
const version = versionArgIndex >= 0 && args[versionArgIndex + 1] ? args[versionArgIndex + 1] : null;
const customDestination = destinationArgIndex >= 0 && args[destinationArgIndex + 1] ? args[destinationArgIndex + 1] : null;
const storageBucket = bucketArgIndex >= 0 && args[bucketArgIndex + 1] ? args[bucketArgIndex + 1] : process.env.FIREBASE_STORAGE_BUCKET || 'control-ph-82951.firebasestorage.app';
const publishType = typeArgIndex >= 0 && args[typeArgIndex + 1] ? args[typeArgIndex + 1] : 'hosting';
const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const githubRepository = process.env.GITHUB_REPOSITORY || 'nt-leoleo/Control-pH';

const resolvedFilePath = resolve(process.cwd(), filePath);

if (!existsSync(resolvedFilePath)) {
  console.error(`❌ No se encontró el archivo ZIP en: ${resolvedFilePath}`);
  process.exit(1);
}

const serviceAccountPath = resolve(__dirname, 'firebase-admin-key.json');
if (!existsSync(serviceAccountPath)) {
  console.error(`❌ No se encontró la clave de servicio en: ${serviceAccountPath}`);
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

const localFileName = basename(resolvedFilePath);
const destinationPath = customDestination || localFileName;
const hostedUrl = `https://control-ph-82951.web.app/${destinationPath}`;

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket,
  projectId: 'control-ph-82951',
});

console.log(`📍 Usando bucket de Storage: ${storageBucket}`);

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function uploadToGitHub() {
  if (!githubToken) {
    console.error('❌ GITHUB_TOKEN o GH_TOKEN no está configurado.');
    process.exit(1);
  }

  if (!version) {
    console.error('❌ --version es requerido para publicar en GitHub.');
    process.exit(1);
  }

  try {
    const tag = `v${version}`;
    console.log(`📤 Subiendo ZIP a GitHub release ${tag}...`);
    
    // Use gh CLI for simpler, more reliable GitHub interactions
    const fileName = basename(resolvedFilePath);
    const [owner, repo] = githubRepository.split('/');
    
    // Check if release exists and get asset info
    let releaseJson = null;
    try {
      const releaseOutput = execSync(
        `gh release view ${tag} --repo ${owner}/${repo} --json assets`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      releaseJson = JSON.parse(releaseOutput);
    } catch (e) {
      // Release doesn't exist, we'll create it
      console.log(`📝 Creando release ${tag}...`);
    }

    // Delete existing asset if present
    if (releaseJson?.assets && releaseJson.assets.length > 0) {
      const existingAsset = releaseJson.assets.find(a => a.name === fileName);
      if (existingAsset) {
        console.log(`🗑️ Eliminando asset existente ${fileName}...`);
        try {
          execSync(
            `gh release delete-asset ${tag} ${fileName} --repo ${owner}/${repo} --yes`,
            { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
          );
        } catch (e) {
          console.warn('⚠️ No se pudo eliminar asset anterior');
        }
      }
    }

    // Create release if it doesn't exist
    if (!releaseJson) {
      execSync(
        `gh release create ${tag} --repo ${owner}/${repo} --title "Update ${tag}" --notes "OTA update package"`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
    }

    // Upload the asset
    execSync(
      `gh release upload ${tag} "${resolvedFilePath}" --repo ${owner}/${repo} --clobber`,
      { encoding: 'utf8' }
    );

    // Get the download URL from the release
    const releaseInfo = JSON.parse(
      execSync(
        `gh release view ${tag} --repo ${owner}/${repo} --json assets`,
        { encoding: 'utf8' }
      )
    );

    const asset = releaseInfo.assets.find(a => a.name === fileName);
    if (!asset) {
      throw new Error('Asset no encontrado después de upload');
    }

    const downloadUrl = asset.browser_download_url || asset.browserDownloadUrl || asset.url;
    if (!downloadUrl) {
      throw new Error('No se pudo obtener la URL de descarga del asset.');
    }

    console.log(`✅ Archivo subido a: ${downloadUrl}`);

    await updateVersionDocs(downloadUrl);
  } catch (error) {
    console.error('❌ Error subiendo a GitHub:', error.message);
    process.exit(1);
  }
}

async function uploadZip() {
  try {
    if (publishType === 'github') {
      await uploadToGitHub();
    } else if (publishType === 'storage') {
      console.log('📤 Subiendo ZIP a Firebase Storage...');

      const token = randomUUID();
      await bucket.upload(resolvedFilePath, {
        destination: `updates/${destinationPath}`,
        metadata: {
          metadata: {
            firebaseStorageDownloadTokens: token,
          },
        },
      });

      const encodedPath = encodeURIComponent(`updates/${destinationPath}`);
      const zipUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${token}`;

      console.log(`✅ Archivo subido: ${zipUrl}`);
      await updateVersionDocs(zipUrl);
    } else {
      console.log('📤 Copiando ZIP a dist/ para publicación en Firebase Hosting...');

      const targetPath = resolve(process.cwd(), 'dist', destinationPath);
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(resolvedFilePath, targetPath);

      console.log(`✅ Archivo copiado a: ${targetPath}`);
      console.log(`ℹ️ Luego debes ejecutar: firebase deploy --only hosting`);

      await updateVersionDocs(hostedUrl);
      console.log(`✅ Se configuró zipUrl como: ${hostedUrl}`);
    }

    console.log('🎉 Proceso completado.');
  } catch (error) {
    console.error('❌ Error subiendo ZIP:', error);
    process.exit(1);
  }
}

async function updateVersionDocs(zipUrl) {
  if (!version) {
    console.log('⚠️ No se proporcionó versión. Se actualiza solo app-versions/latest.');
  }

  const latestRef = db.collection('app-versions').doc('latest');
  const latestPayload = { zipUrl };
  if (version) latestPayload.version = version;
  await latestRef.set(latestPayload, { merge: true });
  console.log('✅ Se actualizó app-versions/latest.zipUrl');

  if (version) {
    const versionRef = db.collection('app-versions').doc(`v${version}`);
    await versionRef.set({ zipUrl, version }, { merge: true });
    console.log(`✅ Se actualizó app-versions/v${version}.zipUrl`);
  }
}

uploadZip();
