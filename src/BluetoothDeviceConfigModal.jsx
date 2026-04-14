import { useState } from 'react';
import { bleProvisioning } from './bleProvisioning';
import './BluetoothDeviceConfigModal.css';

const BluetoothDeviceConfigModal = ({ isOpen, onClose, ssid, password, onSuccess }) => {
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleScanDevices = async () => {
    setIsScanning(true);
    setError('');
    setDevices([]);
    setSelectedDeviceId('');
    try {
      const found = await bleProvisioning.scanDevices(8000);
      setDevices(found);
      if (found.length === 0) {
        setError('No encontramos dispositivos cerca. Acerca el telefono al ESP32 e intenta otra vez.');
      }
    } catch (err) {
      setError(err?.message || 'No se pudo escanear Bluetooth.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSend = async () => {
    if (!selectedDeviceId) {
      setError('Selecciona un dispositivo Bluetooth para continuar.');
      return;
    }

    setIsSending(true);
    setError('');
    try {
      const status = await bleProvisioning.provisionDevice(selectedDeviceId, ssid, password || '');
      if (status?.status === 'ok' || status?.status === 'wifi_connecting') {
        onSuccess(ssid);
        return;
      }
      setError(status?.message || 'El ESP32 no acepto las credenciales.');
    } catch (err) {
      setError(err?.message || 'No se pudo enviar la configuracion al dispositivo.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="wifi-config-overlay" onClick={onClose}>
      <div className="wifi-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wifi-config-header">
          <h2>Enviar por Bluetooth</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="wifi-config-content">
          {error && <div className="error-message">⚠️ {error}</div>}

          <div className="connection-info">
            <p><strong>Paso 2 de 2:</strong></p>
            <ol>
              <li>Busca dispositivos Bluetooth</li>
              <li>Selecciona tu ESP32</li>
              <li>Envía la configuración</li>
            </ol>
            <p><strong>Red elegida:</strong> {ssid}</p>
          </div>

          <div className="scan-section">
            <button
              className="scan-btn"
              onClick={handleScanDevices}
              disabled={isScanning || isSending}
            >
              {isScanning ? '🔄 Buscando dispositivos...' : '📲 Buscar dispositivos Bluetooth'}
            </button>
          </div>

          {devices.length > 0 && (
            <div className="networks-list">
              <h3>Dispositivos encontrados:</h3>
              {devices.map((device) => (
                <label key={device.deviceId} className="network-option">
                  <input
                    type="radio"
                    name="ble-device"
                    value={device.deviceId}
                    checked={selectedDeviceId === device.deviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    disabled={isSending}
                  />
                  <span className="network-name">📶 {device.name}</span>
                </label>
              ))}
            </div>
          )}

          <button
            className="configure-btn"
            onClick={handleSend}
            disabled={isSending || !selectedDeviceId}
          >
            {isSending ? '⏳ Enviando...' : '💾 Enviar configuración al ESP32'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BluetoothDeviceConfigModal;

