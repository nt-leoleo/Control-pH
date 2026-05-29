import { useState } from 'react';
import { useAuth } from './useAuth';
import { getLatestApkDownloadInfo, startFileDownload } from './appVersionService';
import './MobileAppDownloadScreen.css';

const MobileAppDownloadScreen = ({ onContinue }) => {
  const { updateUserConfig } = useAuth();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const handleContinueWithoutApp = async () => {
    setIsConfirming(true);
    try {
      // Marcar en la configuración del usuario que ya pasó por esta pantalla
      await updateUserConfig({ hasSeenAppDownloadScreen: true });
      onContinue();
    } catch (error) {
      console.error('Error al marcar pantalla de descarga como vista:', error);
      setIsConfirming(false);
    }
  };

  const handleDownloadApp = async () => {
    try {
      setDownloadError(null);
      setIsDownloading(true);
      const apkInfo = await getLatestApkDownloadInfo();
      await startFileDownload(apkInfo.url, apkInfo.filename);
    } catch (error) {
      console.error('Error descargando APK:', error);
      setDownloadError(`No se pudo obtener la ultima app: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mobile-app-download-screen">
      <div className="download-screen-content">
        <div className="download-screen-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6v6l4 2"></path>
          </svg>
        </div>

        <h1 className="download-screen-title">
          Configuración Inicial en App Móvil
        </h1>

        <p className="download-screen-subtitle">
          Para garantizar la mejor experiencia y una configuración segura, la inicialización del sistema {' '}
          es <strong>exclusivamente desde la aplicación móvil Android</strong>.
        </p>

        <div className="download-screen-benefits">
          <h3>Ventajas de usar la app:</h3>
          <ul>
            <li>✓ Escaneo QR de dispositivos integrado</li>
            <li>✓ Configuración de WiFi guiada</li>
            <li>✓ Instalación automática de actualizaciones</li>
            <li>✓ Control completo offline</li>
            <li>✓ Interfaz optimizada para móvil</li>
          </ul>
        </div>

        <div className="download-screen-actions">
          <button
            className="download-btn download-btn--primary"
            onClick={handleDownloadApp}
            disabled={isDownloading}
            type="button"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"></path>
            </svg>
            {isDownloading ? 'Buscando app...' : 'Descargar App Android'}
          </button>

          <button
            className="download-btn download-btn--secondary"
            onClick={handleContinueWithoutApp}
            disabled={isConfirming}
            type="button"
          >
            {isConfirming ? 'Un momento...' : 'Ya descargué la app'}
          </button>
        </div>

        {downloadError && (
          <div className="download-screen-note" role="alert">
            <strong>Error:</strong> {downloadError}
          </div>
        )}

        <div className="download-screen-note">
          <strong>Nota:</strong> Después de descargar e instalar la app, abre sesión con el mismo correo electrónico. La configuración en la app sincronizará automáticamente con esta web.
        </div>
      </div>
    </div>
  );
};

export default MobileAppDownloadScreen;
