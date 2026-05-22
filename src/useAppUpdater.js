import { useEffect, useState } from 'react';
import { getLatestAppVersion } from './appVersionService';
import UpdatingService from './UpdatingService';

export const useAppUpdater = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);

      const currentVersion = await UpdatingService.getCurrentVersion();
      const latestVersion = await getLatestAppVersion();
      const comparison = compareVersions(latestVersion.version, currentVersion);

      console.log('[Updater] Version actual:', currentVersion);
      console.log('[Updater] Version en Firebase:', latestVersion.version);
      console.log('[Updater] Resultado comparacion:', comparison);

      if (latestVersion.isActive && comparison > 0) {
        setUpdateAvailable(true);
        setUpdateInfo({
          version: latestVersion.version,
          url: latestVersion.apkUrl,
          apkUrl: latestVersion.apkUrl,
          zipUrl: latestVersion.zipUrl,
          changelog: latestVersion.changelog,
          mandatory: latestVersion.mandatory,
          releaseDate: latestVersion.releaseDate,
        });
      } else {
        setUpdateAvailable(false);
        setUpdateInfo(null);
      }
    } catch (error) {
      console.error('[Updater] Error al verificar actualizaciones:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const applyUpdate = async () => {
    if (!updateInfo) return;

    try {
      setIsChecking(true);

      if (window.Capacitor) {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
        window.location.href = `${window.location.origin}?v=${updateInfo.version}&t=${Date.now()}`;
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('[Updater] Error al aplicar actualizacion:', error);
      alert('Error al actualizar. Por favor, intenta de nuevo.');
    } finally {
      setIsChecking(false);
    }
  };

  const dismissUpdate = () => {
    if (updateInfo?.mandatory) return;
    setUpdateAvailable(false);
  };

  useEffect(() => {
    checkForUpdates();
    const intervalId = setInterval(checkForUpdates, 60 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  return {
    updateAvailable,
    updateInfo,
    isChecking,
    applyUpdate,
    dismissUpdate,
    checkForUpdates,
  };
};

function compareVersions(v1, v2) {
  const parts1 = String(v1 || '0').split('.').map(Number);
  const parts2 = String(v2 || '0').split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i += 1) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}
