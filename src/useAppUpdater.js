import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const CURRENT_VERSION = '5.1.0';

export const useAppUpdater = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForUpdates = async () => {
    try {
      console.log('[Updater] Iniciando verificación de actualizaciones...');
      console.log('[Updater] Versión actual:', CURRENT_VERSION);
      setIsChecking(true);

      // Obtener info de versión desde Firestore (app-versions/latest)
      const versionDoc = await getDoc(doc(db, 'app-versions', 'latest'));
      
      if (!versionDoc.exists()) {
        console.log('[Updater] No se encontró documento "latest" en app-versions');
        setIsChecking(false);
        return;
      }

      const data = versionDoc.data();
      const latestVersion = data.version;
      const downloadUrl = data.url;
      const changelog = data.changelog || 'Nueva versión disponible';
      const isMandatory = data.mandatory || false;

      console.log('[Updater] Versión en Firebase:', latestVersion);
      console.log('[Updater] Comparando versiones...');

      // Comparar versiones
      const comparison = compareVersions(latestVersion, CURRENT_VERSION);
      console.log('[Updater] Resultado comparación:', comparison);
      
      if (comparison > 0) {
        console.log('[Updater] ¡Actualización disponible:', latestVersion);
        setUpdateAvailable(true);
        setUpdateInfo({
          version: latestVersion,
          url: downloadUrl,
          changelog,
          mandatory: isMandatory,
          releaseDate: data.releaseDate
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
    if (!updateInfo) {
      return;
    }

    try {
      console.log('[Updater] Aplicando actualización OTA...');
      
      // Mostrar pantalla de descarga
      setIsChecking(true);
      
      // Si es Capacitor (app nativa), limpiar cache y recargar
      if (window.Capacitor) {
        console.log('[Updater] Limpiando cache de Capacitor...');
        
        // Limpiar cache del navegador
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(cacheName => caches.delete(cacheName))
          );
          console.log('[Updater] Cache limpiado');
        }
        
        // Esperar un momento para que el usuario vea el mensaje
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Recargar desde el servidor (forzar descarga)
        console.log('[Updater] Recargando app desde servidor...');
        window.location.href = window.location.origin + '?v=' + updateInfo.version + '&t=' + Date.now();
      } else {
        // En web, simplemente recargar
        window.location.reload(true);
      }
    } catch (error) {
      console.error('[Updater] Error al aplicar actualización:', error);
      setIsChecking(false);
      alert('Error al actualizar. Por favor, intenta de nuevo.');
    }
  };

  const dismissUpdate = () => {
    if (updateInfo?.mandatory) {
      return; // No permitir cerrar si es actualización obligatoria
    }
    setUpdateAvailable(false);
  };

  useEffect(() => {
    // Verificar actualizaciones al iniciar la app (durante splash screen)
    checkForUpdates();

    // Verificar cada 60 minutos
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

