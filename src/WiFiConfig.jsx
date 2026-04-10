import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import './WiFiConfig.css';

const WiFiConfig = ({ isOpen, onClose, onSuccess }) => {
    const [networks, setNetworks] = useState([]);
    const [selectedNetwork, setSelectedNetwork] = useState('');
    const [customSsid, setCustomSsid] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [password, setPassword] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [step, setStep] = useState(1);

    // Escanear redes WiFi disponibles en el dispositivo
    const scanNetworks = async () => {
        setIsScanning(true);
        setError('');
        setNetworks([]);

        try {
            if (Capacitor.isNativePlatform()) {
                // En móvil (Android/iOS), intentar obtener info de la red actual
                const status = await Network.getStatus();
                if (status.connected && status.connectionType !== 'none') {
                    // Obtener SSID actual si está disponible
                    // En Android, esta información puede estar limitada por permisos
                    console.log('Estado de red:', status);
                    
                    // Para Android, mostrar la red actual conectada
                    if (status.ssid) {
                        setNetworks([status.ssid]);
                    } else {
                        // Si no podemos obtener el SSID por Capacitor, mostrar mensaje
                        setError('Para acceder a la lista de redes disponibles, asegúrate de tener los permisos de ubicación habilitados en el dispositivo.');
                    }
                }
            } else {
                // En web, no hay acceso directo a redes WiFi disponibles
                // Se debe ingresar manualmente
                setError('En navegador web, debes ingresar manualmente el nombre de tu red. Busca el SSID disponible en tu PC o conecta el celular a la red deseada.');
            }
        } catch (err) {
            setError('No se pudo obtener la lista de redes. Ingresa manualmente el nombre de tu red WiFi.');
            console.error('Error escaneando redes:', err);
        } finally {
            setIsScanning(false);
        }
    };

    // Escanear redes al abrir el modal
    useEffect(() => {
        if (isOpen && !networks.length) {
            scanNetworks();
        }
    }, [isOpen]);

    const handleConfigure = async () => {
        const ssid = useCustom ? customSsid : selectedNetwork;
        if (!ssid || !ssid.trim()) {
            setError('Por favor, selecciona o ingresa el nombre de tu red WiFi');
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
                    setSelectedNetwork('');
                    setCustomSsid('');
                    setPassword('');
                    setStep(1);
                    setNetworks([]);
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
        setSelectedNetwork('');
        setCustomSsid('');
        setPassword('');
        setError('');
        setStep(1);
        setShowPassword(false);
        setNetworks([]);
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

                            <div className="scan-section">
                                <button
                                    onClick={scanNetworks}
                                    disabled={isScanning}
                                    className="scan-btn"
                                >
                                    {isScanning ? '🔄 Escaneando...' : '🔍 Buscar redes disponibles'}
                                </button>
                            </div>

                            {networks.length > 0 && (
                                <div className="networks-list">
                                    <h3>Redes disponibles:</h3>
                                    {networks.map((network, index) => (
                                        <label key={index} className="network-option">
                                            <input
                                                type="radio"
                                                name="network"
                                                value={network}
                                                checked={selectedNetwork === network && !useCustom}
                                                onChange={(e) => {
                                                    setSelectedNetwork(e.target.value);
                                                    setUseCustom(false);
                                                }}
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
                                        name="network"
                                        checked={useCustom}
                                        onChange={() => setUseCustom(true)}
                                    />
                                    <span>Ingresar red manualmente</span>
                                </label>

                                {useCustom && (
                                    <div className="form-section">
                                        <input
                                            type="text"
                                            placeholder="Ej: MiWiFi-2.4G"
                                            value={customSsid}
                                            onChange={(e) => setCustomSsid(e.target.value)}
                                            className="wifi-input"
                                            disabled={isConnecting}
                                            autoFocus
                                        />
                                        <small>Escribe el nombre exacto de tu red WiFi</small>
                                    </div>
                                )}
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
                                disabled={isConnecting || (!selectedNetwork && !customSsid.trim())}
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
