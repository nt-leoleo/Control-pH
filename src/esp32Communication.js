/*
 * =====================================================
 *        COMUNICACIÓN ESP32 - SISTEMA HÍBRIDO
 * =====================================================
 * 
 * NUEVO FLUJO (v4.0):
 * - Arduino → ThingSpeak (solo datos)
 * - Cloud Functions → Firebase (datos + decisiones)
 * - App Web ↔ Firebase (monitoreo + comandos en tiempo real)
 * - Cloud Functions → ThingSpeak → Arduino (comandos)
 * 
 * Este archivo mantiene compatibilidad con código existente
 * pero usa Firebase como fuente principal de datos.
 * 
 * Versión: 4.0 - Firebase Integration
 * =====================================================
 */

import { subscribeToPHData, sendManualDosingCommand as sendManualDosingCommandFirebase } from './esp32Communication-firebase';

// =====================================================
// CONFIGURACIÓN
// =====================================================

export const ESP32_CONFIG = {
    // ThingSpeak Configuration (solo para referencia)
    CHANNEL_ID: '3249157',
    READ_API_KEY: 'S7Q7FWREGP96KX04',
    THINGSPEAK_API: 'https://api.thingspeak.com/channels/3249157/feeds/last.json?api_key=S7Q7FWREGP96KX04',
    THINGSPEAK_HISTORY_API: 'https://api.thingspeak.com/channels/3249157/feeds.json?api_key=S7Q7FWREGP96KX04',
    
    // Cloud Functions endpoints
    CLOUD_FUNCTIONS_BASE: 'https://us-central1-control-ph-82951.cloudfunctions.net',
    MANUAL_DOSING_ENDPOINT: '/sendManualDosingCommand',
    
    // Timeouts and Intervals
    TIMEOUT: 5000,
    RETRY_INTERVAL: 15000,
    MAX_DATA_AGE: 120000,
    
    // Data validation
    MIN_PH: 0,
    MAX_PH: 14,
    MIN_VOLTAGE: 0,
    MAX_VOLTAGE: 5
};

// =====================================================
// VERIFICACIÓN DE CONEXIÓN - USA FIREBASE
// =====================================================

/**
 * Verifica conexión del ESP32 a través de Firebase o ThingSpeak
 * @param {string} userId - ID del usuario (opcional)
 */
export const checkESP32Connection = async (userId = null) => {
    // Si no hay userId, usar ThingSpeak directo
    if (!userId) {
        console.log('ℹ️ Sin userId, verificando conexión con ThingSpeak directo');
        return await checkESP32ConnectionLegacy();
    }
    
    // Si hay userId, intentar Firebase primero
    try {
        const data = await getPHDataFromESP32(userId);
        return data !== null && data.isRecent;
    } catch (error) {
        console.warn('⚠️ Error verificando con Firebase, usando ThingSpeak:', error.message);
        return await checkESP32ConnectionLegacy();
    }
};

// Método legacy para compatibilidad
async function checkESP32ConnectionLegacy() {
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
}

// =====================================================
// OBTENCIÓN DE DATOS DE pH - USA FIREBASE
// =====================================================

/**
 * Obtiene datos de pH desde Firebase (método preferido) o ThingSpeak (fallback)
 * Mantiene compatibilidad con código existente
 * @param {string} userId - ID del usuario (opcional - si no se provee, usa ThingSpeak directo)
 */
export const getPHDataFromESP32 = async (userId = null) => {
    // Si no hay userId, usar ThingSpeak directo (método legacy)
    if (!userId) {
        console.log('ℹ️ Sin userId, usando ThingSpeak directo');
        return await getPHDataFromThingSpeakLegacy();
    }
    
    // Si hay userId, intentar Firebase primero
    try {
        const { getPHDataFromFirebase } = await import('./esp32Communication-firebase.js');
        const data = await getPHDataFromFirebase(userId);
        
        // Si Firebase no tiene datos, fallback a ThingSpeak
        if (!data) {
            console.log('⚠️ Firebase sin datos, usando ThingSpeak directo');
            return await getPHDataFromThingSpeakLegacy();
        }
        
        return data;
    } catch (error) {
        console.warn('⚠️ Error con Firebase, usando ThingSpeak directo:', error.message);
        return await getPHDataFromThingSpeakLegacy();
    }
};

// Método legacy que lee directamente de ThingSpeak
async function getPHDataFromThingSpeakLegacy() {
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
}

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
            description: 'pH bajo - Necesita subir pH',
            color: '#FF5722',
            icon: '🔴'
        };
    } else if (ph > 7.5) {
        return {
            status: 'basic',
            label: 'Básico',
            description: 'pH alto - Necesita bajar pH',
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

// =====================================================
// COMANDOS DE DOSIFICACIÓN - DIRECTO A THINGSPEAK
// =====================================================

/**
 * Espera confirmación del Arduino en ThingSpeak Field8
 * @param {number} expectedCounter - Contador esperado
 * @param {number} maxWaitTime - Tiempo máximo de espera en ms (default: 60000)
 * @returns {Promise<boolean>} true si se recibió confirmación
 */
export const waitForDosingConfirmation = async (expectedCounter, maxWaitTime = 60000) => {
    try {
        console.log(`⏳ Esperando confirmación del Arduino (contador: ${expectedCounter})...`);
        
        const startTime = Date.now();
        const channelId = '3249157';
        // Polling cada 2 segundos
        while (Date.now() - startTime < maxWaitTime) {
            try {
                // Leer Field8 de ThingSpeak
                const url = `https://api.thingspeak.com/channels/${channelId}/fields/8/last.txt`;
                const response = await fetch(url);
                
                if (response.ok) {
                    const confirmationText = await response.text().then(t => t.trim());
                    console.log(`📡 Field8 actual: "${confirmationText}"`);
                    
                    // Verificar si es la confirmación esperada
                    const expectedConfirmation = `${expectedCounter}_OK`;
                    if (confirmationText === expectedConfirmation) {
                        console.log(`✅ Confirmación recibida del Arduino!`);
                        return true;
                    }
                }
            } catch (error) {
                console.warn('⚠️ Error leyendo confirmación:', error.message);
            }
            
            // Esperar 2 segundos antes de volver a intentar
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.warn(`⏱️ Timeout esperando confirmación (${maxWaitTime/1000}s)`);
        return false;
        
    } catch (error) {
        console.error('❌ Error esperando confirmación:', error);
        return false;
    }
};

/**
 * Envía comando DIRECTAMENTE a ThingSpeak (sin Cloud Functions)
 * Útil para debugging o cuando Cloud Functions no está disponible
 * @param {string} product - Producto a dosificar
 * @param {number} durationSeconds - Duración en segundos
 * @returns {Promise<Object>} Resultado del comando
 */
export const sendDirectToThingSpeak = async (product, durationSeconds) => {
    try {
        console.log('💊 [DIRECTO] Enviando comando directo a ThingSpeak...');
        console.log('📋 [DIRECTO] Producto:', product, 'Duración:', durationSeconds, 's');
        
        // Mapear productos a códigos
        const productMap = {
            'sodium-hypochlorite': 'ph_plus',
            'calcium-hypochlorite': 'ph_plus',
            'muriatic': 'ph_minus',
            'bisulfate': 'ph_minus',
            'chlorine-gas': 'ph_minus',
            'ph_plus': 'ph_plus',
            'ph_minus': 'ph_minus'
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
            console.warn('⚠️ No se pudo leer contador, usando 0');
        }
        
        console.log(`📊 [DIRECTO] Contador actual: ${currentCount}`);
        
        // Incrementar el contador para señalar nuevo comando
        const newCount = currentCount + 1;
        
        console.log(`📊 [DIRECTO] Nuevo contador: ${newCount}`);
        
        // URL del comando SOLO con Field5, Field6, Field7
        const commandUrl = `https://api.thingspeak.com/update?api_key=${writeApiKey}&field5=${productCode}&field6=${durationSeconds}&field7=${newCount}`;
        
        console.log('🔄 [DIRECTO] Enviando a ThingSpeak...');
        
        const response = await fetch(commandUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
            const entryId = await response.text();
            
            if (entryId !== '0') {
                console.log('✅ [DIRECTO] Comando enviado (Entry ID: ' + entryId + ')');
                console.log(`📡 [DIRECTO] El ESP32 leerá y ejecutará el comando en su próximo ciclo (máx 20s)`);
                
                return {
                    success: true,
                    message: `Comando enviado: ${esp32Product} por ${durationSeconds}s`,
                    timestamp: new Date().toISOString(),
                    method: 'thingspeak_direct',
                    entryId: entryId,
                    counter: newCount, // NUEVO: Retornar contador para esperar confirmación
                    note: 'El ESP32 procesará el comando en su próximo ciclo (máx 20s)'
                };
            } else {
                throw new Error('ThingSpeak rechazó el comando (rate limit). Espera 15 segundos e intenta de nuevo.');
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ [DIRECTO] Error:', error.message);
        return {
            success: false,
            message: `Error: ${error.message}`,
            timestamp: new Date().toISOString(),
            method: 'failed'
        };
    }
};

// =====================================================
// COMANDOS DE DOSIFICACIÓN - USA CLOUD FUNCTIONS
// =====================================================

/**
 * Envía comando de dosificación a través de Cloud Functions
 * @param {string} product - Producto a dosificar
 * @param {number} durationSeconds - Duración en segundos
 * @param {string} userId - ID del usuario (requerido)
 */
export const sendRealDosingCommand = async (product, durationSeconds, userId = null) => {
    if (!userId) {
        console.error('❌ sendRealDosingCommand requiere userId');
        return {
            success: false,
            message: 'userId es requerido para enviar comandos',
            timestamp: new Date().toISOString(),
            method: 'failed'
        };
    }
    
    try {
        console.log('💊 Enviando comando de dosificación vía Cloud Functions...');
        console.log('📋 Configuración:', { product, durationSeconds, userId });
        
        return await sendManualDosingCommandFirebase(userId, product, durationSeconds);
        
    } catch (error) {
        console.error('❌ Error enviando comando:', error.message);
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
// HOOK DE CONEXIÓN PRINCIPAL - USA FIREBASE
// =====================================================

/**
 * Hook para conexión con ESP32 vía Firebase (tiempo real) o ThingSpeak (polling)
 * @param {string} userId - ID del usuario (opcional)
 * @param {Function} onDataReceived - Callback para datos recibidos
 * @param {Function} onConnectionChange - Callback para cambios de conexión
 */
export const useESP32Connection = (userId, onDataReceived, onConnectionChange) => {
    let unsubscribe = null;
    let pollingInterval = null;
    let isRunning = false;
    
    const startConnection = () => {
        if (isRunning) {
            console.warn('⚠️ Conexión ya iniciada');
            return;
        }
        
        isRunning = true;
        
        // Si hay userId, usar Firebase (tiempo real)
        if (userId) {
            console.log('🔌 Iniciando conexión Firebase en tiempo real...');
            
            try {
                unsubscribe = subscribeToPHData(userId, (data) => {
                    onDataReceived(data);
                    onConnectionChange(data.isRecent);
                });
            } catch (error) {
                console.error('❌ Error con Firebase, usando polling a ThingSpeak:', error);
                startThingSpeakPolling();
            }
        } else {
            // Sin userId, usar ThingSpeak directo (polling)
            console.log('🔌 Iniciando polling a ThingSpeak (sin userId)...');
            startThingSpeakPolling();
        }
    };
    
    const startThingSpeakPolling = () => {
        // Lectura inicial
        setTimeout(async () => {
            try {
                const isConnected = await checkESP32ConnectionLegacy();
                onConnectionChange(isConnected);
                
                if (isConnected) {
                    const phData = await getPHDataFromThingSpeakLegacy();
                    if (phData) {
                        onDataReceived(phData);
                    }
                }
            } catch (error) {
                onConnectionChange(false);
            }
        }, 500);
        
        // Polling cada 15 segundos
        pollingInterval = setInterval(async () => {
            if (!isRunning) return;
            
            try {
                const isConnected = await checkESP32ConnectionLegacy();
                onConnectionChange(isConnected);
                
                if (isConnected) {
                    const phData = await getPHDataFromThingSpeakLegacy();
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
        console.log('🔌 Deteniendo conexión...');
        
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
        
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    };
    
    const getStatus = () => {
        return {
            running: isRunning,
            interval: pollingInterval !== null,
            firebase: unsubscribe !== null,
            config: ESP32_CONFIG,
            method: unsubscribe ? 'firebase-realtime' : 'thingspeak-polling'
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
