import { useState, useEffect, useContext, useCallback } from 'react';
import { PHContext } from './PHContext';
import { ref, onValue, off, set } from 'firebase/database';
import { collection, getDocs } from 'firebase/firestore';
import { database, db, auth } from './firebase';
import './AdminPanel.css';

const DEFAULT_ADMIN_CONFIG = {
  maxDailyDoses: 10,
  minWaitTimeBetweenDoses: 2,
  checkInterval: 1,
  maxManualDosingSeconds: 300,
  maxDoseVolume: 0.5,
  minDoseVolume: 0.01,
  correctionFactor: 0.8,
  minPH: 0.0,
  maxPH: 14.0,
  maxPHChange: 1.0,
  pumpFlowRate: 60,
};

const CLOUD_FUNCTIONS_BASE =
  import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL ||
  'https://us-central1-control-ph-82951.cloudfunctions.net';

const AdminPanel = ({ onClose }) => {
  const { userConfig, saveConfigToFirebase, user } = useContext(PHContext);

  const [adminConfig, setAdminConfig] = useState(DEFAULT_ADMIN_CONFIG);
  const [realtimeLogs, setRealtimeLogs] = useState([]);
  const [backendStatus, setBackendStatus] = useState({
    lastCheck: null,
    lastDosing: null,
    dosingCount: 0,
    errors: [],
    currentPH: null,
    targetPH: null,
    autoMode: false,
  });

  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  useEffect(() => {
    if (userConfig?.adminConfig) {
      setAdminConfig((previous) => ({ ...previous, ...userConfig.adminConfig }));
    }
  }, [userConfig]);

  useEffect(() => {
    if (!user?.uid) return;

    const systemStatusRef = ref(database, `users/${user.uid}/systemStatus`);
    const logsRef = ref(database, `users/${user.uid}/logs`);

    onValue(systemStatusRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      setBackendStatus((previous) => ({
        ...previous,
        lastCheck: data.lastCheck,
        lastDosing: data.lastDosing,
        dosingCount: data.dosingCount || 0,
        currentPH: data.currentPH,
        targetPH: data.targetPH,
        autoMode: data.autoMode,
        errors: data.errors || [],
      }));
    });

    onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;

      const logsArray = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50);

      setRealtimeLogs(logsArray);
    });

    return () => {
      off(systemStatusRef);
      off(logsRef);
    };
  }, [user?.uid]);

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const loadedUsers = usersSnapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => {
          const aName = (a.displayName || a.email || a.id).toLowerCase();
          const bName = (b.displayName || b.email || b.id).toLowerCase();
          return aName.localeCompare(bName);
        });
      setUsers(loadedUsers);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      alert('No se pudieron cargar los usuarios.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleConfigChange = (key, value) => {
    const numValue = parseFloat(value);
    setAdminConfig((previous) => ({
      ...previous,
      [key]: Number.isNaN(numValue) ? value : numValue,
    }));
  };

  const handleSaveConfig = async () => {
    try {
      await saveConfigToFirebase({
        adminConfig,
        configUpdatedAt: new Date().toISOString(),
      });

      const logRef = ref(database, `users/${user.uid}/logs/${Date.now()}`);
      await set(logRef, {
        timestamp: new Date().toISOString(),
        type: 'success',
        message: 'Configuracion de administrador actualizada',
        data: adminConfig,
      });

      alert('Configuracion guardada correctamente.');
    } catch (error) {
      console.error('Error guardando configuracion:', error);
      alert(`Error guardando configuracion: ${error.message}`);
    }
  };

  const handleResetConfig = () => {
    if (window.confirm('Estas seguro de restablecer la configuracion a valores por defecto?')) {
      setAdminConfig({ ...DEFAULT_ADMIN_CONFIG, checkInterval: 5 });
    }
  };

  const deleteUserCompletely = async (targetUserId) => {
    const currentAuthUser = auth.currentUser;
    if (!currentAuthUser) {
      throw new Error('Sesion expirada. Vuelve a iniciar sesion.');
    }

    const token = await currentAuthUser.getIdToken();
    const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/deleteUserCompletely`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ targetUserId }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return response.json();
  };

  const handleDeleteUser = async (targetUser) => {
    if (!targetUser?.id) return;

    const identity = targetUser.displayName || targetUser.email || targetUser.id;
    const confirmed = window.confirm(
      `Vas a eliminar completamente al usuario ${identity}.\n\nSe borrara Firestore, Realtime DB, dispositivos vinculados y Firebase Auth.`
    );
    if (!confirmed) return;

    setDeletingUserId(targetUser.id);
    try {
      await deleteUserCompletely(targetUser.id);
      setUsers((previous) => previous.filter((item) => item.id !== targetUser.id));
      alert('Usuario eliminado completamente.');
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      alert(`No se pudo eliminar el usuario: ${error.message}`);
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel">
        <div className="admin-header">
          <h2>Panel de Administrador</h2>
          <button className="admin-close-btn" onClick={onClose}>x</button>
        </div>

        <div className="admin-content">
          <div className="admin-section">
            <h3>Configuracion de Dosificacion</h3>

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
                <label>Tiempo minimo entre dosis (espera de mezcla)</label>
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
              </div>

              <div className="admin-field">
                <label>Tiempo maximo dosificado manual</label>
                <input
                  type="number"
                  value={adminConfig.maxManualDosingSeconds}
                  onChange={(e) => handleConfigChange('maxManualDosingSeconds', e.target.value)}
                  min="1"
                  max="3600"
                  step="1"
                />
                <span className="field-unit">segundos</span>
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

          <div className="admin-section">
            <h3>Rangos de Seguridad</h3>

            <div className="safety-warning">
              <strong>Importante:</strong> Estos valores evitan que el sistema dosifique en condiciones peligrosas.
            </div>

            <div className="admin-grid">
              <div className="admin-field">
                <label>pH minimo permitido</label>
                <input
                  type="number"
                  value={adminConfig.minPH}
                  onChange={(e) => handleConfigChange('minPH', e.target.value)}
                  min="0"
                  max="14"
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
                  min="0"
                  max="14"
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
              </div>
            </div>
          </div>

          <div className="admin-section">
            <h3>Configuracion de Hardware</h3>

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

          <div className="admin-section">
            <h3>Estado del Backend</h3>

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
                <span className="status-label">pH actual:</span>
                <span className="status-value">
                  {backendStatus.currentPH ? backendStatus.currentPH.toFixed(2) : 'N/A'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">pH objetivo:</span>
                <span className="status-value">
                  {backendStatus.targetPH ? backendStatus.targetPH.toFixed(2) : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <div className="admin-section">
            <h3>Usuarios registrados</h3>

            {isLoadingUsers ? (
              <div className="no-logs">Cargando usuarios...</div>
            ) : users.length === 0 ? (
              <div className="no-logs">No hay usuarios registrados</div>
            ) : (
              <div className="admin-users-list">
                {users.map((registeredUser) => (
                  <div key={registeredUser.id} className="admin-user-item">
                    <div className="admin-user-meta">
                      <strong>{registeredUser.displayName || 'Sin nombre'}</strong>
                      <span>{registeredUser.email || 'Sin email'}</span>
                      <small>ID: {registeredUser.id}</small>
                    </div>
                    <button
                      className="admin-user-delete"
                      onClick={() => handleDeleteUser(registeredUser)}
                      disabled={deletingUserId === registeredUser.id}
                    >
                      {deletingUserId === registeredUser.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-section">
            <h3>Logs en Tiempo Real</h3>

            <div className="realtime-logs">
              {realtimeLogs.length === 0 ? (
                <div className="no-logs">No hay logs disponibles</div>
              ) : (
                realtimeLogs.map((log) => (
                  <div key={log.id} className={`log-entry log-${log.type}`}>
                    <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="log-message">{log.message}</span>
                    {log.data && <pre className="log-data">{JSON.stringify(log.data, null, 2)}</pre>}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="admin-actions">
            <button className="admin-btn btn-primary" onClick={handleSaveConfig}>
              Guardar configuracion
            </button>
            <button className="admin-btn btn-secondary" onClick={handleResetConfig}>
              Restablecer valores
            </button>
            <button className="admin-btn btn-danger" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
