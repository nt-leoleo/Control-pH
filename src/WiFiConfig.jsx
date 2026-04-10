import { useState } from 'react';
import './WiFiConfig.css';

const WiFiConfig = ({ isOpen, onClose, onSuccess }) => {
    const [networks, setNetworks] = useState([]);
    const [ssid, setSsid] = useState('');
    const [password, setPassword] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [step, setStep] = useState(1);
    const [useManual, setUseManual] = useState(false);

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
                // data debería ser un array de objetos: [{ssid: "Red1", rssi: -50, encryption: 3}, ...]
                if (data && data.length > 0) {
                    setNetworks(data);
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
            console.error('Error escaneando redes:', err);
        } finally {
            setIsScanning(false);
        }
    };

    const handleConfigure = async () => {
        if (!ssid || !ssid.trim()) {
            setError('Por favor, ingresa el nombre de tu red WiFi');
            return;
        }

        setIsConnecting(true);
        setError('');

        try {
            const formData = new URLSearchParams();
            formData.append('ssid', ssid.trim());
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
                setStep(2);
                setTimeout(() => {
                    onSuccess(ssid);
                    onClose();
                    setSsid('');
                    setPassword('');
                    setStep(1);
                }, 2000);
            } else {
                throw new Error(`Error del servidor: ${response.status}`);
            }
        } catch (err) {
            let errorMsg = '';
            if (err.name === 'AbortError') {
                errorMsg = 'Tiempo agotado. Asegúrate de estar conectado a la red WiFi del ESP32 (SensorPH_Config).';
            } else if (err.message.includes('Failed to fetch')) {
                errorMsg = 'No se pudo conectar. Verifica que estés conectado a la red "SensorPH_Config" del dispositivo.';
            } else {
                errorMsg = `Error: ${err.message}`;
            }
            setError(errorMsg);
            console.error('Error configurando WiFi:', err);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleClose = () => {
        setNetworks([]);
        setSsid('');
        setPassword('');
        setError('');
        setStep(1);
        setShowPassword(false);
        setUseManual(false);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="wifi-config-overlay" onClick={handleClose}>
            <div className="wifi-config-modal" onClick={(e) => e.stopPropagation()}>
                <div className="wifi-config-header">
                    <h2>Configurar WiFi del ESP32</h2>
                    <button className="close-btn" onClick={handleClose}>✕</button>
                </div>

                <div className="wifi-config-content">
                    {step === 1 ? (
                        <>
                            {error && (
                                <div className="error-message">
                                    ⚠️ {error}
                                </div>
                            )}

                            <div className="connection-info">
                                <p><strong>Instrucciones:</strong></p>
                                <ol>
                                    <li>Asegúrate de estar conectado a la red <strong>"SensorPH_Config"</strong></li>
                                    <li>Presiona "Escanear redes" para ver las redes WiFi que detecta el ESP32</li>
                                    <li>Selecciona tu red e ingresa la contraseña</li>
                                </ol>
                            </div>

                            <div className="scan-section">
                                <button
                                    onClick={scanNetworks}
                                    disabled={isScanning}
                                    className="scan-btn"
                                >
                                    {isScanning ? '🔄 Escaneando...' : '🔍 Escanear redes WiFi'}
                                </button>
                            </div>

                            {networks.length > 0 && !useManual && (
                                <div className="networks-list">
                                    <h3>Redes detectadas por el ESP32:</h3>
                                    {networks.map((network, index) => (
                                        <label key={index} className="network-option">
                                            <input
                                                type="radio"
                                                name="network"
                                                value={network.ssid}
                                                checked={ssid === network.ssid}
                                                onChange={(e) => {
                                                    setSsid(e.target.value);
                                                    setUseManual(false);
                                                }}
                                            />
                                            <span className="network-name">
                                                📶 {network.ssid} 
                                                <span className="signal-strength">
                                                    {network.rssi > -50 ? '▂▄▆█' : 
                                                     network.rssi > -70 ? '▂▄▆' : 
                                                     network.rssi > -80 ? '▂▄' : '▂'}
                                                </span>
                                                {network.encryption !== 0 && <span className="lock-icon">🔒</span>}
                                            </span>
                                        </label>
                                    ))}
                                    <button 
                                        className="manual-btn"
                                        onClick={() => {
                                            setUseManual(true);
                                            setSsid('');
                                        }}
                                    >
                                        ✏️ Ingresar red manualmente
                                    </button>
                                </div>
                            )}

                            {(useManual || networks.length === 0) && (
                                <div className="form-section">
                                    <label htmlFor="wifi-ssid">
                                        <strong>Nombre de tu red WiFi (SSID)</strong>
                                    </label>
                                    <input
                                        id="wifi-ssid"
                                        type="text"
                                        placeholder="Ej: MiWiFi-2.4G"
                                        value={ssid}
                                        onChange={(e) => setSsid(e.target.value)}
                                        className="wifi-input"
                                        disabled={isConnecting}
                                        autoFocus={useManual}
                                    />
                                    <small>Escribe el nombre exacto de tu red WiFi</small>
                                </div>
                            )}

                            <div className="form-section">
                                <label htmlFor="wifi-password">
                                    <strong>Contraseña WiFi</strong>
                                </label>
                                <div className="password-wrapper">
                                    <input
                                        id="wifi-password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Contraseña (si es abierta, déjalo vacío)"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="wifi-input"
                                        disabled={isConnecting}
                                    />
                                    <button
                                        type="button"
                                        className="toggle-password"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={isConnecting}
                                    >
                                        {showPassword ? '👁️' : '👁️‍🗨️'}
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleConfigure}
                                disabled={isConnecting || !ssid.trim()}
                                className="configure-btn"
                            >
                                {isConnecting ? '⏳ Configurando...' : '💾 Enviar configuración al ESP32'}
                            </button>
                        </>
                    ) : (
                        <div className="success-message">
                            <div className="success-icon">✅</div>
                            <h3>¡Configuración enviada!</h3>
                            <p>El ESP32 se está conectando a <strong>{ssid}</strong></p>
                            <p className="small-text">Esto puede tomar hasta 30 segundos...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WiFiConfig;
