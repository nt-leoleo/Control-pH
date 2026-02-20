import { useEffect, useState } from 'react';
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './useAuth';
import './DeviceRegistration.css';

const DeviceRegistration = () => {
  const { user } = useAuth();
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('Piscina Principal');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState(null);
  const [registeredDevices, setRegisteredDevices] = useState([]);

  useEffect(() => {
    if (user?.uid) {
      loadUserDevices();
    } else {
      setRegisteredDevices([]);
    }
  }, [user?.uid]);

  const loadUserDevices = async () => {
    if (!user?.uid) return;

    try {
      const [linkedByArray, linkedLegacy] = await Promise.all([
        getDocs(query(collection(db, 'devices'), where('userIds', 'array-contains', user.uid))),
        getDocs(query(collection(db, 'devices'), where('userId', '==', user.uid)))
      ]);

      const merged = new Map();
      linkedByArray.forEach((snap) => {
        merged.set(snap.id, { id: snap.id, ...snap.data() });
      });
      linkedLegacy.forEach((snap) => {
        merged.set(snap.id, { id: snap.id, ...snap.data() });
      });

      const devices = Array.from(merged.values());
      setRegisteredDevices(devices);

      if (devices.length > 0) {
        localStorage.setItem('esp32_device_id', devices[0].id);
      }
    } catch (error) {
      console.error('Error cargando dispositivos:', error);
    }
  };

  const handleDelete = async (deviceIdToDelete) => {
    if (!window.confirm('Estas seguro de que quieres desvincular este dispositivo?')) {
      return;
    }

    try {
      const deviceRef = doc(db, 'devices', deviceIdToDelete);
      const deviceSnap = await getDoc(deviceRef);

      if (!deviceSnap.exists()) {
        setMessage({ type: 'info', text: 'El dispositivo ya no existe.' });
        await loadUserDevices();
        return;
      }

      const deviceData = deviceSnap.data();
      const linkedUserIds = Array.isArray(deviceData.userIds) ? deviceData.userIds : [];
      const hasLinkedArray = linkedUserIds.length > 0;

      if (hasLinkedArray && linkedUserIds.length > 1) {
        await updateDoc(deviceRef, {
          userIds: arrayRemove(user.uid),
          updatedAt: new Date()
        });
      } else if (hasLinkedArray && linkedUserIds.length === 1) {
        await deleteDoc(deviceRef);
      } else if (deviceData.userId === user.uid) {
        await deleteDoc(deviceRef);
      }

      if (localStorage.getItem('esp32_device_id') === deviceIdToDelete) {
        localStorage.removeItem('esp32_device_id');
      }

      await loadUserDevices();
      setMessage({ type: 'success', text: 'Dispositivo desvinculado correctamente.' });
    } catch (error) {
      console.error('Error eliminando dispositivo:', error);
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();

    if (!deviceId.trim()) {
      setMessage({ type: 'error', text: 'Ingresa el Device ID del ESP32.' });
      return;
    }

    if (!user?.uid) {
      setMessage({ type: 'error', text: 'Debes iniciar sesion para registrar un dispositivo.' });
      return;
    }

    setIsRegistering(true);
    setMessage(null);

    try {
      const normalizedDeviceId = deviceId.trim().toUpperCase();
      const deviceRef = doc(db, 'devices', normalizedDeviceId);
      const deviceSnap = await getDoc(deviceRef);

      if (deviceSnap.exists()) {
        await updateDoc(deviceRef, {
          userIds: arrayUnion(user.uid),
          updatedAt: new Date(),
          lastSeen: new Date()
        });
      } else {
        await setDoc(deviceRef, {
          userId: user.uid,
          userIds: [user.uid],
          name: deviceName.trim() || 'Piscina Principal',
          createdAt: new Date(),
          lastSeen: new Date(),
          metadata: {
            registeredFrom: 'web-app',
            userEmail: user.email || ''
          }
        });
      }

      localStorage.setItem('esp32_device_id', normalizedDeviceId);
      await loadUserDevices();

      setDeviceId('');
      setDeviceName('Piscina Principal');
      setMessage({ type: 'success', text: `Dispositivo vinculado: ${normalizedDeviceId}` });
    } catch (error) {
      console.error('Error registrando dispositivo:', error);
      setMessage({ type: 'error', text: `Error: ${error.message}` });
    } finally {
      setIsRegistering(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="device-registration">
      <div className="registration-header">
        <h3>Registro de Dispositivo ESP32</h3>
        <p>Un mismo Device ID puede vincularse a varias cuentas.</p>
      </div>

      {registeredDevices.length > 0 ? (
        <div className="registered-devices">
          <h4>Dispositivos vinculados:</h4>
          {registeredDevices.map((device) => (
            <div key={device.id} className="device-card">
              <div className="device-info">
                <span className="device-icon">📱</span>
                <div>
                  <strong>{device.name || 'Dispositivo'}</strong>
                  <small>ID: {device.id}</small>
                </div>
              </div>
              <div className="device-actions">
                <span className="device-status">Activo</span>
                <button className="delete-btn" onClick={() => handleDelete(device.id)} title="Desvincular dispositivo">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleRegister} className="registration-form">
          <div className="form-group">
            <label>Device ID del ESP32:</label>
            <input
              type="text"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
              placeholder="Ej: A1B2C3D4E5F6"
              disabled={isRegistering}
              className="device-id-input"
            />
            <small className="help-text">Lo ves en el Serial Monitor del ESP32 (115200).</small>
          </div>

          <div className="form-group">
            <label>Nombre del dispositivo:</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Ej: Piscina Principal"
              disabled={isRegistering}
            />
          </div>

          <button type="submit" className="register-btn" disabled={isRegistering}>
            {isRegistering ? 'Registrando...' : 'Vincular dispositivo'}
          </button>
        </form>
      )}

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      <div className="registration-help">
        <h4>Instrucciones:</h4>
        <ol>
          <li>Conecta tu ESP32 a la computadora.</li>
          <li>Abre el Serial Monitor a 115200.</li>
          <li>Reinicia el ESP32.</li>
          <li>Copia el Device ID y pegalo arriba.</li>
        </ol>
      </div>
    </div>
  );
};

export default DeviceRegistration;
