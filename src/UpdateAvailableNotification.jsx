import { useEffect, useState } from 'react';
import UpdatingService from './UpdatingService';
import './UpdateAvailableNotification.css';

/**
 * Componente que muestra notificación cuando hay una actualización disponible
 * Se integra con Capacitor Updater para descargar e instalar
 */
const UpdateAvailableNotification = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const available = await UpdatingService.checkForUpdates();
        if (available) {
          setUpdateInfo(available);
          setUpdateAvailable(true);
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };

    // Verificar al montar el componente
    checkUpdates();

    // Y cada 60 minutos
    const interval = setInterval(checkUpdates, 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async () => {
    if (!updateInfo || !updateInfo.url) {
      console.error('No update URL available');
      return;
    }

    setIsDownloading(true);
    try {
      await UpdatingService.downloadAndInstall(updateInfo.url, updateInfo.version);
      // No llegará aquí porque la app se recarga
    } catch (error) {
      console.error('Error installing update:', error);
      setIsDownloading(false);
      // Mostrar error al usuario
      alert(`Error descargando actualización: ${error.message}`);
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
    setUpdateInfo(null);
  };

  if (!updateAvailable) return null;

  return (
    <div className="update-notification-overlay">
      <div className="update-notification-card">
        <div className="update-notification-header">
          <div className="update-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"></path>
            </svg>
          </div>
          <h3>Actualización Disponible</h3>
          <button
            className="update-close-btn"
            onClick={handleDismiss}
            disabled={isDownloading}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="update-notification-content">
          <p className="update-version">
            Nueva versión: <strong>v{updateInfo?.version}</strong>
          </p>
          <p className="update-changelog">
            {updateInfo?.changelog || 'Nueva versión disponible con mejoras y correcciones'}
          </p>

          {isDownloading && (
            <div className="download-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${downloadProgress}%` }}
                  role="progressbar"
                  aria-valuenow={downloadProgress}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  {downloadProgress > 0 && <span>{downloadProgress}%</span>}
                </div>
              </div>
              <p className="progress-text">Descargando actualización...</p>
            </div>
          )}
        </div>

        <div className="update-notification-actions">
          <button
            className="update-btn update-btn--primary"
            onClick={handleUpdate}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <svg className="spinner" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" strokeWidth="2"></circle>
                </svg>
                Descargando...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>
                </svg>
                Actualizar Ahora
              </>
            )}
          </button>

          <button
            className="update-btn update-btn--secondary"
            onClick={handleDismiss}
            disabled={isDownloading}
          >
            Después
          </button>
        </div>

        <div className="update-notification-note">
          <small>
            💡 La app se reiniciará automáticamente después de descargar la actualización.
            Tus datos se guardarán en Firebase.
          </small>
        </div>
      </div>
    </div>
  );
};

export default UpdateAvailableNotification;
