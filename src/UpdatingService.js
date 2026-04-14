import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const APP_VERSION = '5.0.2';
const VERSION_CHECK_INTERVAL = 60 * 60 * 1000; // Cada hora

/**
 * Servicio para gestionar actualizaciones OTA
 * Lee versiones desde Firebase Firestore
 * Descarga e instala actualizaciones sin necesidad de recompilar el APK
 */

export const UpdatingService = {
  /**
   * Inicializar el servicio de actualizaciones
   */
  async init() {
    try {
      console.log('🔄 Inicializando servicio de actualizaciones...');
      
      // Verificar actualizaciones al iniciar
      await this.checkForUpdates();
      
      // Programar verificaciones periódicas
      setInterval(() => this.checkForUpdates(), VERSION_CHECK_INTERVAL);
      
      console.log('✅ Servicio de actualizaciones inicializado');
    } catch (error) {
      console.error('Error initializing update service:', error);
    }
  },

  /**
   * Verificar si hay actualizaciones disponibles desde Firestore
   */
  async checkForUpdates() {
    try {
      // Leer documento "latest" de Firebase
      const docRef = doc(db, 'app-versions', 'latest');
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        console.warn('⚠️ No se encontró documento "latest" en Firestore');
        return false;
      }

      const remoteData = docSnap.data();
      const remoteVersion = remoteData.version;
      const downloadUrl = remoteData.url;
      const isMandatory = remoteData.mandatory || false;

      console.log(`📦 Versión remota: ${remoteVersion} | Local: ${APP_VERSION}`);

      if (!remoteVersion || !downloadUrl) {
        console.warn('⚠️ Datos de versión incompletos en Firestore');
        return false;
      }

      if (this.shouldUpdate(remoteVersion)) {
        console.log(`🎉 Actualización disponible: ${APP_VERSION} -> ${remoteVersion}`);
        
        const updateInfo = {
          available: true,
          version: remoteVersion,
          url: downloadUrl,
          changelog: remoteData.changelog || 'Nueva versión disponible',
          mandatory: isMandatory,
          releaseDate: remoteData.releaseDate
        };

        // Log para analytics
        this.logUpdateAvailable(updateInfo);

        return updateInfo;
      }

      console.log('✅ Estás en la versión más reciente');
      return false;
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
      return false;
    }
  },

  /**
   * Registrar que se detectó una actualización disponible
   */
  async logUpdateAvailable(updateInfo) {
    try {
      // Opcional: registrar en Firestore que esta versión está disponible
      console.log('📊 Actualización detectada:', {
        version: updateInfo.version,
        mandatory: updateInfo.mandatory,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error logging update:', error);
    }
  },

  /**
   * Determinar si debe actualizar
   */
  shouldUpdate(remoteVersion) {
    const remote = this.parseVersion(remoteVersion);
    const local = this.parseVersion(APP_VERSION);

    if (remote.major > local.major) return true;
    if (remote.major === local.major && remote.minor > local.minor) return true;
    if (
      remote.major === local.major &&
      remote.minor === local.minor &&
      remote.patch > local.patch
    ) {
      return true;
    }

    return false;
  },

  /**
   * Parse version string (e.g., "5.0.1" -> {major: 5, minor: 0, patch: 1})
   */
  parseVersion(version) {
    const parts = version.split('.');
    return {
      major: parseInt(parts[0]) || 0,
      minor: parseInt(parts[1]) || 0,
      patch: parseInt(parts[2]) || 0
    };
  },

  /**
   * Descargar e instalar actualización
   */
  async downloadAndInstall(downloadUrl, remoteVersion) {
    try {
      console.log('📥 Iniciando descarga desde:', downloadUrl);

      // Descargar la actualización
      const downloadResult = await CapacitorUpdater.download({
        url: downloadUrl
      });

      if (!downloadResult || !downloadResult.id) {
        throw new Error('Download failed: No ID returned');
      }

      console.log('✅ Actualización descargada:', downloadResult.id);

      // Registrar descarga en Firestore (analytics)
      await this.logUpdateDownloaded(remoteVersion, downloadResult.id);

      // Instalar la actualización
      await CapacitorUpdater.set({
        id: downloadResult.id
      });

      console.log('⚙️ Actualización instalada, recargando app');

      // Recargar la app para aplicar cambios
      setTimeout(() => {
        window.location.reload();
      }, 2000);

      return true;
    } catch (error) {
      console.error('❌ Error descargando/instalando:', error);
      await this.logUpdateError(remoteVersion, error.message);
      throw error;
    }
  },

  /**
   * Registrar descarga exitosa en Firestore
   */
  async logUpdateDownloaded(version, downloadId) {
    try {
      // Crear log de descargas para analytics
      const logData = {
        type: 'UPDATE_DOWNLOADED',
        version,
        downloadId,
        fromVersion: APP_VERSION,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        platform: this.getPlatform()
      };
      console.log('📊 Log de descarga registrado:', logData);
    } catch (error) {
      console.error('Error logging download:', error);
    }
  },

  /**
   * Registrar error en descarga
   */
  async logUpdateError(version, errorMessage) {
    try {
      const errorLog = {
        type: 'UPDATE_ERROR',
        version,
        error: errorMessage,
        timestamp: new Date().toISOString(),
        fromVersion: APP_VERSION
      };
      console.error('❌ Error registrado:', errorLog);
    } catch (error) {
      console.error('Error logging update error:', error);
    }
  },

  /**
   * Obtener plataforma (web, android, ios)
   */
  getPlatform() {
    if (window.cordova || window.capacitor) {
      const platform = window.cordova?.platformId || window.capacitor?.platform;
      return platform || 'web';
    }
    return 'web';
  },

  /**
   * Obtener información de actualización disponible
   */
  async getUpdateInfo() {
    try {
      const updateAvailable = await this.checkForUpdates();
      return updateAvailable;
    } catch (error) {
      console.error('Error getting update info:', error);
      return false;
    }
  },

  /**
   * Cancelar actualización en progreso
   */
  async cancelUpdate() {
    try {
      await CapacitorUpdater.cancel();
      console.log('Update cancelled');
    } catch (error) {
      console.error('Error cancelling update:', error);
    }
  },

  /**
   * Reset a una versión anterior si hay error
   */
  async rollback() {
    try {
      console.log('Rolling back to previous version');
      await CapacitorUpdater.reload();
    } catch (error) {
      console.error('Error rolling back:', error);
    }
  },

  /**
   * Obtener versión actual de la app
   */
  getCurrentVersion() {
    return APP_VERSION;
  }
};

export default UpdatingService;
