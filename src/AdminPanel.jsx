import { useState, useEffect, useContext } from 'react';
import { PHContext } from './PHContext';
import { ref, onValue, off, set } from 'firebase/database';
import { database } from './firebase';
import './AdminPanel.css';

const AdminPanel = ({ onClose }) => {
  const { userConfig, saveConfigToFirebase, user } = useContext(PHContext);
  
  // Estados para configuración avanzada
  const [adminConfig, setAdminConfig] = useState({
    // Dosificación
    maxDailyDoses: 10,
    minWaitTimeBetweenDoses: 2, // horas
    checkInterval: 1, // minutos (Cloud Functions ejecuta cada 1 min)
    maxDoseVolume: 0.5, // litros
    minDoseVolume: 0.01, // litros
    correctionFactor: 0.8,
    
    // Rangos de seguridad
    minPH: 6.0,
    maxPH: 8.5,
    maxPHChange: 1.0,
    
    // Hardware
    pumpFlowRate: 60, // L/h
  });
  
  // Estado para logs en tiempo real
  const [realtimeLogs, setRealtimeLogs] = useState([]);
  const [backendStatus, setBackendStatus] = useState({
    lastCheck: null,
    lastDosing: null,
    dosingCount: 0,
    errors: [],
    currentPH: null,
    targetPH: null,
    autoMode: false
  });

  // Cargar configuración guardada
  useEffect(() => {
    if (userConfig?.adminConfig) {
      setAdminConfig(prev => ({ ...prev, ...userConfig.adminConfig }));
    }
  }, [userConfig]);

  // Monitorear estado del sistema en tiempo real desde Firebase Realtime Database
  useEffect(() => {
    if (!user) return;

    const systemStatusRef = ref(database, `users/${user.uid}/systemStatus`);
    const logsRef = ref(database, `users/${user.uid}/logs`);

    // Escuchar cambios en el estado del sistema
    const unsubscribeStatus = onValue(systemStatusRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBackendStatus(prev => ({
          ...prev,
          lastCheck: data.lastCheck,
          lastDosing: data.lastDosing,
          dosingCount: data.dosingCount || 0,
          currentPH: data.currentPH,
          targetPH: data.targetPH,
          autoMode: data.autoMode,
          errors: data.errors || []
        }));
      }
    });

    // Escuchar logs en tiempo real
    const unsubscribeLogs = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const logsArray = Object.entries(data)
          .map(([key, value]) => ({
            id: key,
            ...value
          }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 50);
        
        setRealtimeLogs(logsArray);
      }
    });

    return () => {
      off(systemStatusRef);
      off(logsRef);
    };
  }, [user]);

  const handleConfigChange = (key, value) => {
    const numValue = parseFloat(value);
    setAdminConfig(prev => ({
      ...prev,
      [key]: isNaN(numValue) ? value : numValue
    }));
  };

  const handleSaveConfig = async () => {
    try {
      // Guardar en Firestore para que Cloud Functions lo lean
      await saveConfigToFirebase({ 
        adminConfig,
        // Actualizar timestamp para que Cloud Functions sepan que hay nueva config
        configUpdatedAt: new Date().toISOString()
      });
      
      // Agregar log de cambio de configuración
      const logRef = ref(database, `users/${user.uid}/logs/${Date.now()}`);
      await set(logRef, {
        timestamp: new Date().toISOString(),
        type: 'success',
        message: 'Configuracion de administrador actualizada',
        data: adminConfig
      });
      
      alert('Configuracion guardada correctamente. Las Cloud Functions usaran esta configuracion.');
    } catch (error) {
      console.error('Error guardando configuracion:', error);
      alert('Error guardando configuracion: ' + error.message);
    }
  };

  const handleResetConfig = () => {
    if (confirm('Estas seguro de restablecer la configuracion a valores por defecto?')) {
      setAdminConfig({
        maxDailyDoses: 10,
        minWaitTimeBetweenDoses: 2,
        checkInterval: 5,
        maxDoseVolume: 0.5,
        minDoseVolume: 0.01,
        correctionFactor: 0.8,
        minPH: 6.0,
        maxPH: 8.5,
        maxPHChange: 1.0,
        pumpFlowRate: 60,
      });
    }
  };

  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel">
        {/* Header */}
        <div className="admin-header">
          <h2>🔐 Panel de Administrador</h2>
          <button className="admin-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Contenido con scroll */}
        <div className="admin-content">
          
          {/* Configuración de Dosificación */}
          <div className="admin-section">
            <h3>💊 Configuracion de Dosificacion</h3>
            
            <div className="admin-grid">
              <div className="admin-field">
                <label>Dosis maximas diarias</label>
                <input
                  type="number"
                  value={adminConfig.maxDailyDoses}
                  onChange={(e) => handleConfigChange('maxDailyDoses', e.target.value)}
                  min="1"
                  max="50"
                />
                <span className="field-unit">dosis/dia</span>
              </div>

              <div className="admin-field">
                <label>Tiempo minimo entre dosis (Espera de mezcla)</label>
                <input
                  type="number"
                  value={adminConfig.minWaitTimeBetweenDoses}
                  onChange={(e) => handleConfigChange('minWaitTimeBetweenDoses', e.target.value)}
                  min="0.01"
                  max="24"
                  step="0.01"
                />
                <span className="field-unit">horas</span>
                <span className="field-help">
                  Tiempo que espera el sistema despues de dosificar para que el quimico se mezcle con el agua.
                </span>
                <div className="quick-buttons">
                  <button 
                    type="button"
                    className="quick-btn"
                    onClick={() => handleConfigChange('minWaitTimeBetweenDoses', 0)}
                  >
                    Sin espera
                  </button>
                  <button 
                    type="button"
                    className="quick-btn"
                    onClick={() => handleConfigChange('minWaitTimeBetweenDoses', 0.016)}
                  >
                    1 min
                  </button>
                  <button 
                    type="button"
                    className="quick-btn"
                    onClick={() => handleConfigChange('minWaitTimeBetweenDoses', 0.083)}
                  >
                    5 min
                  </button>
                  <button 
                    type="button"
                    className="quick-btn"
                    onClick={() => handleConfigChange('minWaitTimeBetweenDoses', 0.25)}
                  >
                    15 min
                  </button>
                  <button 
                    type="button"
                    className="quick-btn"
                    onClick={() => handleConfigChange('minWaitTimeBetweenDoses', 0.5)}
                  >
                    30 min
                  </button>
                  <button 
                    type="button"
                    className="quick-btn"
                    onClick={() => handleConfigChange('minWaitTimeBetweenDoses', 1)}
                  >
                    1 hora
                  </button>
                  <button 
                    type="button"
                    className="quick-btn"
                    onClick={() => handleConfigChange('minWaitTimeBetweenDoses', 2)}
                  >
                    2 horas
                  </button>
                </div>
              </div>

              <div className="admin-field">
                <label>Intervalo de verificacion</label>
                <input
                  type="number"
                  value={adminConfig.checkInterval}
                  onChange={(e) => handleConfigChange('checkInterval', e.target.value)}
                  min="0"
                  max="60"
                />
                <span className="field-unit">minutos</span>
                <small style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85em', display: 'block', marginTop: '4px' }}>
                  Nota: Cloud Functions tiene un mínimo de 1 minuto. Valores menores se ajustarán automáticamente.
                </small>
              </div>

              <div className="admin-field">
                <label>Volumen maximo por dosis</label>
                <input
                  type="number"
                  value={adminConfig.maxDoseVolume}
                  onChange={(e) => handleConfigChange('maxDoseVolume', e.target.value)}
                  min="0.01"
                  max="5"
                  step="0.01"
                />
                <span className="field-unit">litros</span>
              </div>

              <div className="admin-field">
                <label>Volumen minimo por dosis</label>
                <input
                  type="number"
                  value={adminConfig.minDoseVolume}
                  onChange={(e) => handleConfigChange('minDoseVolume', e.target.value)}
                  min="0.001"
                  max="0.1"
                  step="0.001"
                />
                <span className="field-unit">litros</span>
              </div>

              <div className="admin-field">
                <label>Factor de correccion</label>
                <input
                  type="number"
                  value={adminConfig.correctionFactor}
                  onChange={(e) => handleConfigChange('correctionFactor', e.target.value)}
                  min="0.1"
                  max="1"
                  step="0.05"
                />
                <span className="field-unit">%</span>
              </div>
            </div>
          </div>

          {/* Rangos de Seguridad */}
          <div className="admin-section">
            <h3>⚠️ Rangos de Seguridad</h3>
            
            <div className="safety-warning">
              <strong>⚠️ IMPORTANTE:</strong> Estos valores evitan que el sistema dosifique si detecta condiciones peligrosas.
              Si el pH objetivo esta fuera de estos rangos, el sistema NO dosificara.
            </div>
            
            <div className="admin-grid">
              <div className="admin-field">
                <label>pH minimo permitido</label>
                <input
                  type="number"
                  value={adminConfig.minPH}
                  onChange={(e) => handleConfigChange('minPH', e.target.value)}
                  min="4"
                  max="7"
                  step="0.1"
                />
                <span className="field-unit">pH</span>
              </div>

              <div className="admin-field">
                <label>pH maximo permitido</label>
                <input
                  type="number"
                  value={adminConfig.maxPH}
                  onChange={(e) => handleConfigChange('maxPH', e.target.value)}
                  min="7"
                  max="10"
                  step="0.1"
                />
                <span className="field-unit">pH</span>
              </div>

              <div className="admin-field">
                <label>Cambio maximo de pH por dosificacion</label>
                <input
                  type="number"
                  value={adminConfig.maxPHChange}
                  onChange={(e) => handleConfigChange('maxPHChange', e.target.value)}
                  min="0.1"
                  max="5"
                  step="0.1"
                />
                <span className="field-unit">pH</span>
                <span className="field-help">
                  Si la desviacion del pH es mayor a este valor, el sistema NO dosificara.
                  Aumenta este valor si tu pH esta muy desviado del objetivo.
                </span>
              </div>
            </div>
          </div>

          {/* Configuración de Hardware */}
          <div className="admin-section">
            <h3>🔧 Configuracion de Hardware</h3>
            
            <div className="admin-grid">
              <div className="admin-field">
                <label>Caudal de la bomba</label>
                <input
                  type="number"
                  value={adminConfig.pumpFlowRate}
                  onChange={(e) => handleConfigChange('pumpFlowRate', e.target.value)}
                  min="1"
                  max="300"
                />
                <span className="field-unit">L/h</span>
              </div>
            </div>
          </div>

          {/* Estado del Backend */}
          <div className="admin-section">
            <h3>📊 Estado del Backend</h3>
            
            <div className="backend-status">
              <div className="status-item">
                <span className="status-label">Ultima verificacion:</span>
                <span className="status-value">
                  {backendStatus.lastCheck ? new Date(backendStatus.lastCheck).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Ultima dosificacion:</span>
                <span className="status-value">
                  {backendStatus.lastDosing ? new Date(backendStatus.lastDosing).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Dosificaciones hoy:</span>
                <span className="status-value">{backendStatus.dosingCount}</span>
              </div>
              <div className="status-item">
                <span className="status-label">pH Actual:</span>
                <span className="status-value">
                  {backendStatus.currentPH ? backendStatus.currentPH.toFixed(2) : 'N/A'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">pH Objetivo:</span>
                <span className="status-value">
                  {backendStatus.targetPH ? backendStatus.targetPH.toFixed(2) : 'N/A'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Modo Automatico:</span>
                <span className={`status-value ${backendStatus.autoMode ? 'status-active' : 'status-inactive'}`}>
                  {backendStatus.autoMode ? '✅ Activo' : '❌ Inactivo'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Errores:</span>
                <span className="status-value error">{backendStatus.errors.length}</span>
              </div>
            </div>
          </div>

          {/* Logs en Tiempo Real */}
          <div className="admin-section">
            <h3>📡 Logs en Tiempo Real</h3>
            
            <div className="realtime-logs">
              {realtimeLogs.length === 0 ? (
                <div className="no-logs">No hay logs disponibles</div>
              ) : (
                realtimeLogs.map((log, index) => (
                  <div key={index} className={`log-entry log-${log.type}`}>
                    <span className="log-time">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="log-message">{log.message}</span>
                    {log.data && (
                      <pre className="log-data">{JSON.stringify(log.data, null, 2)}</pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="admin-actions">
            <button className="admin-btn btn-primary" onClick={handleSaveConfig}>
              💾 Guardar Configuracion
            </button>
            <button className="admin-btn btn-secondary" onClick={handleResetConfig}>
              🔄 Restablecer Valores
            </button>
            <button className="admin-btn btn-danger" onClick={onClose}>
              ❌ Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
