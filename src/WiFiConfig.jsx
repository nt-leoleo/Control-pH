import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { CapacitorWifi } from '@capgo/capacitor-wifi';
import './WiFiConfig.css';

const WiFiConfig = ({ isOpen, onClose, onContinue }) => {
    const [networks, setNetworks] = useState([]);
    const [selectedNetwork, setSelectedNetwork] = useState('');
    const [customSsid, setCustomSsid] = useState('');
    const [useCustom, setUseCustom] = useState(false);
    const [password, setPassword] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const targetSsid = (useCustom ? customSsid : selectedNetwork).trim();

    // Escanear redes WiFi disponibles en el dispositivo
    const scanNetworks = async () => {
        setIsScanning(true);
        setError('');
        setNetworks([]);

        try {
            if (Capacitor.isNativePlatform()) {
                // En móvil (Android/iOS), solicitar permisos de ubicación primero
                try {
                    const permissionStatus = await Geolocation.checkPermissions();
                    if (permissionStatus.location !== 'granted') {
                        // Solicitar permisos de ubicación
                        const requestResult = await Geolocation.requestPermissions();
                        if (requestResult.location !== 'granted') {
                            setError('Se requieren permisos de ubicación para escanear redes WiFi. Ve a Ajustes > Aplicaciones > Control Pileta > Permisos y habilita "Ubicación".');
                            setIsScanning(false);
                            return;
                        }
                    }
                } catch (permError) {
                    console.warn('Error con permisos de ubicación:', permError);
                    setError('No se pudieron verificar los permisos de ubicación. Asegúrate de tener permisos de ubicación habilitados.');
                    setIsScanning(false);
                    return;
                }

                // Escanear redes WiFi disponibles usando el plugin
                try {
                    // Iniciar escaneo
                    await CapacitorWifi.startScan();
                    
                    // Pequeña pausa para que el escaneo se complete
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Obtener redes disponibles
                    const result = await CapacitorWifi.getAvailableNetworks();
                    
                    if (result.networks && result.networks.length > 0) {
                        // Filtrar y mostrar redes disponibles
                        const availableNetworks = result.networks
                            .filter(network => network.ssid && network.ssid.trim() !== '')
                            .map(network => network.ssid);
                        
                        // Remover duplicados
                        const uniqueNetworks = [...new Set(availableNetworks)];
                        
                        setNetworks(uniqueNetworks);
                        setError(''); // Limpiar error si se encontraron redes
                    } else {
                        setError('No se encontraron redes WiFi disponibles. Asegúrate de que el WiFi esté activado.');
                    }
                } catch (wifiError) {
                    console.error('Error escaneando WiFi:', wifiError);
                    setError('No se pudo escanear la lista de redes del telefono. Verifica permisos de ubicacion y "Dispositivos cercanos", o ingresa la red manualmente.');
                }
            } else {
                // En web, no hay acceso directo a redes WiFi disponibles
                setError('En navegador web, debes ingresar manualmente el nombre de tu red. Busca el SSID disponible en tu PC o conecta el celular a la red deseada.');
            }
        } catch (err) {
            console.error('Error escaneando redes:', err);
            setError('No se pudo acceder a la información de WiFi. Ingresa manualmente el nombre de tu red WiFi.');
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

    const handleContinue = () => {
        if (!targetSsid) {
            setError('Por favor, selecciona o ingresa el nombre de tu red WiFi');
            return;
        }

        onContinue({
            ssid: targetSsid,
            password: password || ''
        });
        setSelectedNetwork('');
        setCustomSsid('');
        setPassword('');
        setError('');
        setShowPassword(false);
        setNetworks([]);
    };

    const handleClose = () => {
        setSelectedNetwork('');
        setCustomSsid('');
        setPassword('');
        setError('');
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
                    {error && (
                        <div className="error-message">
                            ⚠️ {error}
                        </div>
                    )}

                    <div className="connection-info">
                        <p><strong>Paso 1 de 2:</strong></p>
                        <ol>
                            <li>Selecciona tu red WiFi</li>
                            <li>Ingresa la contraseña</li>
                            <li>Presiona continuar</li>
                            <li>Luego verás los dispositivos Bluetooth</li>
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
                            />
                            <button
                                type="button"
                                className="toggle-password"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? '👁️' : '👁️‍🗨️'}
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleContinue}
                        disabled={!targetSsid}
                        className="configure-btn"
                    >
                        Continuar a Bluetooth →
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WiFiConfig;
