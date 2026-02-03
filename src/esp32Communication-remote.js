// Comunicación con ESP32 remoto - Datos desde la nube

export const ESP32_CONFIG = {
    // API para leer datos desde la nube
    CLOUD_API: 'https://api.jsonbin.io/v3/b/6756a1e5ad19ca34f8c8f123/latest',
    API_KEY: '$2a$10$8VnzQzKvV.Hn8fGkGkGkGu8VnzQzKvV.Hn8fGkGkGu8VnzQzKvV.H',
    TIMEOUT: 10000,
    RETRY_INTERVAL: 30000, // Verificar cada 30 segundos
    MAX_DATA_AGE: 300000   // 5 minutos - considerar datos obsoletos después de este tiempo
};

export const checkESP32Connection = async () => {
    try {
        console.log('🌐 [REMOTO] Verificando datos del sensor en la nube...');
        
        const response = await fetch(ESP32_CONFIG.CLOUD_API, {
            method: 'GET',
            headers: {
                'X-Master-Key': ESP32_CONFIG.API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('📡 [REMOTO] Datos recibidos:', data);
            
            // Verificar si los datos son recientes
            const sensorData = data.record;
            const dataAge = Date.now() - sensorData.timestamp;
            
            if (dataAge < ESP32_CONFIG.MAX_DATA_AGE) {
                console.log('✅ [REMOTO] Sensor conectado - datos recientes');
                return true;
            } else {
                console.log('⚠️ [REMOTO] Datos obsoletos - sensor posiblemente desconectado');
                return false;
            }
        } else {
            console.log('❌ [REMOTO] Error obteniendo datos:', response.status);
            return false;
        }
        
    } catch (error) {
        console.log('❌ [REMOTO] Error de conexión:', error.message);
        return false;
    }
};

export const getPHDataFromESP32 = async () => {
    try {
        console.log('🧪 [REMOTO] Obteniendo datos de pH desde la nube...');
        
        const response = await fetch(ESP32_CONFIG.CLOUD_API, {
            method: 'GET',
            headers: {
                'X-Master-Key': ESP32_CONFIG.API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const sensorData = data.record;
            
            console.log('✅ [REMOTO] Datos de pH obtenidos:', sensorData);
            
            // Verificar edad de los datos
            const dataAge = Date.now() - sensorData.timestamp;
            const isRecent = dataAge < ESP32_CONFIG.MAX_DATA_AGE;
            
            return {
                ph: parseFloat(sensorData.ph),
                voltage: parseFloat(sensorData.voltage),
                timestamp: new Date(sensorData.timestamp),
                device_id: sensorData.device_id,
                wifi_rssi: sensorData.wifi_rssi,
                location: sensorData.location,
                source: 'esp32-remote',
                isRecent: isRecent,
                dataAge: Math.round(dataAge / 1000) // Edad en segundos
            };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.log('❌ [REMOTO] Error obteniendo pH:', error.message);
        return null;
    }
};

export const sendDosingCommand = async (dosingConfig) => {
    try {
        console.log('💊 [REMOTO] Enviando comando de dosing...');
        console.log('⚠️ [REMOTO] Nota: Comandos remotos requieren implementación adicional');
        
        // Para comandos remotos, necesitaríamos:
        // 1. Enviar comando a la nube
        // 2. ESP32 verificar comandos pendientes
        // 3. Ejecutar comando y reportar resultado
        
        // Por ahora, simular éxito si hay conectividad
        const isConnected = await checkESP32Connection();
        if (isConnected) {
            console.log('✅ [REMOTO] Comando simulado (requiere implementación completa)');
            return true;
        }
        return false;
        
    } catch (error) {
        console.error('❌ [REMOTO] Error enviando comando:', error.message);
        return false;
    }
};

export const getESP32IP = () => {
    return 'Remoto (Nube)';
};

export const useESP32Connection = (onDataReceived, onConnectionChange) => {
    let connectionInterval;
    
    const startConnection = () => {
        console.log('🚀 [REMOTO] Iniciando monitoreo remoto...');
        console.log('🌐 [REMOTO] Leyendo datos desde la nube cada 30 segundos');
        
        // Verificación inicial
        setTimeout(async () => {
            console.log('🔍 [REMOTO] Verificación inicial...');
            const isConnected = await checkESP32Connection();
            console.log('📡 [REMOTO] Estado inicial:', isConnected);
            onConnectionChange(isConnected);
            
            if (isConnected) {
                console.log('📊 [REMOTO] Obteniendo datos iniciales...');
                const phData = await getPHDataFromESP32();
                console.log('🧪 [REMOTO] Datos iniciales:', phData);
                if (phData) {
                    onDataReceived(phData);
                }
            }
        }, 1000);
        
        // Verificación periódica
        connectionInterval = setInterval(async () => {
            console.log('🔄 [REMOTO] Verificación periódica...');
            const isConnected = await checkESP32Connection();
            onConnectionChange(isConnected);
            
            if (isConnected) {
                const phData = await getPHDataFromESP32();
                if (phData) {
                    onDataReceived(phData);
                }
            }
        }, ESP32_CONFIG.RETRY_INTERVAL);
        
        console.log('✅ [REMOTO] Sistema de monitoreo remoto configurado');
    };
    
    const stopConnection = () => {
        console.log('🛑 [REMOTO] Deteniendo monitoreo remoto...');
        if (connectionInterval) {
            clearInterval(connectionInterval);
        }
    };
    
    return { startConnection, stopConnection };
};

// Función para obtener estadísticas del sensor remoto
export const getRemoteStats = async () => {
    try {
        const response = await fetch(ESP32_CONFIG.CLOUD_API, {
            method: 'GET',
            headers: {
                'X-Master-Key': ESP32_CONFIG.API_KEY,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const sensorData = data.record;
            
            return {
                device_id: sensorData.device_id,
                location: sensorData.location,
                wifi_signal: sensorData.wifi_rssi + ' dBm',
                last_update: new Date(sensorData.timestamp).toLocaleString(),
                status: sensorData.status,
                uptime: Math.round(sensorData.timestamp / 1000) + 's'
            };
        }
        return null;
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return null;
    }
};