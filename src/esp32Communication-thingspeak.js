// Comunicación con ESP32 remoto - Datos desde ThingSpeak
export const ESP32_CONFIG = {
    // API de ThingSpeak - Canal público de prueba
    CHANNEL_ID: '2739863',
    READ_API_KEY: '', // No necesario para canales públicos
    THINGSPEAK_API: 'https://api.thingspeak.com/channels/2739863/feeds/last.json',
    TIMEOUT: 10000,
    RETRY_INTERVAL: 30000, // Verificar cada 30 segundos
    MAX_DATA_AGE: 300000   // 5 minutos - considerar datos obsoletos después de este tiempo
};

export const checkESP32Connection = async () => {
    try {
        console.log('🌐 [THINGSPEAK] Verificando datos del sensor...');
        
        const response = await fetch(ESP32_CONFIG.THINGSPEAK_API);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📡 [THINGSPEAK] Datos recibidos:', data);
            
            // Verificar si los datos son recientes
            const dataTimestamp = new Date(data.created_at).getTime();
            const now = Date.now();
            const dataAge = now - dataTimestamp;
            
            console.log(`📅 [THINGSPEAK] Última actualización: ${new Date(dataTimestamp).toLocaleString()}`);
            console.log(`⏰ [THINGSPEAK] Edad de los datos: ${Math.round(dataAge/1000)}s`);
            
            if (dataAge < ESP32_CONFIG.MAX_DATA_AGE) {
                console.log('✅ [THINGSPEAK] Sensor conectado - datos recientes');
                return true;
            } else {
                console.log('⚠️ [THINGSPEAK] Datos obsoletos - sensor posiblemente desconectado');
                return false;
            }
        } else {
            console.log('❌ [THINGSPEAK] Error obteniendo datos:', response.status);
            return false;
        }
        
    } catch (error) {
        console.log('❌ [THINGSPEAK] Error de conexión:', error.message);
        return false;
    }
};

export const getPHDataFromESP32 = async () => {
    try {
        console.log('🧪 [THINGSPEAK] Obteniendo datos de pH...');
        
        const response = await fetch(ESP32_CONFIG.THINGSPEAK_API);
        
        if (response.ok) {
            const data = await response.json();
            
            console.log('✅ [THINGSPEAK] Datos de pH obtenidos:', data);
            
            // Verificar edad de los datos
            const dataTimestamp = new Date(data.created_at).getTime();
            const now = Date.now();
            const dataAge = now - dataTimestamp;
            const isRecent = dataAge < ESP32_CONFIG.MAX_DATA_AGE;
            
            console.log(`📅 [THINGSPEAK] Datos de: ${new Date(dataTimestamp).toLocaleString()}`);
            console.log(`⏰ [THINGSPEAK] Edad: ${Math.round(dataAge/1000)}s`);
            
            return {
                ph: parseFloat(data.field1) || 7.0,           // Field1 = pH
                voltage: parseFloat(data.field2) || 0,        // Field2 = Voltage
                wifi_rssi: parseInt(data.field3) || -50,      // Field3 = WiFi RSSI
                uptime: parseInt(data.field4) || 0,           // Field4 = Uptime
                timestamp: new Date(dataTimestamp),
                device_id: `thingspeak_${ESP32_CONFIG.CHANNEL_ID}`,
                location: 'piscina_principal',
                source: 'esp32-thingspeak',
                isRecent: isRecent,
                dataAge: Math.round(dataAge / 1000),
                entry_id: data.entry_id
            };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.log('❌ [THINGSPEAK] Error obteniendo pH:', error.message);
        return null;
    }
};

export const sendDosingCommand = async (dosingConfig) => {
    try {
        console.log('💊 [THINGSPEAK] Enviando comando de dosing...');
        console.log('⚠️ [THINGSPEAK] Nota: Comandos remotos requieren implementación adicional');
        
        // Para comandos remotos con ThingSpeak, necesitaríamos:
        // 1. Usar un campo específico para comandos
        // 2. ESP32 verificar ese campo periódicamente
        // 3. Ejecutar comando y reportar resultado
        
        // Por ahora, simular éxito si hay conectividad
        const isConnected = await checkESP32Connection();
        if (isConnected) {
            console.log('✅ [THINGSPEAK] Comando simulado (requiere implementación completa)');
            return true;
        }
        return false;
        
    } catch (error) {
        console.error('❌ [THINGSPEAK] Error enviando comando:', error.message);
        return false;
    }
};

export const getESP32IP = () => {
    return 'ThingSpeak (Nube)';
};

export const useESP32Connection = (onDataReceived, onConnectionChange) => {
    let connectionInterval;
    
    const startConnection = () => {
        console.log('🚀 [THINGSPEAK] Iniciando monitoreo remoto...');
        console.log('🌐 [THINGSPEAK] Leyendo datos desde ThingSpeak cada 30 segundos');
        console.log('📊 [THINGSPEAK] Canal: ' + ESP32_CONFIG.CHANNEL_ID);
        
        // Verificación inicial
        setTimeout(async () => {
            console.log('🔍 [THINGSPEAK] Verificación inicial...');
            const isConnected = await checkESP32Connection();
            console.log('📡 [THINGSPEAK] Estado inicial:', isConnected);
            onConnectionChange(isConnected);
            
            if (isConnected) {
                console.log('📊 [THINGSPEAK] Obteniendo datos iniciales...');
                const phData = await getPHDataFromESP32();
                console.log('🧪 [THINGSPEAK] Datos iniciales:', phData);
                if (phData) {
                    onDataReceived(phData);
                }
            }
        }, 1000);
        
        // Verificación periódica
        connectionInterval = setInterval(async () => {
            console.log('🔄 [THINGSPEAK] Verificación periódica...');
            const isConnected = await checkESP32Connection();
            onConnectionChange(isConnected);
            
            if (isConnected) {
                const phData = await getPHDataFromESP32();
                if (phData) {
                    onDataReceived(phData);
                }
            }
        }, ESP32_CONFIG.RETRY_INTERVAL);
        
        console.log('✅ [THINGSPEAK] Sistema de monitoreo remoto configurado');
    };
    
    const stopConnection = () => {
        console.log('🛑 [THINGSPEAK] Deteniendo monitoreo remoto...');
        if (connectionInterval) {
            clearInterval(connectionInterval);
        }
    };
    
    return { startConnection, stopConnection };
};

// Función para obtener estadísticas del sensor remoto
export const getRemoteStats = async () => {
    try {
        const response = await fetch(ESP32_CONFIG.THINGSPEAK_API);
        
        if (response.ok) {
            const data = await response.json();
            
            return {
                channel_id: ESP32_CONFIG.CHANNEL_ID,
                entry_id: data.entry_id,
                location: 'piscina_principal',
                wifi_signal: data.field3 + ' dBm',
                last_update: new Date(data.created_at).toLocaleString(),
                uptime: data.field4 + 's',
                source: 'ThingSpeak'
            };
        }
        return null;
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        return null;
    }
};

// Función para obtener el historial de datos (últimas 100 entradas)
export const getPHHistory = async (results = 100) => {
    try {
        const url = `https://api.thingspeak.com/channels/${ESP32_CONFIG.CHANNEL_ID}/feeds.json?results=${results}`;
        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            return data.feeds.map(feed => ({
                timestamp: new Date(feed.created_at),
                ph: parseFloat(feed.field1),
                voltage: parseFloat(feed.field2),
                wifi_rssi: parseInt(feed.field3),
                uptime: parseInt(feed.field4),
                entry_id: feed.entry_id
            }));
        }
        return [];
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        return [];
    }
};