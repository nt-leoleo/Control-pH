import { useState } from 'react';
import './WiFiConfig.css';

const WiFiConfig = ({ isOpen, onClose, onSuccess }) => {
    const [ssid, setSsid] = useState('');
    const [password, setPassword] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [step, setStep] = useState(1);

    const handleConfigure = async () => {
        if (!ssid.trim()) {
            setError('Por favor, ingresa el nombre de tu red WiFi');
            return;
        }

        setIsConnecting(true);
        setError('');

        try {
            // Intentar conectarse al ESP32
            const formData = new URLSearchParams();
            formData.append('ssid', ssid);
            formData.append('password', password || '');

            // Timeout para la solicitud
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

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
                // Configuración exitosa
                setStep(2);
                setTimeout(() => {
                    onSuccess(ssid);
                    onClose();
                    // Reset para próxima vez
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
        setSsid('');
        setPassword('');
        setError('');
        setStep(1);
        setShowPassword(false);
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
                                <p><strong>Antes de continuar:</strong></p>
                                <ol>
                                    <li>Conecta tu dispositivo a la red WiFi <strong>"SensorPH_Config"</strong></li>
                                    <li>La red de configuración <strong>no tiene contraseña</strong></li>
                                    <li>Una vez conectado, regresa a esta pantalla</li>
                                    <li>Ingresa tu red WiFi y contraseña abajo</li>
                                </ol>
                            </div>

                            <div className="form-section">
                                <label htmlFor="wifi-ssid">
                                    <strong>Red WiFi a conectar</strong>
                                </label>
                                <input
                                    id="wifi-ssid"
                                    type="text"
                                    placeholder="Ej: MiWiFi-2.4G"
                                    value={ssid}
                                    onChange={(e) => setSsid(e.target.value)}
                                    className="wifi-input"
                                    disabled={isConnecting}
                                    autoFocus
                                />
                                <small>Escribe el nombre exacto de tu red WiFi</small>
                            </div>

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
