import { useContext, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
import WiFiConfig from './WiFiConfig';
import './SettingsPage.css';

const SettingsPage = ({ onBack }) => {
  const { 
    phTolerance, 
    setPhTolerance, 
    phToleranceRange, 
    setPhToleranceRange,
    dosingMode,
    setDosingMode,
    esp32Connected,
    lastDataReceived,
    fetchPHData,
    checkConnection
  } = useContext(PHContext);
  
  const [showWiFiConfig, setShowWiFiConfig] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // Estados locales para sliders suaves (sin lag)
  const [localPhTolerance, setLocalPhTolerance] = useState(phTolerance);
  const [localPhToleranceRange, setLocalPhToleranceRange] = useState(phToleranceRange);

  // Sincronizar estados locales cuando cambian los valores del contexto
  useEffect(() => {
    setLocalPhTolerance(phTolerance);
  }, [phTolerance]);

  useEffect(() => {
    setLocalPhToleranceRange(phToleranceRange);
  }, [phToleranceRange]);

  // Debounce para pH tolerance (guardar 500ms después de que pare de mover)
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (localPhTolerance !== phTolerance && localPhTolerance >= 0 && localPhTolerance <= 14) {
        try {
          console.log('💾 [SettingsPage] Guardando pH tolerance (debounced):', localPhTolerance);
          await setPhTolerance(localPhTolerance);
        } catch (error) {
          console.error('❌ [Settings] Error guardando pH tolerance:', error);
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localPhTolerance, phTolerance, setPhTolerance]);

  // Debounce para pH tolerance range (guardar 500ms después de que pare de mover)
  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      if (localPhToleranceRange !== phToleranceRange && localPhToleranceRange > 0 && localPhToleranceRange <= 5) {
        try {
          console.log('💾 [SettingsPage] Guardando pH tolerance range (debounced):', localPhToleranceRange);
          await setPhToleranceRange(localPhToleranceRange);
        } catch (error) {
          console.error('❌ [Settings] Error guardando pH tolerance range:', error);
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [localPhToleranceRange, phToleranceRange, setPhToleranceRange]);

  // Debug logs
  useEffect(() => {
    console.log('⚙️ [SettingsPage] Componente renderizado:', {
      phTolerance,
      phToleranceRange,
      localPhTolerance,
      localPhToleranceRange,
      dosingMode,
      esp32Connected,
      lastDataReceived: lastDataReceived ? lastDataReceived.toLocaleString() : 'Nunca',
      setPhTolerance: typeof setPhTolerance,
      setPhToleranceRange: typeof setPhToleranceRange
    });
  }, [phTolerance, phToleranceRange, localPhTolerance, localPhToleranceRange, dosingMode, esp32Connected, lastDataReceived]);

  const handleToleranceChange = (e) => {
    const value = parseFloat(e.target.value);
    console.log('🎯 [SettingsPage] Cambiando tolerancia (local):', value);
    
    if (!isNaN(value) && value >= 0 && value <= 14) {
      setLocalPhTolerance(value); // Cambio inmediato sin lag
    } else {
      console.warn('⚠️ [SettingsPage] Valor de tolerancia inválido:', value);
    }
  };

  const handleRangeChange = (e) => {
    const value = parseFloat(e.target.value);
    console.log('🎯 [SettingsPage] Cambiando rango (local):', value);
    
    if (!isNaN(value) && value > 0 && value <= 5) {
      setLocalPhToleranceRange(value); // Cambio inmediato sin lag
    } else {
      console.warn('⚠️ [SettingsPage] Valor de rango inválido:', value);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      console.log('🧪 [Settings] Probando conexión manual...');
      await checkConnection();
      await fetchPHData();
      console.log('✅ [Settings] Test de conexión completado');
    } catch (error) {
      console.error('❌ [Settings] Error en test de conexión:', error);
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="settings-page fade-in">
      {/* Header */}
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
        <h1 className="settings-title">⚙️ Configuración</h1>
      </div>

      {/* Contenido */}
      <div className="settings-content">
        
        {/* Configuración de pH */}
        <div className="settings-section scale-in">
          <h3>🧪 Configuración de pH</h3>
          
          <div className="setting-item">
            <label className="setting-label">
              pH Objetivo
              <span className="setting-description">Valor ideal de pH para la piscina</span>
            </label>
            <div className="setting-control-slider">
              <div className="slider-container">
                <input
                  type="range"
                  min="0"
                  max="14"
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
                  min="0"
                  max="14"
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
                  min="0.1"
                  max="5"
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
                  min="0.1"
                  max="5"
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
        </div>

        {/* Modo de Dosificación */}
        <div className="settings-section scale-in">
          <h3>💊 Modo de Dosificación</h3>
          
          <div className="dosing-modes">
            <button
              className={`dosing-mode-btn ${dosingMode === 'automatic' ? 'active' : ''}`}
              onClick={async () => {
                try {
                  await setDosingMode('automatic');
                } catch (error) {
                  console.error('❌ [Settings] Error cambiando a modo automático:', error);
                }
              }}
            >
              <div className="mode-icon">🤖</div>
              <div className="mode-info">
                <div className="mode-title">Automático</div>
                <div className="mode-desc">El sistema ajusta el pH automáticamente</div>
              </div>
            </button>

            <button
              className={`dosing-mode-btn ${dosingMode === 'manual' ? 'active' : ''}`}
              onClick={async () => {
                try {
                  await setDosingMode('manual');
                } catch (error) {
                  console.error('❌ [Settings] Error cambiando a modo manual:', error);
                }
              }}
            >
              <div className="mode-icon">👤</div>
              <div className="mode-info">
                <div className="mode-title">Manual</div>
                <div className="mode-desc">Control manual de la dosificación</div>
              </div>
            </button>
          </div>
        </div>

        {/* Configuración ESP32 */}
        <div className="settings-section scale-in">
          <h3>📡 Configuración ESP32</h3>
          
          <button 
            className="esp32-config-btn"
            onClick={() => setShowWiFiConfig(true)}
          >
            <div className="config-icon">📶</div>
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

        {/* Administración de Piscinas */}
        <div className="settings-section scale-in">
          <h3>🏊 Gestión de Piscinas</h3>
          
          <button 
            className="esp32-config-btn"
            onClick={() => window.location.hash = 'pool-manager'}
          >
            <div className="config-icon">🏊</div>
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

        {/* Información del Sistema */}
        <div className="settings-section scale-in">
          <h3>ℹ️ Información del Sistema</h3>
          
          <div className="system-info">
            <div className="info-item">
              <span className="info-label">Versión:</span>
              <span className="info-value">3.0.0</span>
            </div>
            <div className="info-item">
              <span className="info-label">Última actualización:</span>
              <span className="info-value">{new Date().toLocaleDateString()}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Estado:</span>
              <span className={`info-value ${esp32Connected ? 'status-online' : 'status-offline'}`}>
                {esp32Connected ? '🟢 En línea' : '🔴 Desconectado'}
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

        {/* Acciones */}
        <div className="settings-section scale-in">
          <h3>🔧 Acciones</h3>
          
          <div className="action-buttons">
            <button 
              className="action-btn btn-secondary"
              onClick={handleTestConnection}
              disabled={isTestingConnection}
            >
              <span>{isTestingConnection ? '🔄' : '🧪'}</span>
              {isTestingConnection ? 'Probando...' : 'Probar Conexión'}
            </button>
            <button className="action-btn btn-secondary">
              <span>📊</span>
              Ver Estadísticas
            </button>
            <button className="action-btn btn-secondary">
              <span>🔄</span>
              Reiniciar Sistema
            </button>
            <button className="action-btn btn-danger">
              <span>⚠️</span>
              Restablecer Configuración
            </button>
          </div>
        </div>

      </div>

      {/* Modal WiFi Config */}
      {showWiFiConfig && (
        <div className="wifi-modal-overlay" onClick={() => setShowWiFiConfig(false)}>
          <div className="wifi-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="wifi-modal-header">
              <h3>📶 Configuración WiFi</h3>
              <button 
                className="wifi-modal-close"
                onClick={() => setShowWiFiConfig(false)}
              >
                ✕
              </button>
            </div>
            <WiFiConfig />
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;