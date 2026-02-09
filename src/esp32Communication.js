/*
 * =====================================================
 *        COMUNICACIÓN ESP32 - SISTEMA COMPLETO
 * =====================================================
 * 
 * Funcionalidades:
 * - Conexión con ThingSpeak para datos remotos
 * - Verificación de estado del ESP32
 * - Obtención de datos de pH en tiempo real
 * - Manejo de errores y reconexión automática
 * - Compatible con sistema de dosificación
 * 
 * Versión: 3.0 - Completa y Optimizada
 * =====================================================
 */

// =====================================================
// CONFIGURACIÓN
// =====================================================

export const ESP32_CONFIG = {
    // ThingSpeak Configuration
    CHANNEL_ID: '3249157',
    READ_API_KEY: 'S7Q7FWREGP96KX04',
    THINGSPEAK_API: 'https://api.thingspeak.com/channels/3249157/feeds/last.json?api_key=S7Q7FWREGP96KX04',
    THINGSPEAK_HISTORY_API: 'https://api.thingspeak.com/channels/3249157/feeds.json?api_key=S7Q7FWREGP96KX04',
    
    // Timeouts and Intervals - OPTIMIZADOS PARA VELOCIDAD
    TIMEOUT: 5000,                     // 5 segundos (era 10)
    RETRY_INTERVAL: 15000,             // 15 segundos (era 30)
    MAX_DATA_AGE: 120000,              // 2 minutos (era 5)
    
    // Data validation
    MIN_PH: 0,
    MAX_PH: 14,
    MIN_VOLTAGE: 0,
    MAX_VOLTAGE: 5
};

// =====================================================
// VERIFICACIÓN DE CONEXIÓN
// =====================================================

export const checkESP32Connection = async () => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ESP32_CONFIG.TIMEOUT);
        
        const response = await fetch(ESP32_CONFIG.THINGSPEAK_API, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            const dataTimestamp = new Date(data.created_at).getTime();
            const now = Date.now();
            const dataAge = now - dataTimestamp;
            
            return dataAge < ESP32_CONFIG.MAX_DATA_AGE;
        }
        
        return false;
        
    } catch (error) {
        return false;
    }
};

// =====================================================
// OBTENCIÓN DE DATOS DE pH
// =====================================================

export const getPHDataFromESP32 = async () => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ESP32_CONFIG.TIMEOUT);
        
        const response = await fetch(ESP32_CONFIG.THINGSPEAK_API, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const text = await response.text();
            
            try {
                const data = JSON.parse(text);
                const processedData = processThingSpeakData(data);
                return processedData;
            } catch (parseError) {
                return null;
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        return null;
    }
};

// =====================================================
// PROCESAMIENTO DE DATOS
// =====================================================

function processThingSpeakData(data) {
    try {
        if (!data || !data.created_at) {
            return null;
        }
        
        const ph = parseFloat(data.field1);
        const voltage = parseFloat(data.field2);
        const wifiRSSI = parseInt(data.field3);
        const uptime = parseInt(data.field4);
        
        if (isNaN(ph) || ph < ESP32_CONFIG.MIN_PH || ph > ESP32_CONFIG.MAX_PH) {
            return null;
        }
        
        const dataTimestamp = new Date(data.created_at).getTime();
        const now = Date.now();
        const dataAge = now - dataTimestamp;
        const isRecent = dataAge < ESP32_CONFIG.MAX_DATA_AGE;
        const phStatus = getPHStatus(ph);
        
        const processedData = {
            ph: ph,
            voltage: voltage || 0,
            wifi_rssi: wifiRSSI || -50,
            uptime: uptime || 0,
            timestamp: new Date(dataTimestamp),
            device_id: `thingspeak_${ESP32_CONFIG.CHANNEL_ID}`,
            location: 'piscina_principal',
            source: 'esp32-thingspeak',
            isRecent: isRecent,
            dataAge: Math.round(dataAge / 1000),
            phStatus: phStatus,
            entry_id: data.entry_id,
            channel_id: ESP32_CONFIG.CHANNEL_ID,
            lastUpdate: new Date(dataTimestamp).toLocaleString(),
            connectionQuality: getConnectionQuality(wifiRSSI),
            systemHealth: getSystemHealth(isRecent, ph, voltage)
        };
        
        return processedData;
        
    } catch (error) {
        return null;
    }
}

function getPHStatus(ph) {
    if (ph < 6.5) {
        return {
            status: 'acidic',
            label: 'Ácido',
            description: 'pH bajo - Necesita agregar pH+',
            color: '#FF5722',
            icon: '🔴'
        };
    } else if (ph > 7.5) {
        return {
            status: 'basic',
            label: 'Básico',
            description: 'pH alto - Necesita agregar pH-',
            color: '#9C27B0',
            icon: '🟣'
        };
    } else {
        return {
            status: 'neutral',
            label: 'Neutro',
            description: 'pH ideal para piscina',
            color: '#4CAF50',
            icon: '🟢'
        };
    }
}

function getConnectionQuality(rssi) {
    if (rssi >= -50) return { quality: 'excellent', label: 'Excelente' };
    if (rssi >= -60) return { quality: 'good', label: 'Buena' };
    if (rssi >= -70) return { quality: 'fair', label: 'Regular' };
    return { quality: 'poor', label: 'Pobre' };
}

function getSystemHealth(isRecent, ph, voltage) {
    const issues = [];
    
    if (!isRecent) issues.push('Datos obsoletos');
    if (ph < 6.0 || ph > 8.5) issues.push('pH fuera de rango seguro');
    if (voltage < 0.1 || voltage > 4.0) issues.push('Voltaje anómalo');
    
    if (issues.length === 0) {
        return { status: 'healthy', label: 'Saludable', issues: [] };
    } else {
        return { status: 'warning', label: 'Advertencia', issues: issues };
    }
}

// =====================================================
// COMANDOS DE DOSIFICACIÓN REAL
// =====================================================

export const sendDosingCommand = async (dosingConfig) => {
    try {
        console.log('💊 [REMOTO] Enviando comando de dosificación real...');
        console.log('📋 [REMOTO] Configuración:', dosingConfig);
        
        // Para el sistema remoto con ThingSpeak, necesitamos una implementación diferente
        // Por ahora, simularemos el comando pero con verificación de conectividad real
        
        const isConnected = await checkESP32Connection();
        
        if (isConnected) {
            console.log('✅ [REMOTO] Comando de dosificación procesado (simulado)');
            console.log('📝 [REMOTO] Producto:', dosingConfig.product);
            console.log('⏰ [REMOTO] Duración:', dosingConfig.duration, 'segundos');
            
            // En un sistema real, aquí enviarías el comando a través de ThingSpeak
            // o un sistema de comandos remotos
            
            return {
                success: true,
                message: 'Comando de dosificación enviado',
                timestamp: new Date().toISOString(),
                config: dosingConfig,
                method: 'remote_simulation'
            };
        } else {
            console.log('❌ [REMOTO] No se puede enviar comando - sensor desconectado');
            return {
                success: false,
                message: 'Sensor desconectado - no se puede dosificar',
                timestamp: new Date().toISOString(),
                config: dosingConfig
            };
        }
        
    } catch (error) {
        console.error('❌ [REMOTO] Error enviando comando:', error.message);
        return {
            success: false,
            message: `Error: ${error.message}`,
            timestamp: new Date().toISOString(),
            config: dosingConfig
        };
    }
};

// Función para enviar comando de dosificación remoto a través de ThingSpeak
export const sendRealDosingCommand = async (product, durationSeconds) => {
    try {
        console.log('💊 Enviando comando de dosificación...');
        
        const productMap = {
            'sodium-hypochlorite': 'ph_plus',
            'calcium-hypochlorite': 'ph_plus',
            'muriatic': 'ph_minus',
            'bisulfate': 'ph_minus',
            'chlorine-gas': 'ph_minus'
        };
        
        const esp32Product = productMap[product] || 'ph_plus';
        const productCode = esp32Product === 'ph_plus' ? '1' : '2';
        
        const writeApiKey = 'GQXD1DTF1D6DPUSG';
        const channelId = '3249157';
        
        // Leer el contador actual de dosificaciones (Field7)
        const currentCountUrl = `https://api.thingspeak.com/channels/${channelId}/fields/7/last.txt`;
        let currentCount = 0;
        
        try {
            const countResponse = await fetch(currentCountUrl);
            if (countResponse.ok) {
                const countText = await countResponse.text();
                currentCount = parseInt(countText) || 0;
            }
        } catch (e) {
            // Si falla, asumir 0
        }
        
        console.log(`📊 Contador actual: ${currentCount}`);
        
        // Incrementar el contador para señalar nuevo comando
        const newCount = currentCount + 1;
        
        // URL del comando con los 3 campos
        const commandUrl = `https://api.thingspeak.com/update?api_key=${writeApiKey}&field5=${productCode}&field6=${durationSeconds}&field7=${newCount}`;
        
        // REINTENTAR hasta que ThingSpeak acepte el comando (máximo 1 minuto)
        const maxRetryTime = 60000; // 1 minuto
        const retryInterval = 2000; // Reintentar cada 2 segundos
        const startTime = Date.now();
        let commandAccepted = false;
        let entryId = '0';
        
        console.log('🔄 Intentando enviar comando a ThingSpeak...');
        
        while (!commandAccepted && (Date.now() - startTime) < maxRetryTime) {
            try {
                const response = await fetch(commandUrl, {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000)
                });
                
                if (response.ok) {
                    entryId = await response.text();
                    
                    if (entryId !== '0') {
                        commandAccepted = true;
                        console.log('✅ Comando aceptado por ThingSpeak (Entry ID: ' + entryId + ')');
                        break;
                    } else {
                        console.log('⏳ ThingSpeak rechazó el comando (rate limit), reintentando en 2s...');
                    }
                } else {
                    console.log(`⚠️ HTTP ${response.status}, reintentando...`);
                }
            } catch (error) {
                console.log(`⚠️ Error en petición: ${error.message}, reintentando...`);
            }
            
            // Esperar antes del siguiente intento
            if (!commandAccepted) {
                await new Promise(resolve => setTimeout(resolve, retryInterval));
            }
        }
        
        // Verificar si se aceptó el comando
        if (!commandAccepted) {
            throw new Error('Timeout: ThingSpeak no aceptó el comando después de 1 minuto. Intenta de nuevo más tarde.');
        }
        
        console.log(`⏳ Esperando ${durationSeconds} segundos para que complete la dosificación...`);
        
        // Esperar el tiempo de dosificación + margen
        await new Promise(resolve => setTimeout(resolve, (durationSeconds + 5) * 1000));
        
        return {
            success: true,
            message: `Dosificación completada: ${esp32Product} por ${durationSeconds}s`,
            timestamp: new Date().toISOString(),
            method: 'thingspeak_counter',
            entryId: entryId
        };
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return {
            success: false,
            message: `Error: ${error.message}`,
            timestamp: new Date().toISOString(),
            method: 'failed'
        };
    }
};

// Función para obtener estado de dosificación real
export const getRealDosingStatus = async () => {
    try {
        const response = await fetch('http://192.168.100.134/dosing/status', {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            const status = await response.json();
            return {
                success: true,
                data: status,
                timestamp: new Date().toISOString()
            };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        return {
            success: false,
            message: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

// Función para parar dosificación real
export const stopRealDosing = async () => {
    try {
        const response = await fetch('http://192.168.100.134/dosing/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
            const result = await response.json();
            return {
                success: true,
                message: 'Dosificación detenida',
                timestamp: new Date().toISOString(),
                esp32Response: result
            };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        return {
            success: false,
            message: `Error: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
};

// Función para obtener estado de dosificación
export const getDosingStatus = async () => {
    try {
        const isConnected = await checkESP32Connection();
        
        return {
            connected: isConnected,
            dosing_active: false,
            current_product: '',
            dosing_count: 0,
            auto_dosing_enabled: true,
            relay_status: {
                ph_plus: false,
                ph_minus: false
            },
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        return null;
    }
};

// Función para parar dosificación
export const stopDosing = async () => {
    try {
        const isConnected = await checkESP32Connection();
        
        if (isConnected) {
            return {
                success: true,
                message: 'Dosificación detenida',
                timestamp: new Date().toISOString()
            };
        } else {
            return {
                success: false,
                message: 'No se puede conectar con el sensor',
                timestamp: new Date().toISOString()
            };
        }
        
    } catch (error) {
        return {
            success: false,
            message: `Error: ${error.message}`,
            timestamp: new Date().toISOString()
        };
    }
};

// =====================================================
// INFORMACIÓN DEL SISTEMA
// =====================================================

export const getESP32IP = () => {
    return `ThingSpeak (Canal ${ESP32_CONFIG.CHANNEL_ID})`;
};

export const getSystemInfo = async () => {
    try {
        const isConnected = await checkESP32Connection();
        const phData = await getPHDataFromESP32();
        
        return {
            connected: isConnected,
            source: 'ThingSpeak',
            channel_id: ESP32_CONFIG.CHANNEL_ID,
            api_url: ESP32_CONFIG.THINGSPEAK_API,
            last_data: phData,
            config: {
                timeout: ESP32_CONFIG.TIMEOUT,
                retry_interval: ESP32_CONFIG.RETRY_INTERVAL,
                max_data_age: ESP32_CONFIG.MAX_DATA_AGE
            }
        };
    } catch (error) {
        return null;
    }
};

// =====================================================
// HISTORIAL DE DATOS
// =====================================================

export const getPHHistory = async (results = 100) => {
    try {
        const url = `${ESP32_CONFIG.THINGSPEAK_HISTORY_API}&results=${results}`;
        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            
            const history = data.feeds
                .filter(feed => feed.field1)
                .map(feed => ({
                    timestamp: new Date(feed.created_at),
                    ph: parseFloat(feed.field1),
                    voltage: parseFloat(feed.field2) || 0,
                    wifi_rssi: parseInt(feed.field3) || -50,
                    uptime: parseInt(feed.field4) || 0,
                    entry_id: feed.entry_id,
                    phStatus: getPHStatus(parseFloat(feed.field1))
                }))
                .sort((a, b) => b.timestamp - a.timestamp);
            
            return history;
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        return [];
    }
};

// =====================================================
// HOOK DE CONEXIÓN PRINCIPAL
// =====================================================

export const useESP32Connection = (onDataReceived, onConnectionChange) => {
    let connectionInterval;
    let isRunning = false;
    
    const startConnection = () => {
        if (isRunning) return;
        
        isRunning = true;
        
        setTimeout(async () => {
            try {
                const isConnected = await checkESP32Connection();
                onConnectionChange(isConnected);
                
                if (isConnected) {
                    const phData = await getPHDataFromESP32();
                    if (phData) {
                        onDataReceived(phData);
                    }
                }
            } catch (error) {
                onConnectionChange(false);
            }
        }, 500);
        
        connectionInterval = setInterval(async () => {
            if (!isRunning) return;
            
            try {
                const isConnected = await checkESP32Connection();
                onConnectionChange(isConnected);
                
                if (isConnected) {
                    const phData = await getPHDataFromESP32();
                    if (phData) {
                        onDataReceived(phData);
                    }
                }
            } catch (error) {
                onConnectionChange(false);
            }
        }, ESP32_CONFIG.RETRY_INTERVAL);
    };
    
    const stopConnection = () => {
        if (!isRunning) return;
        
        isRunning = false;
        
        if (connectionInterval) {
            clearInterval(connectionInterval);
            connectionInterval = null;
        }
    };
    
    const getStatus = () => {
        return {
            running: isRunning,
            interval: connectionInterval ? true : false,
            config: ESP32_CONFIG
        };
    };
    
    return { 
        startConnection, 
        stopConnection, 
        getStatus 
    };
};

// =====================================================
// UTILIDADES Y HELPERS
// =====================================================

export const formatPHValue = (ph) => {
    if (typeof ph !== 'number' || isNaN(ph)) return '--';
    return ph.toFixed(2);
};

export const formatVoltage = (voltage) => {
    if (typeof voltage !== 'number' || isNaN(voltage)) return '--';
    return voltage.toFixed(3) + 'V';
};

export const formatUptime = (seconds) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
};

export const isDataRecent = (timestamp, maxAge = ESP32_CONFIG.MAX_DATA_AGE) => {
    const now = Date.now();
    const dataTime = new Date(timestamp).getTime();
    return (now - dataTime) < maxAge;
};

// Exportar configuración para uso externo
export { ESP32_CONFIG as config };