import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const APP_VERSION_COLLECTION = 'app-versions';
const LATEST_VERSION_DOCUMENT = 'latest';

const normalizeVersionForFilename = (version) => {
  const cleanVersion = String(version || 'latest')
    .replace(/^v/i, '')
    .replace(/[^a-zA-Z0-9._-]/g, '');

  return cleanVersion || 'latest';
};

export const getLatestAppVersion = async () => {
  const versionDoc = await getDoc(doc(db, APP_VERSION_COLLECTION, LATEST_VERSION_DOCUMENT));

  if (!versionDoc.exists()) {
    throw new Error('No existe app-versions/latest en Firestore.');
  }

  const data = versionDoc.data() || {};

  return {
    version: data.version || '',
    apkUrl: data.apkUrl || data.url || '',
    zipUrl: data.zipUrl || '',
    changelog: data.changelog || data.releaseNotes || 'Nueva version disponible',
    mandatory: data.mandatory || data.forceUpdate || false,
    releaseDate: data.releaseDate || data.updatedAt || null,
    isActive: data.isActive !== false,
  };
};

export const getLatestApkDownloadInfo = async () => {
  const latestVersion = await getLatestAppVersion();

  if (!latestVersion.isActive) {
    throw new Error('La ultima version publicada esta desactivada.');
  }

  if (!latestVersion.apkUrl) {
    throw new Error('No hay URL de APK en app-versions/latest. Usa el campo apkUrl o url.');
  }

  return {
    ...latestVersion,
    url: latestVersion.apkUrl,
    filename: `control-pileta-v${normalizeVersionForFilename(latestVersion.version)}.apk`,
  };
};

export const startFileDownload = (url, filename) => {
  const link = document.createElement('a');
  link.href = url;
  if (filename) link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
};
