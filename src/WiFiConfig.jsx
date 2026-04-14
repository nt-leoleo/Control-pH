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
                console.log('Iniciando escaneo de redes WiFi en Android...');
                
                // En móvil (Android/iOS), solicitar permisos necesarios
                try {
                    // Verificar permisos de ubicación
                    const permissionStatus = await Geolocation.checkPermissions();
                    console.log('Estado de permisos de ubicación:', permissionStatus);
                    
                    if (permissionStatus.location !== 'granted') {
                        console.log('Solicitando permisos de ubicación...');
                        const requestResult = await Geolocation.requestPermissions();
                        console.log('Resultado de solicitud de permisos:', requestResult);
                        
                        if (requestResult.location !== 'granted') {
                            setError('Se requieren permisos de ubicación. Ve a Ajustes > Aplicaciones > Control Pileta > Permisos > Ubicación y selecciona "Permitir solo mientras usas la app" o "Permitir siempre".');
                            setIsScanning(false);
                            return;
                        }
                    }
                } catch (permError) {
                    console.warn('Error verificando permisos:', permError);
                }

                // Verificar si WiFi está habilitado
                try {
                    const wifiEnabled = await CapacitorWifi.isEnabled();
                    console.log('WiFi habilitado:', wifiEnabled);
                    
                    if (!wifiEnabled.enabled) {
                        setError('WiFi no está habilitado en tu dispositivo. Ve a Ajustes y activa WiFi.');
                        setIsScanning(false);
                        return;
                    }
                } catch (wifiCheckError) {
                    console.warn('No se pudo verificar estado de WiFi:', wifiCheckError);
                }

                // Escanear redes WiFi disponibles
                try {
                    console.log('Iniciando escaneo...');
                    await CapacitorWifi.startScan();
                    console.log('Escaneo iniciado');
                    
                    // Esperar a que se complete el escaneo
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    
                    console.log('Obteniendo redes disponibles...');
                    const result = await CapacitorWifi.getAvailableNetworks();
                    console.log('Resultado del escaneo:', result);
                    
                    if (result && result.networks && result.networks.length > 0) {
                        // Filtrar redes válidas
                        const availableNetworks = result.networks
                            .filter(network => network && network.ssid && network.ssid.trim() !== '')
                            .map(network => network.ssid);
                        
                        // Remover duplicados y ordenar
                        const uniqueNetworks = [...new Set(availableNetworks)].sort();
                        
                        console.log('Redes encontradas:', uniqueNetworks);
                        setNetworks(uniqueNetworks);
                        
                        if (uniqueNetworks.length === 0) {
                            setError('No se encontraron redes WiFi. Asegúrate de que WiFi esté habilitado y haya redes disponibles.');
                        }
                    } else {
                        console.warn('No hay redes en el resultado:', result);
                        setError('No se encontraron redes disponibles. Verifica que WiFi esté activado en tu dispositivo.');
                    }
                } catch (wifiError) {
                    console.error('Error en escaneo de WiFi:', wifiError);
                    console.error('Detalles del error:', {
                        message: wifiError.message,
                        code: wifiError.code,
                        stack: wifiError.stack
                    });
                    
                    setError('No se pudo escanear redes WiFi (Error: ' + (wifiError.message || 'desconocido') + '). Verifica que hayas dado permisos de "Ubicación" y "Dispositivos cercanos" en Ajustes > Aplicaciones > Control Pileta > Permisos.');
                }
            } else {
                // En web, no hay acceso directo a redes WiFi disponibles
                setError('En navegador web, debes ingresar manualmente el nombre de tu red WiFi.');
            }
        } catch (err) {
            console.error('Error general:', err);
            setError('Error al acceder a redes WiFi. Ingresa manualmente el nombre de tu red.');
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
