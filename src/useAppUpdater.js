import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const CURRENT_VERSION = '4.11.18';

export const useAppUpdater = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForUpdates = async () => {
    try {
      // Solo verificar en Capacitor (app móvil)
      if (!window.Capacitor) {
        console.log('[Updater] No es app móvil, saltando verificación');
        return;
      }

      console.log('[Updater] Iniciando verificación de actualizaciones...');
      console.log('[Updater] Versión actual:', CURRENT_VERSION);
      setIsChecking(true);

      // Obtener info de actualización desde Firebase
      const updateDoc = await getDoc(doc(db, 'appConfig', 'version'));
      
      if (!updateDoc.exists()) {
        console.log('[Updater] No se encontró documento de versión');
        setIsChecking(false);
        return;
      }

      const data = updateDoc.data();
      const latestVersion = data.version;
      const updateUrl = data.updateUrl;
      const forceUpdate = data.forceUpdate || false;
      const releaseNotes = data.releaseNotes || '';

      console.log('[Updater] Versión en Firebase:', latestVersion);
      console.log('[Updater] Comparando versiones...');

      // Comparar versiones
      const comparison = compareVersions(latestVersion, CURRENT_VERSION);
      console.log('[Updater] Resultado comparación:', comparison);
      
      if (comparison > 0) {
        console.log('[Updater] ¡Actualización disponible!');
        setUpdateAvailable(true);
        setUpdateInfo({
          version: latestVersion,
          url: updateUrl,
          forceUpdate,
          releaseNotes,
        });
      } else {
        console.log('[Updater] Ya estás en la última versión');
      }

      setIsChecking(false);
    } catch (error) {
      console.error('[Updater] Error al verificar actualizaciones:', error);
      setIsChecking(false);
    }
  };

  const applyUpdate = async () => {
    if (!updateInfo || !window.Capacitor) {
      return;
    }

    try {
      // Recargar la app para obtener los nuevos archivos
      window.location.reload();
    } catch (error) {
      console.error('[Updater] Error al aplicar actualización:', error);
    }
  };

  const dismissUpdate = () => {
    if (updateInfo?.forceUpdate) {
      return; // No permitir cerrar si es actualización forzada
    }
    setUpdateAvailable(false);
  };

  useEffect(() => {
    checkForUpdates();
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

// Comparar versiones semánticas (ej: "4.8.7" vs "4.9.0")
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}
