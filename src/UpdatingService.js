import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const VERSION_CHECK_INTERVAL = 60 * 60 * 1000;

// Lee la versión del APK instalado desde el DOM meta tag que Capacitor inyecta,
// o desde window.__APP_VERSION__ si está definido, o '0.0.0' en web.
async function getNativeAppVersion() {
  try {
    if (Capacitor.isNativePlatform()) {
      // En nativo, CapacitorUpdater puede darnos la versión del bundle actual
      const current = await CapacitorUpdater.current();
      if (current?.bundle?.version && current.bundle.version !== 'builtin') {
        return current.bundle.version;
      }
      // Fallback: leer del meta tag que Capacitor inyecta en el HTML
      const meta = document.querySelector('meta[name="app-version"]');
      if (meta?.content) return meta.content;
    }
  } catch (e) {
    console.warn('[OTA] No se pudo leer versión nativa:', e.message);
  }
  // En web o si falla, devolver '0.0.0' para que siempre muestre actualización
  return '0.0.0';
}

function compareVersions(v1, v2) {
  const parse = (v) => String(v || '0').split('.').map(n => parseInt(n) || 0);
  const [a1, a2, a3] = parse(v1);
  const [b1, b2, b3] = parse(v2);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}

export const UpdatingService = {
  async checkForUpdates() {
    try {
      const localVersion = await getNativeAppVersion();
      console.log(`[OTA] Versión local (APK): ${localVersion}`);
      const docRef = doc(db, 'app-versions', 'latest');
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return false;
      const remoteData = docSnap.data();
      const remoteVersion = remoteData.version;
      const zipUrl = remoteData.zipUrl || null;
      const apkUrl = remoteData.url || null;
      console.log(`[OTA] Versión remota: ${remoteVersion} | Local: ${localVersion}`);
      if (!remoteVersion) return false;
      if (compareVersions(remoteVersion, localVersion) > 0) {
        return {
          available: true,
          version: remoteVersion,
          localVersion,
          zipUrl,
          apkUrl,
          changelog: remoteData.changelog || 'Nueva versión disponible',
          mandatory: remoteData.mandatory || false,
          releaseDate: remoteData.releaseDate,
        };
      }
      return false;
    } catch (error) {
      console.error('[OTA] Error verificando actualizaciones:', error);
      return false;
    }
  },

  async downloadAndInstall(updateInfo, onProgress) {
    const { zipUrl, version } = updateInfo;
    if (!zipUrl) throw new Error('No hay paquete ZIP disponible. Descargá el APK manualmente.');
    try {
      if (onProgress) onProgress(5);
      const freshCheck = await this.checkForUpdates();
      if (!freshCheck || compareVersions(freshCheck.version, version) < 0) {
        throw new Error('La versión remota ya no es mayor. Actualización cancelada.');
      }
      if (onProgress) onProgress(15);
      const downloadResult = await CapacitorUpdater.download({ url: zipUrl, version });
      if (!downloadResult?.id) throw new Error('La descarga falló: no se recibió ID del paquete.');
      if (onProgress) onProgress(80);
      await CapacitorUpdater.set({ id: downloadResult.id });
      if (onProgress) onProgress(100);
      setTimeout(() => window.location.reload(), 800);
      return true;
    } catch (error) {
      throw error;
    }
  },

  getCurrentVersion: getNativeAppVersion,
};

export default UpdatingService;
