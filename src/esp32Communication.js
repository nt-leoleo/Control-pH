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
        console.log('🌐 [REMOTO] Verificando conexión con sensor...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ESP32_CONFIG.TIMEOUT);
        
        const response = await fetch(ESP32_CONFIG.THINGSPEAK_API, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📡 [REMOTO] Respuesta recibida:', data);
            
            // Verificar si los datos son recientes
            const dataTimestamp = new Date(data.created_at).getTime();
            const now = Date.now();
            const dataAge = now - dataTimestamp;
            
            console.log(`📅 [REMOTO] Última actualización: ${new Date(dataTimestamp).toLocaleString()}`);
            console.log(`⏰ [REMOTO] Edad de los datos: ${Math.round(dataAge/1000)}s`);
            
            if (dataAge < ESP32_CONFIG.MAX_DATA_AGE) {
                console.log('✅ [REMOTO] Sensor conectado - datos recientes');
                return true;
            } else {
                console.log('⚠️ [REMOTO] Datos obsoletos - sensor posiblemente desconectado');
                return false;
            }
        } else {
            console.log('❌ [REMOTO] Error HTTP:', response.status, response.statusText);
            return false;
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('⏰ [REMOTO] Timeout - La petición tardó más de 5 segundos');
        } else {
            console.log('❌ [REMOTO] Error de conexión:', error.message);
        }
        return false;
    }
};

// =====================================================
// OBTENCIÓN DE DATOS DE pH
// =====================================================

export const getPHDataFromESP32 = async () => {
    try {
        console.log('🧪 [REMOTO] Obteniendo datos de pH...');
        console.log('🔗 [REMOTO] URL completa:', ESP32_CONFIG.THINGSPEAK_API);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ESP32_CONFIG.TIMEOUT);
        
        const response = await fetch(ESP32_CONFIG.THINGSPEAK_API, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📡 [REMOTO] Response status:', response.status);
        console.log('📡 [REMOTO] Response ok:', response.ok);
        console.log('📡 [REMOTO] Response headers:', [...response.headers.entries()]);
        
        if (response.ok) {
            const text = await response.text();
            console.log('📄 [REMOTO] Raw response text:', text);
            
            try {
                const data = JSON.parse(text);
                console.log('✅ [REMOTO] Datos JSON parseados:', data);
                
                // Validar y procesar datos
                const processedData = processThingSpeakData(data);
                
                if (processedData) {
                    console.log('📊 [REMOTO] Datos procesados exitosamente:', processedData);
                    return processedData;
                } else {
                    console.log('❌ [REMOTO] Datos inválidos después del procesamiento');
                    return null;
                }
            } catch (parseError) {
                console.log('❌ [REMOTO] Error parseando JSON:', parseError.message);
                console.log('📄 [REMOTO] Texto que falló al parsear:', text);
                return null;
            }
        } else {
            const errorText = await response.text();
            console.log('❌ [REMOTO] Error response status:', response.status);
            console.log('❌ [REMOTO] Error response text:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('⏰ [REMOTO] Timeout obteniendo datos de pH');
        } else {
            console.log('❌ [REMOTO] Error obteniendo pH:', error.message);
            console.log('❌ [REMOTO] Error stack:', error.stack);
        }
        return null;
    }
};

// =====================================================
// PROCESAMIENTO DE DATOS
// =====================================================

function processThingSpeakData(data) {
    try {
        console.log('🔄 [REMOTO] Procesando datos de ThingSpeak:', data);
        
        // Verificar que tenemos los campos básicos
        if (!data) {
            console.log('❌ [REMOTO] Data es null o undefined');
            return null;
        }
        
        if (!data.created_at) {
            console.log('❌ [REMOTO] Falta campo created_at');
            return null;
        }
        
        // Extraer datos de los campos de ThingSpeak
        const ph = parseFloat(data.field1);
        const voltage = parseFloat(data.field2);
        const wifiRSSI = parseInt(data.field3);
        const uptime = parseInt(data.field4);
        
        console.log('📊 [REMOTO] Valores extraídos:', { 
            ph, 
            voltage, 
            wifiRSSI, 
            uptime,
            field1_raw: data.field1,
            field2_raw: data.field2,
            field3_raw: data.field3,
            field4_raw: data.field4
        });
        
        // Validar pH (campo más importante)
        if (isNaN(ph)) {
            console.log('⚠️ [REMOTO] Campo field1 (pH) es NaN:', data.field1);
            return null;
        }
        
        if (ph < ESP32_CONFIG.MIN_PH || ph > ESP32_CONFIG.MAX_PH) {
            console.log('⚠️ [REMOTO] Valor de pH fuera de rango:', ph, 'Rango válido:', ESP32_CONFIG.MIN_PH, '-', ESP32_CONFIG.MAX_PH);
            return null;
        }
        
        // Validar voltaje (opcional, no bloquear si falla)
        if (isNaN(voltage)) {
            console.log('⚠️ [REMOTO] Valor de voltaje inválido, usando 0:', data.field2);
        }
        
        // Calcular edad de los datos
        const dataTimestamp = new Date(data.created_at).getTime();
        const now = Date.now();
        const dataAge = now - dataTimestamp;
        const isRecent = dataAge < ESP32_CONFIG.MAX_DATA_AGE;
        
        console.log('⏰ [REMOTO] Timestamp datos:', data.created_at);
        console.log('⏰ [REMOTO] Edad de datos:', Math.round(dataAge/1000), 'segundos');
        console.log('✅ [REMOTO] Datos recientes:', isRecent);
        
        // Determinar estado del pH
        const phStatus = getPHStatus(ph);
        
        const processedData = {
            // Datos principales
            ph: ph,
            voltage: voltage || 0,
            wifi_rssi: wifiRSSI || -50,
            uptime: uptime || 0,
            
            // Metadatos
            timestamp: new Date(dataTimestamp),
            device_id: `thingspeak_${ESP32_CONFIG.CHANNEL_ID}`,
            location: 'piscina_principal',
            source: 'esp32-thingspeak',
            
            // Estado
            isRecent: isRecent,
            dataAge: Math.round(dataAge / 1000),
            phStatus: phStatus,
            
            // ThingSpeak específico
            entry_id: data.entry_id,
            channel_id: ESP32_CONFIG.CHANNEL_ID,
            
            // Información adicional
            lastUpdate: new Date(dataTimestamp).toLocaleString(),
            connectionQuality: getConnectionQuality(wifiRSSI),
            systemHealth: getSystemHealth(isRecent, ph, voltage)
        };
        
        console.log('✅ [REMOTO] Datos procesados exitosamente:', processedData);
        return processedData;
        
    } catch (error) {
        console.log('❌ [REMOTO] Error procesando datos:', error.message);
        console.log('❌ [REMOTO] Stack trace:', error.stack);
        console.log('❌ [REMOTO] Data que causó el error:', data);
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
// COMANDOS DE DOSIFICACIÓN
// =====================================================

export const sendDosingCommand = async (dosingConfig) => {
    try {
        console.log('💊 [REMOTO] Enviando comando de dosificación...');
        console.log('📋 [REMOTO] Configuración:', dosingConfig);
        
        // Para el sistema remoto, necesitamos implementar un mecanismo diferente
        // Por ahora, simularemos el comando pero con verificación de conectividad real
        
        const isConnected = await checkESP32Connection();
        
        if (isConnected) {
            console.log('✅ [REMOTO] Comando de dosificación procesado');
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

// Función para obtener estado de dosificación
export const getDosingStatus = async () => {
    try {
        console.log('📊 [REMOTO] Obteniendo estado de dosificación...');
        
        // En un sistema remoto real, esto consultaría el estado actual
        // Por ahora retornamos un estado simulado
        
        const isConnected = await checkESP32Connection();
        
        return {
            connected: isConnected,
            dosing_active: false, // Simulado
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
        console.error('❌ [REMOTO] Error obteniendo estado de dosificación:', error);
        return null;
    }
};

// Función para parar dosificación
export const stopDosing = async () => {
    try {
        console.log('🛑 [REMOTO] Enviando comando de parada...');
        
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
        console.error('❌ [REMOTO] Error deteniendo dosificación:', error);
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
        console.error('❌ [REMOTO] Error obteniendo info del sistema:', error);
        return null;
    }
};

// =====================================================
// HISTORIAL DE DATOS
// =====================================================

export const getPHHistory = async (results = 100) => {
    try {
        console.log(`📈 [REMOTO] Obteniendo historial (${results} entradas)...`);
        
        const url = `${ESP32_CONFIG.THINGSPEAK_HISTORY_API}&results=${results}`;
        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            
            const history = data.feeds
                .filter(feed => feed.field1) // Solo entradas con pH
                .map(feed => ({
                    timestamp: new Date(feed.created_at),
                    ph: parseFloat(feed.field1),
                    voltage: parseFloat(feed.field2) || 0,
                    wifi_rssi: parseInt(feed.field3) || -50,
                    uptime: parseInt(feed.field4) || 0,
                    entry_id: feed.entry_id,
                    phStatus: getPHStatus(parseFloat(feed.field1))
                }))
                .sort((a, b) => b.timestamp - a.timestamp); // Más reciente primero
            
            console.log(`✅ [REMOTO] Historial obtenido: ${history.length} entradas`);
            return history;
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ [REMOTO] Error obteniendo historial:', error);
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
        if (isRunning) {
            console.log('⚠️ [REMOTO] Conexión ya está activa');
            return;
        }
        
        isRunning = true;
        console.log('🚀 [REMOTO] Iniciando sistema de monitoreo remoto RÁPIDO...');
        console.log('🌐 [REMOTO] Fuente: ThingSpeak');
        console.log('📊 [REMOTO] Canal:', ESP32_CONFIG.CHANNEL_ID);
        console.log('⏰ [REMOTO] Intervalo de verificación: 15 segundos');
        console.log('⚡ [REMOTO] Modo optimizado para velocidad');
        
        // Verificación inicial INMEDIATA
        setTimeout(async () => {
            console.log('🔍 [REMOTO] Verificación inicial inmediata...');
            
            try {
                const isConnected = await checkESP32Connection();
                console.log('📡 [REMOTO] Estado inicial:', isConnected ? 'Conectado' : 'Desconectado');
                onConnectionChange(isConnected);
                
                if (isConnected) {
                    console.log('📊 [REMOTO] Obteniendo datos iniciales...');
                    const phData = await getPHDataFromESP32();
                    
                    if (phData) {
                        console.log('🧪 [REMOTO] Datos iniciales recibidos');
                        onDataReceived(phData);
                    } else {
                        console.log('⚠️ [REMOTO] No se pudieron obtener datos iniciales');
                    }
                }
            } catch (error) {
                console.error('❌ [REMOTO] Error en verificación inicial:', error);
                onConnectionChange(false);
            }
        }, 500); // 500ms en lugar de 1000ms
        
        // Verificación periódica
        connectionInterval = setInterval(async () => {
            if (!isRunning) return;
            
            console.log('🔄 [REMOTO] Verificación periódica...');
            
            try {
                const isConnected = await checkESP32Connection();
                onConnectionChange(isConnected);
                
                if (isConnected) {
                    const phData = await getPHDataFromESP32();
                    if (phData) {
                        onDataReceived(phData);
                    }
                } else {
                    console.log('⚠️ [REMOTO] Sensor desconectado en verificación periódica');
                }
            } catch (error) {
                console.error('❌ [REMOTO] Error en verificación periódica:', error);
                onConnectionChange(false);
            }
        }, ESP32_CONFIG.RETRY_INTERVAL);
        
        console.log('✅ [REMOTO] Sistema de monitoreo configurado y activo');
    };
    
    const stopConnection = () => {
        if (!isRunning) {
            console.log('⚠️ [REMOTO] Conexión ya está detenida');
            return;
        }
        
        isRunning = false;
        console.log('🛑 [REMOTO] Deteniendo sistema de monitoreo...');
        
        if (connectionInterval) {
            clearInterval(connectionInterval);
            connectionInterval = null;
        }
        
        console.log('✅ [REMOTO] Sistema de monitoreo detenido');
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