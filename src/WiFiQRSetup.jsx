import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './WiFiQRSetup.css';

const WiFiQRSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    // Cargar parámetros del QR
    const qrSSID = searchParams.get('ssid');
    const qrPass = searchParams.get('pass');
    const qrDevice = searchParams.get('device');

    if (qrSSID) setSsid(qrSSID);
    if (qrPass) setPassword(qrPass);
    if (qrDevice) setDeviceId(qrDevice);

    // Si no hay parámetros, redirigir al home
    if (!qrSSID && !qrDevice) {
      navigate('/');
    }
  }, [searchParams, navigate]);

  const checkESP32Connection = async () => {
    try {
      const response = await fetch('http://192.168.4.1/status', {
        method: 'GET',
        timeout: 3000
      });

      if (response.ok) {
        setIsConnected(true);
        setStep(2);
        setError('');
        return true;
      }
    } catch (err) {
      setIsConnected(false);
      return false;
    }
    return false;
  };

  const handleCheckConnection = async () => {
    setError('');
    const connected = await checkESP32Connection();
    
    if (!connected) {
      setError('No se pudo conectar al ESP32. Asegúrate de estar conectado a la red ' + deviceId);
    }
  };

  const configureWiFi = async () => {
    setIsConfiguring(true);
    setError('');

    try {
      const formData = new URLSearchParams();
      formData.append('ssid', ssid);
      formData.append('password', password);

      const response = await fetch('http://192.168.4.1/wifi/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString()
      });

      if (response.ok) {
        setSuccess(true);
        setStep(3);
        
        // Redirigir al home después de 5 segundos
        setTimeout(() => {
          navigate('/');
        }, 5000);
      } else {
        throw new Error('Error al guardar configuración');
      }
    } catch (err) {
      setError('Error al configurar WiFi: ' + err.message);
      console.error('Error:', err);
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <div className="wifi-qr-setup-page">
      <div className="setup-container">
        <div className="setup-header">
          <h1>🏊 Configuración WiFi</h1>
          <p>Configuración rápida por código QR</p>
        </div>

        {/* Step 1: Conectar al ESP32 */}
        {step === 1 && (
          <div className="setup-step">
            <div className="step-icon">📡</div>
            <h2>Paso 1: Conectar al ESP32</h2>
            
            <div className="info-box">
              <p><strong>Instrucciones:</strong></p>
              <ol>
                <li>Ve a la configuración WiFi de tu teléfono</li>
                <li>Conectate a la red: <strong>{deviceId}</strong></li>
                <li>La red no tiene contraseña</li>
                <li>Vuelve a esta pantalla</li>
              </ol>
            </div>

            <div className="network-info">
              <div className="info-item">
                <span className="info-label">Red a configurar:</span>
                <span className="info-value">{ssid}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Dispositivo ESP32:</span>
                <span className="info-value">{deviceId}</span>
              </div>
            </div>

            <button 
              onClick={handleCheckConnection}
              className="primary-btn"
            >
              ✅ Ya estoy conectado, continuar
            </button>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Confirmar configuración */}
        {step === 2 && !success && (
          <div className="setup-step">
            <div className="step-icon">✅</div>
            <h2>Paso 2: Confirmar configuración</h2>
            
            <div className="success-box">
              <p>✅ Conectado al ESP32 correctamente</p>
            </div>

            <div className="config-summary">
              <h3>Datos a configurar:</h3>
              <div className="summary-item">
                <span className="summary-label">Red WiFi:</span>
                <span className="summary-value">{ssid}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Contraseña:</span>
                <span className="summary-value">{'•'.repeat(password.length)}</span>
              </div>
            </div>

            <div className="warning-box">
              <p>⚠️ El ESP32 se reiniciará y se conectará a tu red WiFi</p>
              <p>Este proceso toma aproximadamente 15 segundos</p>
            </div>

            <button 
              onClick={configureWiFi}
              disabled={isConfiguring}
              className="primary-btn"
            >
              {isConfiguring ? '⏳ Configurando...' : '🚀 Configurar ahora'}
            </button>

            {error && (
              <div className="error-message">
                ⚠️ {error}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Éxito */}
        {step === 3 && success && (
          <div className="setup-step">
            <div className="step-icon success-icon">🎉</div>
            <h2>¡Configuración exitosa!</h2>
            
            <div className="success-box large">
              <p>✅ El ESP32 se está conectando a tu red WiFi</p>
              <p>En unos segundos estará disponible en la app</p>
            </div>

            <div className="next-steps">
              <h3>Próximos pasos:</h3>
              <ol>
                <li>Vuelve a conectar tu teléfono a tu red WiFi normal</li>
                <li>Abre la app Control Pileta</li>
                <li>El dispositivo aparecerá automáticamente</li>
              </ol>
            </div>

            <div className="redirect-info">
              <p>Serás redirigido al inicio en 5 segundos...</p>
            </div>

            <button 
              onClick={() => navigate('/')}
              className="primary-btn"
            >
              🏠 Ir al inicio ahora
            </button>
          </div>
        )}

        <div className="setup-footer">
          <button 
            onClick={() => navigate('/')}
            className="back-btn"
          >
            ← Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
};

export default WiFiQRSetup;
