import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const APP_VERSION_COLLECTION = 'app-versions';
const LATEST_VERSION_DOCUMENT = 'latest';

const normalizeVersionString = (version) => {
  return String(version || '0')
    .trim()
    .replace(/^[vV]/, '')
    .split(/[+-]/)[0]
    .split(/[^0-9.]/g)
    .filter(Boolean)
    .join('.') || '0.0.0';
};

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
  const version = normalizeVersionString(data.version || '');

  return {
    version,
    apkUrl: data.apkUrl || data.url || '',
    zipUrl: data.zipUrl || data.updateUrl || data.url || '',
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

export const startFileDownload = async (url, filename) => {
  try {
    // Fetch el archivo como blob
    const response = await fetch(url, { 
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      throw new Error(`Error descargando: ${response.status}`);
    }
    
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    // Crear y disparar descarga
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename || 'download';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Liberar memoria
    setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
  } catch (error) {
    console.error('Error al descargar:', error);
    // Fallback: intentar descarga directa
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    link.click();
  }
};
