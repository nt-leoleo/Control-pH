import { useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
import WiFiConfig from './WiFiConfig';
import AdminPanel from './AdminPanel';
import DeviceRegistration from './DeviceRegistration';
import ErrorNotification from './ErrorNotification';
import ConfirmDialog from './ConfirmDialog';
import ScheduledDosing from './ScheduledDosing';
import { useAuth } from './useAuth';
import './SettingsPage.css';

const UiIcon = ({ name, size = 18, className = '' }) => {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    className: `ui-icon ${className}`.trim(),
    'aria-hidden': true
  };

  switch (name) {
    case 'settings':
      return (
        <svg {...props}>
          <path d="M20 7h-9" />
          <path d="M14 17H4" />
          <circle cx="17" cy="17" r="3" />
          <circle cx="7" cy="7" r="3" />
        </svg>
      );
    case 'appearance':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      );
    case 'ph':
      return (
        <svg {...props}>
          <path d="M10 2h4" />
          <path d="M12 2v7" />
          <path d="M8 9h8" />
          <path d="M9 9v8a3 3 0 0 0 6 0V9" />
        </svg>
      );
    case 'dosing':
      return (
        <svg {...props}>
          <path d="M12 2c3.5 4.5 6 7.4 6 10a6 6 0 1 1-12 0c0-2.6 2.5-5.5 6-10Z" />
        </svg>
      );
    case 'automatic':
      return (
        <svg {...props}>
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <path d="M9 12h6M12 9v6M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" />
        </svg>
      );
    case 'manual':
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3" />
          <path d="M6.5 20a5.5 5.5 0 0 1 11 0" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v6l4 2" />
        </svg>
      );
    case 'esp32':
      return (
        <svg {...props}>
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
        </svg>
      );
    case 'device':
      return (
        <svg {...props}>
          <rect x="8" y="2.5" width="8" height="19" rx="2" />
          <path d="M11 18.5h2" />
        </svg>
      );
    case 'wifi':
      return (
        <svg {...props}>
          <path d="M2 8.8a15 15 0 0 1 20 0" />
          <path d="M5.5 12.3a10 10 0 0 1 13 0" />
          <path d="M9.2 15.8a5 5 0 0 1 5.6 0" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      );
    case 'pool':
      return (
        <svg {...props}>
          <path d="M3 8c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" />
          <path d="M3 13c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" />
          <path d="M3 18c2 0 2 2 4 2s2-2 4-2 2 2 4 2 2-2 4-2" />
        </svg>
      );
    case 'info':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6" />
          <path d="M12 7.2h.01" />
        </svg>
      );
    case 'actions':
      return (
        <svg {...props}>
          <path d="m14.7 6.3 3 3" />
          <path d="m4 20 3.7-.7L19 8 16 5 4.7 16.3z" />
        </svg>
      );
    case 'admin':
      return (
        <svg {...props}>
          <path d="M12 3 5 6v6c0 4.3 2.8 7.3 7 9 4.2-1.7 7-4.7 7-9V6Z" />
          <path d="M9.2 12.2 11 14l3.8-3.8" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...props}>
          <path d="M4 19h16" />
          <path d="M7 16v-5" />
          <path d="M12 16V8" />
          <path d="M17 16v-3" />
        </svg>
      );
    case 'test':
      return (
        <svg {...props}>
          <path d="M10 2h4" />
          <path d="M12 2v7" />
          <path d="M8 9h8" />
          <path d="M9 9v8a3 3 0 0 0 6 0V9" />
        </svg>
      );
    case 'reload':
      return (
        <svg {...props}>
          <path d="M20 12a8 8 0 1 1-2.3-5.7" />
          <path d="M20 4v6h-6" />
        </svg>
      );
    case 'warning':
      return (
        <svg {...props}>
          <path d="m12 3 9 16H3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    case 'statusOn':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.2 2.1 2.1 4.9-4.9" />
        </svg>
      );
    case 'statusOff':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </svg>
      );
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2.5M12 19.5V22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2 12h2.5M19.5 12H22M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      );
    case 'moon':
      return (
        <svg {...props}>
          <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z" />
        </svg>
      );
    case 'close':
      return (
        <svg {...props}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    default:
      return null;
  }
};

const SettingsPage = ({ onBack, theme, toggleTheme }) => {
  const { 
    ph,
    phHistory,
    dosingHistory,
    phTolerance, 
    setPhTolerance, 
    phToleranceRange, 
    setPhToleranceRange,
    dosingMode,
    setDosingMode,
    esp32Connected,
    lastDataReceived,
    checkConnection,
    ensureDeviceConfigured
  } = useContext(PHContext);
  const { user, deleteAccount } = useAuth();
  
  const [showWiFiConfig, setShowWiFiConfig] = useState(false);
  const [showDeviceRegistration, setShowDeviceRegistration] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [uiMessage, setUiMessage] = useState(null);

  const [localPhTolerance, setLocalPhTolerance] = useState(phTolerance);
  const [localPhToleranceRange, setLocalPhToleranceRange] = useState(phToleranceRange);
  const adminEmailAllowlist = useMemo(
    () =>
      (import.meta.env.VITE_ADMIN_ACCESS_EMAILS || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    []
  );
  const canAccessAdmin = Boolean(user?.email) && adminEmailAllowlist.includes(user.email.toLowerCase());

  useEffect(() => {
    setLocalPhTolerance(phTolerance);
  }, [phTolerance]);

  useEffect(() => {
    setLocalPhToleranceRange(phToleranceRange);
  }, [phToleranceRange]);

  useEffect(() => {
    const openDeviceModal = () => setShowDeviceRegistration(true);
    window.addEventListener('device-registration:open', openDeviceModal);
    return () => window.removeEventListener('device-registration:open', openDeviceModal);
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (localPhTolerance !== phTolerance && localPhTolerance >= 0 && localPhTolerance <= 14) {
        try {
          await setPhTolerance(localPhTolerance);
        } catch (error) {
          console.error('[Settings] Error guardando pH tolerance:', error);
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localPhTolerance, phTolerance, setPhTolerance]);

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (localPhToleranceRange !== phToleranceRange && localPhToleranceRange > 0 && localPhToleranceRange <= 5) {
        try {
          await setPhToleranceRange(localPhToleranceRange);
        } catch (error) {
          console.error('[Settings] Error guardando pH tolerance range:', error);
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localPhToleranceRange, phToleranceRange, setPhToleranceRange]);
  const handleToleranceChange = useCallback((e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 14) {
      setLocalPhTolerance(value);
    }
  }, []);

  const handleRangeChange = useCallback((e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0 && value <= 5) {
      setLocalPhToleranceRange(value);
    }
  }, []);

  const handleTestConnection = async () => {
    if (!ensureDeviceConfigured('probar la conexion')) {
      return;
    }

    setIsTestingConnection(true);
    try {
      await checkConnection();
    } catch (error) {
      console.error('[Settings] Error en test de conexión:', error);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const notify = useCallback((type, message) => {
    setUiMessage({
      id: Date.now(),
      type,
      message
    });
  }, []);

  const handleAdminAccess = useCallback(() => {
    if (canAccessAdmin) {
      setShowAdminPanel(true);
      return;
    }

    if (adminEmailAllowlist.length === 0) {
      notify(
        'warning',
        'El acceso administrador no esta configurado. Define VITE_ADMIN_ACCESS_EMAILS en el entorno.'
      );
      return;
    }

    notify('error', 'Tu cuenta no tiene permisos para abrir el panel administrador.');
  }, [adminEmailAllowlist.length, canAccessAdmin, notify]);

  const requestDeleteAccount = () => {
    if (!user || isDeletingAccount) return;
    setShowDeleteAccountConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    setShowDeleteAccountConfirm(false);
    setIsDeletingAccount(true);

    try {
      await deleteAccount();
      notify('success', 'Cuenta eliminada correctamente. Cerrando sesion...');
      window.location.hash = '';
      window.location.replace(window.location.pathname);
    } catch (error) {
      console.error('Error eliminando cuenta:', error);
      notify('error', `No se pudo eliminar la cuenta: ${error.message}`);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const handleOpenTracking = useCallback(() => {
    setShowTrackingModal(true);
  }, []);

  const handleReplayTutorial = useCallback(() => {
    if (typeof window.startControlPiletaTutorial === 'function') {
      window.startControlPiletaTutorial();
      return;
    }

    notify('warning', 'No se pudo iniciar el tutorial desde esta pantalla.');
  }, [notify]);

  const handlePlaceholderAction = (actionName) => {
    notify('info', `${actionName} estara disponible en la siguiente version.`);
  };

  const latestReadings = useMemo(() => [...(phHistory || [])].slice(-8).reverse(), [phHistory]);
  const latestDosingEntries = useMemo(() => [...(dosingHistory || [])].slice(-5).reverse(), [dosingHistory]);
  const latestDosing = latestDosingEntries[0] || null;

  return (
    <div className="settings-page fade-in">
            <div className="settings-header">
        <button 
          className="settings-back-btn"
          onClick={onBack}
          title="Volver al inicio"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <h1 className="settings-title">
          <UiIcon name="settings" className="title-icon" />
          <span>Configuración</span>
        </h1>
      </div>

            <div className="settings-content">
        
                <div className="settings-section scale-in">
          <h3 className="settings-heading">
            <UiIcon name="appearance" className="heading-icon" />
            <span>Apariencia</span>
          </h3>
          
          <div className="setting-item">
            <label className="setting-label">
              Tema de la aplicación
              <span className="setting-description">
                Modo {theme === 'dark' ? 'oscuro' : 'claro'} activado
              </span>
            </label>
            <button 
              onClick={toggleTheme}
              className="theme-toggle-btn"
            >
              <UiIcon name={theme === 'dark' ? 'sun' : 'moon'} className="btn-icon" />
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </button>
          </div>
        </div>
        
        {/* Sección de Horarios Permitidos */}
        <div className="settings-section scale-in">
          <h3 className="settings-heading">
            <UiIcon name="clock" className="heading-icon" />
            <span>Horarios Permitidos</span>
          </h3>
          
          <ScheduledDosing />
        </div>

                <div className="settings-section scale-in">
          <h3 className="settings-heading">
            <UiIcon name="ph" className="heading-icon" />
            <span>Configuración de pH</span>
          </h3>
          
          <div className="setting-item">
            <label className="setting-label">
              pH Objetivo
              <span className="setting-description">Valor ideal de pH para la piscina</span>
            </label>
            <div className="setting-control-slider">
              <div className="slider-container">
                <input
                  type="range"
                  step="0.1"
                  value={localPhTolerance}
                  onChange={handleToleranceChange}
                  className="ph-slider"
                />
                <div className="slider-track">
                  <div className="slider-zones">
                    <span className="zone acidic">Ácido</span>
                    <span className="zone neutral">Neutro</span>
                    <span className="zone basic">Básico</span>
                  </div>
                </div>
              </div>
              <div className="slider-value">
                <input
                  type="number"
                  step="0.1"
                  value={localPhTolerance}
                  onChange={handleToleranceChange}
                  className="setting-input-small"
                />
                <span className="setting-unit">pH</span>
              </div>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              Tolerancia
              <span className="setting-description">Rango permitido de variación (±)</span>
            </label>
            <div className="setting-control-slider">
              <div className="slider-container">
                <input
                  type="range"
                  step="0.1"
                  value={localPhToleranceRange}
                  onChange={handleRangeChange}
                  className="tolerance-slider"
                />
                <div className="slider-labels">
                  <span>Preciso</span>
                  <span>Flexible</span>
                </div>
              </div>
              <div className="slider-value">
                <input
                  type="number"
                  step="0.1"
                  value={localPhToleranceRange}
                  onChange={handleRangeChange}
                  className="setting-input-small"
                />
                <span className="setting-unit">±</span>
              </div>
            </div>
          </div>

          <div className="ph-preview">
            <div className="ph-range">
              <span className="range-label">Rango Aceptable:</span>
              <span className="range-value">
                {(localPhTolerance - localPhToleranceRange).toFixed(1)} - {(localPhTolerance + localPhToleranceRange).toFixed(1)} pH
              </span>
            </div>
          </div>

          <button
            className="action-btn btn-secondary tutorial-btn"
            onClick={handleReplayTutorial}
          >
            <span className="action-icon">
              <UiIcon name="info" size={16} />
            </span>
            Volver a ver el tutorial
          </button>
        </div>

                <div className="settings-section scale-in">
          <h3 className="settings-heading">
            <UiIcon name="dosing" className="heading-icon" />
            <span>Modo de Dosificación</span>
          </h3>
          
          <div className="dosing-modes">
            <button
              className={`dosing-mode-btn ${dosingMode === 'automatic' ? 'active' : ''}`}
              onClick={async () => {
                try {
                  if (!ensureDeviceConfigured('cambiar el modo automatico')) {
                    return;
                  }
                  await setDosingMode('automatic');
                } catch (error) {
                  console.error('[Settings] Error cambiando a modo automático:', error);
                }
              }}
            >
              <div className="mode-icon">
                <UiIcon name="automatic" />
              </div>
              <div className="mode-info">
                <div className="mode-title">Automático</div>
                <div className="mode-desc">El sistema ajusta el pH automáticamente</div>
              </div>
            </button>

            <button
              className={`dosing-mode-btn ${dosingMode === 'manual' ? 'active' : ''}`}
              onClick={async () => {
                try {
                  if (!ensureDeviceConfigured('cambiar el modo manual')) {
                    return;
                  }
                  await setDosingMode('manual');
                } catch (error) {
                  console.error('[Settings] Error cambiando a modo manual:', error);
                }
              }}
            >
              <div className="mode-icon">
                <UiIcon name="manual" />
              </div>
              <div className="mode-info">
                <div className="mode-title">Manual</div>
                <div className="mode-desc">Control manual de la dosificación</div>
              </div>
            </button>
          </div>
        </div>

                <div className="settings-section scale-in">
          <h3 className="settings-heading">
            <UiIcon name="esp32" className="heading-icon" />
            <span>Configuración ESP32</span>
          </h3>
          
          <button 
            className="esp32-config-btn"
            onClick={() => setShowDeviceRegistration(true)}
          >
            <div className="config-icon">
              <UiIcon name="device" />
            </div>
            <div className="config-info">
              <div className="config-title">Registrar Dispositivo</div>
              <div className="config-desc">Vincular ESP32 con tu cuenta</div>
            </div>
            <div className="config-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </div>
          </button>
          
          <button 
            className="esp32-config-btn"
            onClick={() => setShowWiFiConfig(true)}
          >
            <div className="config-icon">
              <UiIcon name="wifi" />
            </div>
            <div className="config-info">
              <div className="config-title">Configuración WiFi</div>
              <div className="config-desc">Configurar conexión del sensor</div>
            </div>
            <div className="config-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </div>
          </button>
        </div>

                <div className="settings-section scale-in">
          <h3 className="settings-heading">
            <UiIcon name="pool" className="heading-icon" />
            <span>Gestión de Piscinas</span>
          </h3>
          
          <button 
            className="esp32-config-btn"
            onClick={() => window.location.hash = 'pool-manager'}
          >
            <div className="config-icon">
              <UiIcon name="pool" />
            </div>
            <div className="config-info">
              <div className="config-title">Administrar Piscinas</div>
              <div className="config-desc">Agregar, editar y cambiar entre piscinas</div>
            </div>
            <div className="config-arrow">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </div>
          </button>
        </div>
        <div className="settings-section scale-in account-settings-section">
          <h3>Cuenta</h3>

          <div className="system-info account-info-list">
            <div className="info-item">
              <span className="info-label">Nombre:</span>
              <span className="info-value">{user?.displayName || 'Sin nombre'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{user?.email || 'Sin email'}</span>
            </div>
          </div>
        </div>


                <div className="settings-section scale-in">
          <h3 className="settings-heading">
            <UiIcon name="info" className="heading-icon" />
            <span>Información del Sistema</span>
          </h3>
          
          <div className="system-info">
            <div className="info-item">
              <span className="info-label">Versión:</span>
              <span className="info-value">4.3.0</span>
            </div>
            <div className="info-item">
              <span className="info-label">Última actualización:</span>
              <span className="info-value">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Estado:</span>
              <span className={`info-value info-value-with-icon ${esp32Connected ? 'status-online' : 'status-offline'}`}>
                <UiIcon name={esp32Connected ? 'statusOn' : 'statusOff'} className="status-icon" size={14} />
                {esp32Connected ? 'En línea' : 'Desconectado'}
              </span>
            </div>
            {lastDataReceived && (
              <div className="info-item">
                <span className="info-label">Última lectura:</span>
                <span className="info-value">{new Date(lastDataReceived).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

                <div className="settings-section scale-in">
          <h3 className="settings-heading">
            <UiIcon name="actions" className="heading-icon" />
            <span>Acciones</span>
          </h3>
          
          <div className="action-buttons">
            <button
              className="action-btn btn-secondary"
              onClick={handleReplayTutorial}
            >
              <span className="action-icon">
                <UiIcon name="info" size={16} />
              </span>
              Volver a ver el tutorial
            </button>
            <button 
              className="action-btn btn-secondary"
              onClick={handleTestConnection}
              disabled={isTestingConnection}
            >
              <span className="action-icon">
                <UiIcon name={isTestingConnection ? 'reload' : 'test'} size={16} />
              </span>
              {isTestingConnection ? 'Probando...' : 'Probar Conexion'}
            </button>
            <button
              className="action-btn btn-secondary"
              onClick={handleOpenTracking}
            >
              <span className="action-icon">
                <UiIcon name="chart" size={16} />
              </span>
              Registro y Seguimiento
            </button>
            <button
              className="action-btn btn-secondary"
              onClick={() => handlePlaceholderAction('Reiniciar sistema')}
            >
              <span className="action-icon">
                <UiIcon name="reload" size={16} />
              </span>
              Reiniciar Sistema
            </button>
            <button
              className="action-btn btn-danger"
              onClick={() => handlePlaceholderAction('Restablecer configuracion')}
            >
              <span className="action-icon">
                <UiIcon name="warning" size={16} />
              </span>
              Restablecer Configuracion
            </button>
          </div>
        </div>

        {canAccessAdmin && (
          <div className="settings-section scale-in">
            <h3 className="settings-heading">
              <UiIcon name="admin" className="heading-icon" />
              <span>Modo Administrador</span>
            </h3>
            
            <button 
              className="esp32-config-btn admin-access-btn"
              onClick={handleAdminAccess}
            >
              <div className="config-icon">
                <UiIcon name="admin" />
              </div>
              <div className="config-info">
                <div className="config-title">Acceso Administrador</div>
                <div className="config-desc">
                  Configuracion avanzada del sistema
                </div>
              </div>
              <div className="config-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
            </button>
          </div>
        )}

        <div className="settings-section scale-in account-settings-section">
          <h3>Eliminar Cuenta</h3>

          <p className="account-warning-text">
            Si eliminas tu cuenta, se borran configuracion, historial y dispositivos vinculados.
          </p>

          <button
            className="action-btn btn-danger delete-account-btn"
            onClick={requestDeleteAccount}
            disabled={isDeletingAccount}
          >
            <span>{isDeletingAccount ? '...' : '!'}</span>
            {isDeletingAccount ? 'Eliminando cuenta...' : 'Eliminar cuenta'}
          </button>
        </div>

      </div>

            {showWiFiConfig && (
        <div className="wifi-modal-overlay" onClick={() => setShowWiFiConfig(false)}>
          <div className="wifi-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="wifi-modal-header">
              <h3 className="settings-heading">
                <UiIcon name="wifi" className="heading-icon" />
                <span>Configuracion WiFi</span>
              </h3>
              <button 
                className="wifi-modal-close"
                onClick={() => setShowWiFiConfig(false)}
              >
                <UiIcon name="close" size={16} />
              </button>
            </div>
            <WiFiConfig />
          </div>
        </div>
      )}
            {showAdminPanel && (
        <AdminPanel onClose={() => setShowAdminPanel(false)} />
      )}

            {showDeviceRegistration && (
        <div className="modal-overlay" onClick={() => setShowDeviceRegistration(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDeviceRegistration(false)}>
              <UiIcon name="close" size={16} />
            </button>
            <DeviceRegistration />
          </div>
        </div>
      )}

      {showTrackingModal && (
        <div className="wifi-modal-overlay" onClick={() => setShowTrackingModal(false)}>
          <div className="wifi-modal-content tracking-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="wifi-modal-header">
              <h3>Registro y seguimiento</h3>
              <button className="wifi-modal-close" onClick={() => setShowTrackingModal(false)}>
                Cerrar
              </button>
            </div>

            <div className="tracking-modal-body">
              <p className="tracking-intro">
                Esta pantalla resume lo que paso en el sistema para que puedas entender rapido el estado y el historial.
              </p>

              <div className="tracking-summary-grid">
                <div className="tracking-summary-item">
                  <small>pH actual</small>
                  <strong>{ph.toFixed(2)}</strong>
                </div>
                <div className="tracking-summary-item">
                  <small>Estado sensor</small>
                  <strong>{esp32Connected ? 'Online' : 'Offline'}</strong>
                </div>
                <div className="tracking-summary-item">
                  <small>Ultima lectura</small>
                  <strong>{lastDataReceived ? new Date(lastDataReceived).toLocaleString() : 'Sin lectura'}</strong>
                </div>
                <div className="tracking-summary-item">
                  <small>Lecturas registradas</small>
                  <strong>{phHistory?.length || 0}</strong>
                </div>
                <div className="tracking-summary-item">
                  <small>Dosificaciones manuales</small>
                  <strong>{dosingHistory?.length || 0}</strong>
                </div>
                <div className="tracking-summary-item">
                  <small>Ultima dosificacion</small>
                  <strong>
                    {latestDosing
                      ? `${latestDosing.productName || latestDosing.product} (${latestDosing.liters}L)`
                      : 'Sin registros'}
                  </strong>
                </div>
              </div>

              <div className="tracking-section">
                <h4>Ultimas lecturas de pH</h4>
                {latestReadings.length === 0 ? (
                  <p>Sin lecturas disponibles todavia.</p>
                ) : (
                  <ul>
                    {latestReadings.map((item, index) => (
                      <li key={`${item.hour}-${index}`}>
                        <span>{item.hour}</span>
                        <strong>{Number(item.value).toFixed(2)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="tracking-section">
                <h4>Ultimas dosificaciones manuales</h4>
                {latestDosingEntries.length === 0 ? (
                  <p>Todavia no hay dosificaciones manuales registradas.</p>
                ) : (
                  <ul>
                    {latestDosingEntries.map((item, index) => (
                      <li key={`${item.timestamp}-${index}`}>
                        <span>{item.timestamp}</span>
                        <strong>{item.productName || item.product}</strong>
                        <span>{item.liters}L</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {uiMessage && (
        <ErrorNotification key={uiMessage.id} message={uiMessage.message} type={uiMessage.type} duration={5000} />
      )}

      <ConfirmDialog
        isOpen={showDeleteAccountConfirm}
        title="Eliminar cuenta"
        message="Esta accion elimina tu cuenta y todos tus datos del sistema."
        details="Se borraran configuracion, historial y dispositivos vinculados. No se puede deshacer."
        confirmLabel="Eliminar definitivamente"
        tone="danger"
        isLoading={isDeletingAccount}
        onCancel={() => setShowDeleteAccountConfirm(false)}
        onConfirm={confirmDeleteAccount}
      />
    </div>
  );
};

export default SettingsPage;







