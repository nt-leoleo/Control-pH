import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { CapacitorWifi } from '@capgo/capacitor-wifi';
import { bleProvisioning } from './bleProvisioning';
import { sendWifiResetCommand, waitForCommandConfirmation } from './esp32Communication-firebase';
import './WiFiConfig.css';

const WiFiProvisioningModal = ({ isOpen, onClose, onSuccess, userId }) => {
  const [step, setStep] = useState('start');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isScanReady, setIsScanReady] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [selectedDeviceName, setSelectedDeviceName] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [customSsid, setCustomSsid] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isScanningWifi, setIsScanningWifi] = useState(false);
  const [status, setStatus] = useState('idle');

  const targetSsid = (useCustom ? customSsid : selectedNetwork).trim();

  const isHttpsRemote = typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1';

  const canUseRemoteReset = Boolean(userId);
  const getEsp32ResetUrl = () => {
    return isHttpsRemote && !canUseRemoteReset
      ? 'http://localhost:3000/wifi/reset'
      : 'http://192.168.100.134/wifi/reset';
  };

  const resetState = useCallback(() => {
    setStep('start');
    setError('');
    setInfo('');
    setIsResetting(false);
    setIsScanReady(false);
    setResetCountdown(0);
    setDevices([]);
    setSelectedDeviceId('');
    setSelectedDeviceName('');
    setIsScanning(false);
    setNetworks([]);
    setSelectedNetwork('');
    setCustomSsid('');
    setUseCustom(false);
    setPassword('');
    setShowPassword(false);
    setIsSending(false);
    setIsScanningWifi(false);
    setStatus('idle');
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  useEffect(() => {
    let timer;
    if (resetCountdown > 0) {
      timer = setTimeout(() => setResetCountdown((value) => value - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resetCountdown]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleResetWiFi = async () => {
    setError('');
    setInfo('Iniciando reset de WiFi...');
    setIsResetting(true);

    try {
      if (canUseRemoteReset) {
        setInfo('Enviando comando de reset WiFi al ESP32 vía Firebase...');
        const result = await sendWifiResetCommand(userId);
        if (!result.success) {
          throw new Error(result.message || 'No se pudo enviar el comando de reset de WiFi.');
        }

        const confirmed = await waitForCommandConfirmation(userId, result.commandId, 45000);
        if (confirmed) {
          setInfo('✅ Comando de reset de WiFi enviado. El ESP32 empezará el reinicio y levantará el AP SensorPH_Config.');
          setStep('wifi');
          setIsScanReady(true);
        } else {
          setInfo('Comando enviado, pero no se confirmó. Si el ESP32 ya se reinició, conéctate al AP SensorPH_Config para continuar.');
        }
        return;
      }

      setInfo(isHttpsRemote ? 'Reseteando credenciales WiFi a través del proxy local...' : 'Reseteando credenciales WiFi del ESP32...');
      const resetUrl = getEsp32ResetUrl();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(resetUrl, {
        method: 'POST',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: No se pudo resetear el WiFi.`);
      }

      setInfo('✅ Credenciales reseteadas. Ahora elige la red WiFi para enviar.');
      setStep('wifi');
      setIsScanReady(true);
    } catch (err) {
      console.error('[WiFiProvisioningModal] Error reset wifi:', err);
      
      if (err.name === 'AbortError') {
        setError('Timeout: el ESP32 no responde. Verifica la conexión local o tu enlace con Firebase.');
      } else if (canUseRemoteReset) {
        setError(err?.message || 'No se pudo enviar el reset de WiFi vía Firebase. Verifica tu sesión y la vinculación del dispositivo.');
      } else if (isHttpsRemote) {
        setError('No se pudo conectar al proxy local en http://localhost:3000. Si quieres más rapidez, usa la función de reset remoto vía Firebase desde el módulo de registro de dispositivo.');
      } else {
        setError(err?.message || 'No se pudo conectar con el ESP32 en 192.168.100.134. Asegúrate de estar en la misma red.');
      }
      setInfo('');
    } finally {
      setIsResetting(false);
    }
  };

  const scanBluetoothDevices = async () => {
    setError('');
    setInfo('Escaneando dispositivos Bluetooth...');
    setDevices([]);
    setSelectedDeviceId('');
    setSelectedDeviceName('');
    setIsScanning(true);

    try {
      const found = await bleProvisioning.scanDevices(10000);
      setDevices(found);
      if (found.length === 0) {
        setError('No encontramos el ESP32. Asegurate de que esté en modo Bluetooth y vuelve a intentar.');
      } else {
        setInfo('Selecciona el ESP32 de la lista para continuar.');
      }
    } catch (err) {
      console.error('[WiFiProvisioningModal] Error scanning BLE:', err);
      setError(err?.message || 'No se pudo escanear Bluetooth.');
      setInfo('Revisa que el Bluetooth esté activo y que el ESP32 esté cerca.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectDevice = (deviceId, deviceName) => {
    setSelectedDeviceId(deviceId);
    setSelectedDeviceName(deviceName);
    setError('');
  };

  const goToWiFiStep = () => {
    if (!selectedDeviceId) {
      setError('Selecciona el ESP32 antes de continuar.');
      return;
    }
    setStep('wifi');
    setInfo('Selecciona la red WiFi y envía las credenciales por Bluetooth.');
  };

  const scanWifiNetworks = async () => {
    setError('');
    setInfo('Escaneando redes WiFi...');
    setNetworks([]);
    setSelectedNetwork('');
    setCustomSsid('');
    setUseCustom(false);
    setIsScanningWifi(true);

    try {
      if (!Capacitor.isNativePlatform()) {
        setError('En navegador web no se pueden escanear redes WiFi. Ingresa el nombre manualmente.');
        return;
      }

      try {
        const permissionStatus = await Geolocation.checkPermissions();
        if (permissionStatus.location !== 'granted') {
          await Geolocation.requestPermissions();
        }
      } catch (permErr) {
        console.warn('[WiFiProvisioningModal] Permisos de ubicación:', permErr);
      }

      try {
        const wifiState = await CapacitorWifi.isEnabled();
        if (!wifiState.enabled) {
          setError('Activa el WiFi en tu teléfono para poder buscar redes.');
          return;
        }
      } catch (wifiStateError) {
        console.warn('[WiFiProvisioningModal] Error estado WiFi:', wifiStateError);
      }

      try {
        await CapacitorWifi.removeAllListeners();
      } catch {
        // no-op
      }

      await CapacitorWifi.startScan();
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const result = await CapacitorWifi.getAvailableNetworks();
      if (result?.networks?.length > 0) {
        const availableNetworks = result.networks
          .filter((network) => network?.ssid?.trim())
          .map((network) => network.ssid);
        const uniqueNetworks = [...new Set(availableNetworks)].sort();
        setNetworks(uniqueNetworks);
        if (uniqueNetworks.length === 0) {
          setError('No se encontraron redes WiFi. Ingresa el SSID manualmente.');
        } else {
          setInfo('Selecciona una red WiFi para enviar al ESP32.');
        }
      } else {
        setError('No se encontraron redes WiFi. Ingresa el SSID manualmente.');
      }
    } catch (err) {
      console.error('[WiFiProvisioningModal] Error escaneando WiFi:', err);
      setError('No se pudo escanear redes WiFi. Ingresa el nombre de la red manualmente.');
    } finally {
      setIsScanningWifi(false);
    }
  };

  const sendWifiCredentials = async () => {
    if (!targetSsid) {
      setError('Debes seleccionar o ingresar el nombre de la red WiFi.');
      return;
    }

    setError('');
    setInfo('Enviando credenciales al ESP32...');
    setIsSending(true);
    setStatus('sending');

    try {
      const statusResult = await bleProvisioning.provisionDevice(selectedDeviceId, targetSsid, password || '');
      if (statusResult?.status === 'ok' || statusResult?.status === 'wifi_connecting') {
        setStatus('success');
        setInfo(`Credenciales enviadas. El ESP32 se está conectando a ${targetSsid}.`);
        onSuccess(targetSsid);
      } else {
        const message = statusResult?.message || 'El ESP32 no aceptó las credenciales.';
        setError(message);
        setStatus('error');
      }
    } catch (err) {
      console.error('[WiFiProvisioningModal] Error enviando credenciales BLE:', err);
      setError(err?.message || 'No se pudo enviar las credenciales por Bluetooth.');
      setStatus('error');
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="wifi-config-overlay" onClick={handleClose}>
      <div className="wifi-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wifi-config-header">
          <h2>
            {step === 'start' && 'Resetear WiFi'}
            {step === 'bluetooth' && 'Seleccionar Bluetooth'}
            {step === 'wifi' && 'Cambiar WiFi'}
          </h2>
          <button className="close-btn" onClick={handleClose} disabled={isResetting || isScanning || isSending}>✕</button>
        </div>

        <div className="wifi-config-content">
          {error && <div className="error-message">⚠️ {error}</div>}
          {info && <div className="connecting-message">{info}</div>}

          {step === 'start' && (
            <>
              <div className="connection-info">
                <p><strong>Paso 1 de 2:</strong></p>
                <ol>
                  <li>Resetear WiFi del ESP32</li>
                  <li>Seleccionar y enviar nueva red WiFi por Bluetooth</li>
                </ol>
              </div>
              <p>Al resetear WiFi, el ESP32 borrará sus credenciales WiFi almacenadas.</p>
              <button className="configure-btn" onClick={handleResetWiFi} disabled={isResetting}>
                {isResetting ? '⏳ Reseteando...' : 'Resetear WiFi'}
              </button>
              {canUseRemoteReset ? (
                <div className="info-message">
                  En producción, el reset de WiFi se envía como comando remoto vía Firebase. Asegúrate de tener el ESP32 vinculado a tu cuenta.
                </div>
              ) : isHttpsRemote ? (
                <div className="info-message">
                  Estás en HTTPS y no hay userId disponible. El reset local usa un proxy en <code>http://localhost:3000</code>.
                  Ejecuta <code>node local-esp32-proxy.js</code> en tu PC y vuelve a intentarlo.
                </div>
              ) : null}
            </>
          )}

          {step === 'bluetooth' && (
            <>
              <div className="connection-info">
                <p><strong>Paso 2 de 3:</strong></p>
                <ol>
                  <li>Busca el Bluetooth del ESP32</li>
                  <li>Selecciona el dispositivo</li>
                  <li>Pasa a Cambiar WiFi</li>
                </ol>
              </div>
              <p>El ESP32 aparece como un dispositivo BLE llamado <strong>configurar pH</strong>.</p>
              <div className="scan-section">
                <button
                  className="scan-btn"
                  onClick={scanBluetoothDevices}
                  disabled={!isScanReady || isScanning || isSending}
                >
                  {isScanning ? '🔄 Buscando...' : isScanReady ? 'Buscar dispositivos Bluetooth' : 'Preparando Bluetooth...'}
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
                        onChange={() => handleSelectDevice(device.deviceId, device.name)}
                        disabled={isSending}
                      />
                      <span className="network-name">📶 {device.name || `Dispositivo ${device.deviceId.slice(-5)}`}</span>
                    </label>
                  ))}
                </div>
              )}

              <button
                className="configure-btn"
                onClick={goToWiFiStep}
                disabled={!selectedDeviceId || isScanning || isSending}
              >
                {selectedDeviceId ? 'Cambiar WiFi →' : 'Selecciona el ESP32 primero'}
              </button>
            </>
          )}

          {step === 'wifi' && (
            <>
              <div className="connection-info">
                <p><strong>Paso 3 de 3:</strong></p>
                <ol>
                  <li>Elige la red WiFi</li>
                  <li>Ingresa la contraseña</li>
                  <li>Presiona Enviar Credenciales Wifi</li>
                </ol>
              </div>

              <p>Dispositivo seleccionado: <strong>{selectedDeviceName || selectedDeviceId}</strong></p>

              <div className="scan-section">
                <button className="scan-btn" onClick={scanWifiNetworks} disabled={isScanningWifi || isSending}>
                  {isScanningWifi ? '🔄 Escaneando redes...' : '🔍 Buscar redes disponibles'}
                </button>
              </div>

              {networks.length > 0 && (
                <div className="networks-list">
                  <h3>Redes disponibles:</h3>
                  {networks.map((network, index) => (
                    <label key={index} className="network-option">
                      <input
                        type="radio"
                        name="wifi-network"
                        value={network}
                        checked={selectedNetwork === network && !useCustom}
                        onChange={() => {
                          setSelectedNetwork(network);
                          setUseCustom(false);
                        }}
                        disabled={isSending}
                      />
                      <span className="network-name">📶 {network}</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="custom-network">
                <label className="network-option">
                  <input
                    type="radio"
                    name="wifi-network"
                    checked={useCustom}
                    onChange={() => setUseCustom(true)}
                    disabled={isSending}
                  />
                  <span>Ingresar red manualmente</span>
                </label>
                {useCustom && (
                  <div className="form-section">
                    <input
                      className="wifi-input"
                      type="text"
                      placeholder="Ej: MiWiFi-2.4G"
                      value={customSsid}
                      onChange={(e) => setCustomSsid(e.target.value)}
                      disabled={isSending}
                    />
                    <small>El nombre de red debe ser exacto.</small>
                  </div>
                )}
              </div>

              <div className="form-section">
                <label htmlFor="wifi-password"><strong>Contraseña WiFi</strong></label>
                <div className="password-wrapper">
                  <input
                    id="wifi-password"
                    className="wifi-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Contraseña (opcional)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSending}
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={isSending}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                className="configure-btn"
                onClick={sendWifiCredentials}
                disabled={!targetSsid || isSending}
              >
                {isSending ? '⏳ Enviando credenciales...' : 'Enviar Credenciales Wifi'}
              </button>
            </>
          )}

          {status === 'success' && (
            <div className="success-message">
              <div className="success-icon">✅</div>
              <h3>¡Listo!</h3>
              <p>El ESP32 recibió las credenciales y se está conectando a la red.</p>
              <button className="configure-btn" onClick={handleClose}>Cerrar</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WiFiProvisioningModal;
