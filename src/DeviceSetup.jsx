import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from './useAuth';
import './DeviceSetup.css';

export default function DeviceSetup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [step, setStep] = useState(0); // 0: verificar, 1: instrucciones, 2: escanear, 3: contraseña, 4: configurando, 5: éxito
  const [networks, setNetworks] = useState([]);
  const [selectedSsid, setSelectedSsid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [useManual, setUseManual] = useState(false);

  // Obtener deviceId del QR si viene en la URL
  useEffect(() => {
    const id = searchParams.get('deviceId');
    if (id) {
      setDeviceId(id);
    }
  }, [searchParams]);

  // Escanear redes WiFi que el ESP32 puede detectar
  const scanNetworks = async () => {
    setIsScanning(true);
    setError('');
    setNetworks([]);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch('http://192.168.4.1/wifi/scan', {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          setNetworks(data);
          setStep(2);
        } else {
          setError('No se encontraron redes WiFi. Intenta escanear nuevamente.');
        }
      } else {
        throw new Error(`Error del servidor: ${response.status}`);
      }
    } catch (err) {
      let errorMsg = '';
      if (err.name === 'AbortError') {
        errorMsg = 'Tiempo agotado. Asegúrate de estar conectado a la red "SensorPH_Config" del ESP32.';
      } else if (err.message.includes('Failed to fetch')) {
        errorMsg = 'No se pudo conectar al ESP32. Verifica que estés conectado a la red "SensorPH_Config".';
      } else {
        errorMsg = `Error: ${err.message}`;
      }
      setError(errorMsg);
    } finally {
      setIsScanning(false);
    }
  };

  // Configurar WiFi en el ESP32
  const configureWiFi = async () => {
    const ssid = selectedSsid.trim();
    if (!ssid) {
      setError('Por favor, selecciona o ingresa el nombre de tu red WiFi');
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      const formData = new URLSearchParams();
      formData.append('ssid', ssid);
      formData.append('password', password || '');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('http://192.168.4.1/wifi/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setStep(4);
        // Esperar a que el ESP32 se conecte a la red
        setTimeout(() => {
          registerDevice();
        }, 3000);
      } else {
        throw new Error(`Error del servidor: ${response.status}`);
      }
    } catch (err) {
      let errorMsg = '';
      if (err.name === 'AbortError') {
        errorMsg = 'Tiempo agotado. El ESP32 puede estar reiniciándose. Espera unos segundos.';
      } else if (err.message.includes('Failed to fetch')) {
        errorMsg = 'No se pudo conectar. Verifica que estés conectado a la red "SensorPH_Config" del dispositivo.';
      } else {
        errorMsg = `Error: ${err.message}`;
      }
      setError(errorMsg);
    } finally {
      setIsConnecting(false);
    }
  };

  // Registrar dispositivo en Firebase
  const registerDevice = async () => {
    if (!user?.uid || !deviceId) {
      setError('Debes iniciar sesión para registrar el dispositivo');
      return;
    }

    setIsRegistering(true);
    setError('');

    try {
      // Aquí iría la lógica para registrar en Firebase
      // Por ahora simulamos el registro
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setStep(5);
    } catch (err) {
      setError(`Error registrando dispositivo: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  const goToApp = () => {
    navigate(`/?deviceId=${deviceId}`);
  };

  return (
    <div className="device-setup">
      <div className="device-setup-card">
        <div className="device-setup-header">
          <h1>🏊 Configurar Control Pileta</h1>
          <p className="device-setup-subtitle">
            {step === 1 && 'Conecta tu dispositivo al ESP32'}
            {step === 2 && 'Selecciona tu red WiFi'}
            {step === 3 && 'Ingresa la contraseña'}
            {step === 4 && 'Registrando dispositivo...'}
            {step === 5 && '¡Configuración completa!'}
          </p>
        </div>

        {error && (
          <div className="device-setup-error">
            ⚠️ {error}
          </div>
        )}

        {/* Paso 1: Conectar al AP */}
        {step === 1 && (
          <div className="device-setup-step">
            <div className="device-setup-instructions">
              <h3>Instrucciones:</h3>
              <ol>
                <li>Conecta tu dispositivo a la red WiFi <strong>"SensorPH_Config"</strong></li>
                <li>La red <strong>no tiene contraseña</strong></li>
                <li>Una vez conectado, presiona el botón de abajo</li>
              </ol>
            </div>

            {deviceId && (
              <div className="device-setup-info">
                <small>ID del dispositivo:</small>
                <strong>{deviceId}</strong>
              </div>
            )}

            <button
              onClick={scanNetworks}
              disabled={isScanning}
              className="device-setup-btn device-setup-btn-primary"
            >
              {isScanning ? '🔄 Escaneando...' : '🔍 Buscar redes WiFi'}
            </button>
          </div>
        )}

        {/* Paso 2: Seleccionar red */}
        {step === 2 && (
          <div className="device-setup-step">
            <h3>Redes detectadas por el ESP32:</h3>
            
            {!useManual && networks.length > 0 && (
              <div className="device-setup-networks">
                {networks.map((network, index) => (
                  <label key={index} className="device-setup-network">
                    <input
                      type="radio"
                      name="network"
                      value={network.ssid}
                      checked={selectedSsid === network.ssid}
                      onChange={(e) => setSelectedSsid(e.target.value)}
                    />
                    <span className="device-setup-network-info">
                      <span className="device-setup-network-name">
                        📶 {network.ssid}
                        {network.encryption !== 0 && <span className="device-setup-lock">🔒</span>}
                      </span>
                      <span className="device-setup-signal">
                        {network.rssi > -50 ? '▂▄▆█' : 
                         network.rssi > -70 ? '▂▄▆' : 
                         network.rssi > -80 ? '▂▄' : '▂'}
                      </span>
                    </span>
                  </label>
                ))}
                
                <button
                  onClick={() => setUseManual(true)}
                  className="device-setup-btn device-setup-btn-secondary"
                >
                  ✏️ Ingresar red manualmente
                </button>
              </div>
            )}

            {useManual && (
              <div className="device-setup-manual">
                <label>
                  <strong>Nombre de tu red WiFi (SSID)</strong>
                  <input
                    type="text"
                    placeholder="Ej: MiWiFi-2.4G"
                    value={selectedSsid}
                    onChange={(e) => setSelectedSsid(e.target.value)}
                    className="device-setup-input"
                  />
                </label>
                <button
                  onClick={() => {
                    setUseManual(false);
                    setSelectedSsid('');
                  }}
                  className="device-setup-btn device-setup-btn-secondary"
                >
                  ← Volver a lista de redes
                </button>
              </div>
            )}

            <button
              onClick={() => setStep(3)}
              disabled={!selectedSsid}
              className="device-setup-btn device-setup-btn-primary"
            >
              Continuar →
            </button>
          </div>
        )}

        {/* Paso 3: Ingresar contraseña */}
        {step === 3 && (
          <div className="device-setup-step">
            <div className="device-setup-selected">
              <small>Red seleccionada:</small>
              <strong>{selectedSsid}</strong>
            </div>

            <label>
              <strong>Contraseña WiFi</strong>
              <div className="device-setup-password">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Contraseña (déjalo vacío si es abierta)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="device-setup-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="device-setup-toggle-password"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </label>

            <div className="device-setup-actions">
              <button
                onClick={() => setStep(2)}
                className="device-setup-btn device-setup-btn-secondary"
              >
                ← Volver
              </button>
              <button
                onClick={configureWiFi}
                disabled={isConnecting}
                className="device-setup-btn device-setup-btn-primary"
              >
                {isConnecting ? '⏳ Configurando...' : '💾 Configurar ESP32'}
              </button>
            </div>
          </div>
        )}

        {/* Paso 4: Registrando */}
        {step === 4 && (
          <div className="device-setup-step device-setup-loading">
            <div className="device-setup-spinner"></div>
            <h3>Configurando dispositivo...</h3>
            <p>El ESP32 se está conectando a tu red WiFi</p>
            <p>Esto puede tomar hasta 30 segundos</p>
          </div>
        )}

        {/* Paso 5: Éxito */}
        {step === 5 && (
          <div className="device-setup-step device-setup-success">
            <div className="device-setup-success-icon">✅</div>
            <h3>¡Configuración completa!</h3>
            <p>Tu dispositivo está conectado y registrado</p>
            
            <div className="device-setup-info">
              <small>ID del dispositivo:</small>
              <strong>{deviceId}</strong>
            </div>

            <button
              onClick={goToApp}
              className="device-setup-btn device-setup-btn-primary"
            >
              Ir a la aplicación →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
