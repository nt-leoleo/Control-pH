import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { getLatestAppVersion } from './appVersionService';

const BUILD_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';

function isUpdaterPluginAvailable() {
  if (!Capacitor.isNativePlatform()) return false;

  try {
    return Boolean(Capacitor.getPlugin?.('CapacitorUpdater', { sync: true }));
  } catch {
    return false;
  }
}

function ensureUpdaterPluginAvailable() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Las actualizaciones OTA solo están disponibles en la app nativa.');
  }
  if (!isUpdaterPluginAvailable()) {
    throw new Error('El plugin CapacitorUpdater no está disponible en Android.');
  }
}

async function getNativeAppVersion() {
  try {
    if (!Capacitor.isNativePlatform()) {
      return BUILD_VERSION;
    }

    const current = await CapacitorUpdater.current();
    if (current?.bundle?.version && current.bundle.version !== 'builtin') {
      return current.bundle.version;
    }

    if (current?.native) {
      return current.native;
    }

    if (CapacitorUpdater.getBuiltinVersion) {
      const builtin = await CapacitorUpdater.getBuiltinVersion();
      if (builtin?.version) {
        return builtin.version;
      }
    }

    const meta = document.querySelector('meta[name="app-version"]');
    if (meta?.content) return meta.content;
  } catch (error) {
    console.warn('[OTA] No se pudo leer version nativa:', error.message);
  }

  return BUILD_VERSION;
}

function compareVersions(v1, v2) {
  const parse = (version) => String(version || '0').split('.').map((part) => parseInt(part, 10) || 0);
  const [a1, a2, a3] = parse(v1);
  const [b1, b2, b3] = parse(v2);

  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}

export const UpdatingService = {
  async checkForUpdates() {
    try {
      if (!Capacitor.isNativePlatform()) {
        return false;
      }

      const localVersion = await getNativeAppVersion();
      const remoteData = await getLatestAppVersion();
      const remoteVersion = remoteData.version;

      console.log(`[OTA] Version remota: ${remoteVersion} | Local: ${localVersion}`);

      if (!remoteData.isActive || !remoteVersion) return false;

      if (compareVersions(remoteVersion, localVersion) <= 0) {
        return false;
      }

      return {
        available: true,
        version: remoteVersion,
        localVersion,
        zipUrl: remoteData.zipUrl || null,
        apkUrl: remoteData.apkUrl || null,
        changelog: remoteData.changelog || 'Nueva version disponible',
        mandatory: remoteData.mandatory || false,
        releaseDate: remoteData.releaseDate,
      };
    } catch (error) {
      console.error('[OTA] Error verificando actualizaciones:', error);
      return false;
    }
  },

  async downloadAndInstall(updateInfo, onProgress) {
    if (!Capacitor.isNativePlatform()) {
      throw new Error('Las actualizaciones OTA solo estan disponibles en la app nativa.');
    }

    const { zipUrl, version } = updateInfo || {};
    if (!zipUrl) throw new Error('No hay paquete ZIP disponible. Descarga el APK manualmente.');

    if (onProgress) onProgress(5);

    const freshCheck = await this.checkForUpdates();
    if (!freshCheck || compareVersions(freshCheck.version, version) < 0) {
      throw new Error('La version remota ya no es mayor. Actualizacion cancelada.');
    }

    if (onProgress) onProgress(15);
    ensureUpdaterPluginAvailable();

    const downloadResult = await CapacitorUpdater.download({ url: zipUrl, version });
    if (!downloadResult?.id) throw new Error('La descarga fallo: no se recibio ID del paquete.');

    if (onProgress) onProgress(80);
    await CapacitorUpdater.set({ id: downloadResult.id });

    if (onProgress) onProgress(100);
    setTimeout(() => window.location.reload(), 800);
    return true;
  },

  getCurrentVersion: getNativeAppVersion,
  isUpdaterPluginAvailable,
};

export default UpdatingService;
