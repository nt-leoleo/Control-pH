import { useContext, useState } from 'react';
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

  const handleToleranceChange = (e) => {
    const value = parseFloat(e.target.value);
    if (value >= 6 && value <= 8) {
      setPhTolerance(value);
    }
  };

  const handleRangeChange = (e) => {
    const value = parseFloat(e.target.value);
    if (value >= 0.1 && value <= 1) {
      setPhToleranceRange(value);
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
            <div className="setting-control">
              <input
                type="number"
                min="6"
                max="8"
                step="0.1"
                value={phTolerance}
                onChange={handleToleranceChange}
                className="setting-input"
              />
              <span className="setting-unit">pH</span>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              Tolerancia
              <span className="setting-description">Rango permitido de variación (±)</span>
            </label>
            <div className="setting-control">
              <input
                type="number"
                min="0.1"
                max="1"
                step="0.1"
                value={phToleranceRange}
                onChange={handleRangeChange}
                className="setting-input"
              />
              <span className="setting-unit">±pH</span>
            </div>
          </div>

          <div className="ph-preview">
            <div className="ph-range">
              <span className="range-label">Rango Aceptable:</span>
              <span className="range-value">
                {(phTolerance - phToleranceRange).toFixed(1)} - {(phTolerance + phToleranceRange).toFixed(1)} pH
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
              onClick={() => setDosingMode('automatic')}
            >
              <div className="mode-icon">🤖</div>
              <div className="mode-info">
                <div className="mode-title">Automático</div>
                <div className="mode-desc">El sistema ajusta el pH automáticamente</div>
              </div>
            </button>

            <button
              className={`dosing-mode-btn ${dosingMode === 'manual' ? 'active' : ''}`}
              onClick={() => setDosingMode('manual')}
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