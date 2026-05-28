import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import UpdatingService from './UpdatingService';
import { startFileDownload } from './appVersionService';
import './UpdateAvailableNotification.css';

const NOTIF_ID = 123456;

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

  async function showOrUpdateNotification(progress) {
    try {
      if (!Capacitor.isNativePlatform()) return;
      // Cancel previous and schedule new to emulate progress update
      await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
      await LocalNotifications.schedule({
        notifications: [
          {
            id: NOTIF_ID,
            title: 'Descargando actualización',
            body: `${Math.round(progress)}%`,
            smallIcon: 'ic_stat_notify',
            // set extra if needed
          },
        ],
      });
    } catch (e) {
      // ignore notification errors
      console.warn('[OTA] LocalNotifications error', e?.message || e);
    }
  }

  async function clearNotification() {
    try {
      if (!Capacitor.isNativePlatform()) return;
      await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
    } catch (e) { console.warn('[OTA] clearNotification', e?.message || e); }
  }

  useEffect(() => {
    // Solo verificar en app nativa
    if (!Capacitor.isNativePlatform()) return;
    // If initialUpdateInfo provided, validate it against local version before showing
    const validateInitial = async () => {
      if (!initialUpdateInfo?.available) return;
      try {
        const localVersion = await UpdatingService.getCurrentVersion();
        const remoteVersion = initialUpdateInfo.version;
        const cmp = compareVersions(remoteVersion, localVersion);
        if (cmp > 0 && initialUpdateInfo.isActive !== false) {
          setUpdateInfo(initialUpdateInfo);
          setUpdateAvailable(true);
        }
      } catch (e) {
        console.warn('[OTA] validateInitial', e?.message || e);
      }
    };
    validateInitial();
  }, [initialUpdateInfo]);

  useEffect(() => {
    // Solo verificar en app nativa
    if (!Capacitor.isNativePlatform()) return;
    const check = async () => {
      try {
        const info = await UpdatingService.checkForUpdates();
        if (info?.available) { setUpdateInfo(info); setUpdateAvailable(true); }
        else { setUpdateAvailable(false); setUpdateInfo(null); }
      } catch (e) { console.warn('[OTA]', e.message); }
    };
    check();
    const interval = setInterval(check, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async () => {
    if (!updateInfo) return;
    setIsDownloading(true); setDownloadProgress(0); setDownloadError('');
    try {
      await UpdatingService.downloadAndInstall(updateInfo, async (p) => {
        setDownloadProgress(p);
        await showOrUpdateNotification(p);
      });
      await clearNotification();
    } catch (error) {
      setIsDownloading(false); setDownloadProgress(0);
      setDownloadError(error.message || 'Error al descargar.');
      await clearNotification();
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
          {updateInfo.zipUrl && (
            <button
              className="update-btn update-btn--primary"
              onClick={handleUpdate}
              disabled={isDownloading}
            >
              {isDownloading ? '⏳ Instalando...' : '⬇️ Actualizar ahora'}
            </button>
          )}
          {updateInfo.apkUrl && (
            <button
              className={updateInfo.zipUrl ? 'update-btn update-btn--secondary' : 'update-btn update-btn--primary'}
              type="button"
              onClick={() => startFileDownload(updateInfo.apkUrl)}
              disabled={isDownloading}
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

export default UpdateAvailableNotification;
