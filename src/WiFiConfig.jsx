import { useState, useEffect } from 'react';
import './WiFiConfig.css';

const WiFiConfig = ({ isOpen, onClose, onSuccess }) => {
    const [networks, setNetworks] = useState([]);
    const [selectedNetwork, setSelectedNetwork] = useState('');
    const [password, setPassword] = useState('');
    const [customSSID, setCustomSSID] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');
    const [showInstructions, setShowInstructions] = useState(true);

    // Escanear redes WiFi disponibles
    const scanNetworks = async () => {
        setIsScanning(true);
        setError('');
        setNetworks([]);
        
        try {
            // Intentar conectar al ESP32 en modo configuración
            const response = await fetch('http://192.168.4.1/scan', {
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                const html = await response.text();
                // Parsear las redes del HTML - buscar líneas con información de redes
                const lines = html.split('\n');
                const foundNetworks = [];
                
                // Buscar líneas que contengan información de redes
                for (let line of lines) {
                    // Buscar patrones comunes de redes WiFi (SSID, potencia, etc)
                    const cleanLine = line.replace(/[^A-Za-z0-9_\-\.]/g, ' ').trim();
                    
                    // Buscar palabras que parezcan SSIDs (sin caracteres especiales)
                    const parts = cleanLine.split(/\s+/);
                    for (let part of parts) {
                        if (part && part.length > 1 && part.length < 32 && 
                            /[a-zA-Z0-9]/.test(part) &&
                            part !== 'SensorPH_Config' && 
                            !part.match(/^\d{1,3}$/) &&
                            foundNetworks.indexOf(part) === -1) {
                            foundNetworks.push(part);
                        }
                    }
                }
                
                if (foundNetworks.length > 0) {
                    setNetworks(foundNetworks);
                    setShowInstructions(false);
                } else {
                    setError('No se encontraron redes. Verifica que estés conectado a "SensorPH_Config"');
                    setNetworks([]);
                }
            } else {
                throw new Error('No se pudo escanear redes - Respuesta del servidor: ' + response.status);
            }
        } catch (err) {
            // Detectar si es un error de conexión
            let errorMsg = 'No se pudo conectar al ESP32. ';
            if (err.message.includes('Failed to fetch')) {
                errorMsg += 'Asegúrate de: 1) Conectarte a la red WiFi "SensorPH_Config", 2) Volver a esta pantalla, 3) Hacer clic en "Escanear Redes".';
            } else {
                errorMsg += err.message;
            }
            setError(errorMsg);
            console.error('Error escaneando redes:', err);
        } finally {
            setIsScanning(false);
        }
    };

    // Configurar WiFi
    const configureWiFi = async () => {
        if (!selectedNetwork && !customSSID) {
            setError('Selecciona una red o ingresa un SSID personalizado');
            return;
        }

        setIsConnecting(true);
        setError('');

        const ssid = useCustom ? customSSID : selectedNetwork;

        try {
            const formData = new URLSearchParams();
            formData.append('ssid', ssid);
            formData.append('password', password || '');

            const response = await fetch('http://192.168.4.1/wifi/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString()
            });

            if (response.ok) {
                // Configuración exitosa
                setTimeout(() => {
                    onSuccess(ssid);
                    onClose();
                }, 2000);
            } else {
                throw new Error('Error al guardar configuración');
            }
        } catch (err) {
            setError('Error al configurar WiFi: ' + err.message);
        } finally {
            setIsConnecting(false);
        }
    };

    // Escanear redes al abrir el modal
    useEffect(() => {
        if (isOpen) {
            setShowInstructions(true);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="wifi-config-overlay" onClick={onClose}>
            <div className="wifi-config-modal" onClick={(e) => e.stopPropagation()}>
                <div className="wifi-config-header">
                    <h2>Configurar WiFi del ESP32</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="wifi-config-content">
                    {error && (
                        <div className="error-message">
                            ⚠️ {error}
                        </div>
                    )}

                    {showInstructions && (
                        <div className="connection-info">
                            <p><strong>Instrucciones:</strong></p>
                            <ol>
                                <li>Conecta tu dispositivo a la red WiFi <strong>"SensorPH_Config"</strong></li>
                                <li>La red de configuración no tiene contraseña</li>
                                <li>Una vez conectado, haz clic en "Escanear Redes"</li>
                                <li>Selecciona tu red WiFi y configura la contraseña de tu router</li>
                            </ol>
                        </div>
                    )}

                    <div className="network-selection">
                        <div className="scan-section">
                            <button 
                                onClick={scanNetworks} 
                                disabled={isScanning}
                                className="scan-btn"
                            >
                                {isScanning ? '🔄 Escaneando...' : '🔍 Escanear Redes'}
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
                                <span>Red personalizada</span>
                            </label>
                            
                            {useCustom && (
                                <input
                                    type="text"
                                    placeholder="Nombre de la red (SSID)"
                                    value={customSSID}
                                    onChange={(e) => setCustomSSID(e.target.value)}
                                    className="custom-ssid-input"
                                />
                            )}
                        </div>

                        <div className="password-section">
                            <label>Contraseña de la red:</label>
                            <input
                                type="password"
                                placeholder="Contraseña WiFi (opcional si es abierta)"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="password-input"
                            />
                        </div>

                        <div className="config-actions">
                            <button 
                                onClick={configureWiFi}
                                disabled={isConnecting || (!selectedNetwork && !customSSID)}
                                className="configure-btn"
                            >
                                {isConnecting ? '⏳ Configurando...' : '💾 Configurar WiFi'}
                            </button>
                        </div>

                        {isConnecting && (
                            <div className="connecting-message">
                                <p>🔄 Configurando WiFi...</p>
                                <p>El ESP32 se reiniciará y se conectará a tu red.</p>
                                <p>Esto puede tomar hasta 30 segundos.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WiFiConfig;
