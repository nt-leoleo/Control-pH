import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import UpdatingService from './UpdatingService';
import { startFileDownload } from './appVersionService';
import './UpdateAvailableNotification.css';

const UpdateAvailableNotification = ({ initialUpdateInfo = null }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState('');
  const [updaterAvailable, setUpdaterAvailable] = useState(false);

  useEffect(() => {
    setUpdaterAvailable(UpdatingService.isUpdaterPluginAvailable?.() ?? false);
  }, []);

  useEffect(() => {
    // Solo verificar en app nativa
    if (!Capacitor.isNativePlatform()) return;
    if (initialUpdateInfo?.available) {
      setUpdateInfo(initialUpdateInfo);
      setUpdateAvailable(true);
    }
  }, [initialUpdateInfo]);

  useEffect(() => {
    // Solo verificar en app nativa
    if (!Capacitor.isNativePlatform()) return;
    const check = async () => {
      try {
        const info = await UpdatingService.checkForUpdates();
        if (info?.available) { setUpdateInfo(info); setUpdateAvailable(true); }
      } catch (e) { console.warn('[OTA]', e.message); }
    };
    const interval = setInterval(check, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async () => {
    if (!updateInfo) return;
    setIsDownloading(true); setDownloadProgress(0); setDownloadError('');
    try {
      await UpdatingService.downloadAndInstall(updateInfo, (p) => setDownloadProgress(p));
    } catch (error) {
      setIsDownloading(false); setDownloadProgress(0);
      setDownloadError(error.message || 'Error al descargar.');
    }
  };

  const handleDismiss = () => {
    if (isDownloading) return;
    setUpdateAvailable(false); setUpdateInfo(null); setDownloadError('');
  };

  // No mostrar en web/PC
  if (!Capacitor.isNativePlatform()) return null;
  if (!updateAvailable || !updateInfo) return null;

  return (
    <div className="update-notification-overlay">
      <div className="update-notification-card">
        <div className="update-notification-header">
          <div className="update-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <h3>Actualización Disponible</h3>
          {!updateInfo.mandatory && <button className="update-close-btn" onClick={handleDismiss} disabled={isDownloading} aria-label="Cerrar">✕</button>}
        </div>
        <div className="update-notification-content">
          <p className="update-version">Tu versión: <strong>v{updateInfo.localVersion}</strong> → Nueva: <strong>v{updateInfo.version}</strong></p>
          <p className="update-changelog">{updateInfo.changelog || 'Nueva versión disponible'}</p>
          {downloadError && <p className="update-error">⚠️ {downloadError}</p>}
          {isDownloading && (
            <div className="download-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${downloadProgress}%` }} role="progressbar" aria-valuenow={downloadProgress} aria-valuemin="0" aria-valuemax="100" />
              </div>
              <p className="progress-text">Instalando... {downloadProgress}%</p>
            </div>
          )}
        </div>
        <div className="update-notification-actions">
          {updateInfo.zipUrl ? (
            <button
              className="update-btn update-btn--primary"
              onClick={handleUpdate}
              disabled={isDownloading || !updaterAvailable}
            >
              {isDownloading ? '⏳ Instalando...' : '⬇️ Actualizar ahora'}
            </button>
          ) : (
            <button
              className="update-btn update-btn--primary"
              type="button"
              onClick={() => startFileDownload(updateInfo.apkUrl)}
            >
              ⬇️ Descargar APK
            </button>
          )}
          {!updateInfo.mandatory && <button className="update-btn update-btn--secondary" onClick={handleDismiss} disabled={isDownloading}>Después</button>}
        </div>
        {updateInfo.zipUrl && !updaterAvailable && (
          <div className="update-notification-note update-notification-warning">
            <small>⚠️ La actualización OTA no está disponible en este dispositivo. Descargá el APK si existe.</small>
          </div>
        )}
        <div className="update-notification-note">
          <small>{updateInfo.zipUrl ? '💡 La app se actualizará sin reinstalar.' : '💡 Descargá e instalá el APK para actualizar.'}</small>
        </div>
      </div>
    </div>
  );
};

export default UpdateAvailableNotification;
