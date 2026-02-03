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

    // Escanear redes WiFi disponibles
    const scanNetworks = async () => {
        setIsScanning(true);
        setError('');
        
        try {
            // Intentar conectar al ESP32 en modo configuración
            const response = await fetch('http://192.168.4.1/scan', {
                method: 'GET',
                timeout: 5000
            });
            
            if (response.ok) {
                const html = await response.text();
                // Parsear las redes del HTML
                const networkMatches = html.match(/📶\s+([^<]+)\s+\(/g);
                if (networkMatches) {
                    const networkList = networkMatches.map(match => {
                        const ssid = match.replace('📶 ', '').replace(' (', '').trim();
                        return ssid;
                    });
                    setNetworks([...new Set(networkList)]); // Eliminar duplicados
                } else {
                    setNetworks([]);
                }
            } else {
                throw new Error('No se pudo escanear redes');
            }
        } catch (err) {
            setError('No se pudo conectar al ESP32. Asegúrate de estar conectado a la red "SensorPH_Config"');
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
            const formData = new FormData();
            formData.append('ssid', ssid);
            formData.append('password', password);

            const response = await fetch('http://192.168.4.1/save', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                // Configuración exitosa
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 3000); // Dar tiempo para que el ESP32 se reinicie
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
            scanNetworks();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="wifi-config-overlay" onClick={onClose}>
            <div className="wifi-config-modal" onClick={(e) => e.stopPropagation()}>
                <div className="wifi-config-header">
                    <h2>🌐 Configurar WiFi del ESP32</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="wifi-config-content">
                    {error && (
                        <div className="error-message">
                            ⚠️ {error}
                        </div>
                    )}

                    <div className="connection-info">
                        <p><strong>Instrucciones:</strong></p>
                        <ol>
                            <li>Conecta tu dispositivo a la red <strong>"SensorPH_Config"</strong></li>
                            <li>Contraseña: <strong>"12345678"</strong></li>
                            <li>Selecciona tu red WiFi y configura la contraseña</li>
                        </ol>
                    </div>

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
                                <h3>Redes Disponibles:</h3>
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
                                placeholder="Contraseña WiFi"
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