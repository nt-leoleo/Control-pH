// Utilidades para comunicación con ESP32 usando proxy de Vite

/**
 * Configuración de la comunicación con ESP32 usando proxy
 */
export const ESP32_CONFIG = {
    // Usar proxy local en desarrollo, directo en producción
    BASE_URL: import.meta.env.DEV ? '/api/esp32' : 'http://192.168.100.134',
    ENDPOINTS: {
        STATUS: '/status',
        PH_DATA: '/ph',
        DOSING: '/dosing'
    },
    TIMEOUT: 15000, // 15 segundos
    RETRY_INTERVAL: 30000 // 30 segundos entre reintentos
};

/**
 * Verifica si el ESP32 está conectado usando proxy
 * @returns {Promise<boolean>}
 */
export const checkESP32Connection = async () => {
    try {
        console.log('🔍 [PROXY] Intentando conectar a:', `${ESP32_CONFIG.BASE_URL}${ESP32_CONFIG.ENDPOINTS.STATUS}`);
        console.log('⏰ [PROXY] Timeout configurado:', ESP32_CONFIG.TIMEOUT, 'ms');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('⏰ [PROXY] TIMEOUT! Cancelando petición después de', ESP32_CONFIG.TIMEOUT, 'ms');
            controller.abort();
        }, ESP32_CONFIG.TIMEOUT);
        
        console.log('📤 [PROXY] Enviando petición fetch...');
        const startTime = Date.now();
        
        const response = await fetch(`${ESP32_CONFIG.BASE_URL}${ESP32_CONFIG.ENDPOINTS.STATUS}`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            }
        });
        
        const endTime = Date.now();
        clearTimeout(timeoutId);
        
        console.log('📡 [PROXY] Respuesta ESP32 recibida en', endTime - startTime, 'ms:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers: [...response.headers.entries()]
        });
        
        if (response.ok) {
            const text = await response.text();
            console.log('📄 [PROXY] Contenido respuesta:', text);
            try {
                const json = JSON.parse(text);
                console.log('✅ [PROXY] JSON parseado correctamente:', json);
                return true;
            } catch (e) {
                console.log('⚠️ [PROXY] Respuesta no es JSON válido pero hay conexión:', e);
                // Si hay respuesta HTML del ESP32, consideramos que está conectado
                if (text.includes('ESP32') || text.includes('status')) {
                    return true;
                }
                return false;
            }
        } else {
            console.log('❌ [PROXY] Respuesta no OK:', response.status, response.statusText);
            return false;
        }
        
    } catch (error) {
        console.error('❌ [PROXY] ESP32 connection check failed:', error);
        
        if (error.name === 'AbortError') {
            console.log('⏰ [PROXY] Petición cancelada por timeout');
        } else if (error.name === 'TypeError') {
            console.log('🌐 [PROXY] Error de red - Verificando si es problema de proxy...');
        }
        
        return false;
    }
};

/**
 * Obtiene los datos de pH del ESP32 usando proxy
 * @returns {Promise<{ph: number, timestamp: Date} | null>}
 */
export const getPHDataFromESP32 = async () => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ESP32_CONFIG.TIMEOUT);
        
        const response = await fetch(`${ESP32_CONFIG.BASE_URL}${ESP32_CONFIG.ENDPOINTS.PH_DATA}`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return {
            ph: parseFloat(data.ph),
            timestamp: new Date()
        };
    } catch (error) {
        console.error('[PROXY] Failed to get pH data from ESP32:', error.message);
        return null;
    }
};

/**
 * Envía comando de dosificación al ESP32 usando proxy
 * @param {Object} dosingConfig - Configuración de dosificación
 * @param {string} dosingConfig.product - Tipo de producto (acid/chlorine)
 * @param {number} dosingConfig.duration - Duración en segundos
 * @returns {Promise<boolean>}
 */
export const sendDosingCommand = async (dosingConfig) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ESP32_CONFIG.TIMEOUT);
        
        const response = await fetch(`${ESP32_CONFIG.BASE_URL}${ESP32_CONFIG.ENDPOINTS.DOSING}`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dosingConfig)
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        console.error('[PROXY] Failed to send dosing command to ESP32:', error.message);
        return false;
    }
};

/**
 * Obtiene la IP configurada del ESP32
 * @returns {string}
 */
export const getESP32IP = () => {
    return ESP32_CONFIG.BASE_URL.replace('http://', '').replace('/api/esp32', '192.168.100.134');
};

/**
 * Hook personalizado para manejar la conexión con ESP32 usando proxy
 * @param {Function} onDataReceived - Callback cuando se reciben datos
 * @param {Function} onConnectionChange - Callback cuando cambia el estado de conexión
 */
export const useESP32Connection = (onDataReceived, onConnectionChange) => {
    let connectionInterval;
    
    const startConnection = () => {
        // Verificar conexión cada 30 segundos
        connectionInterval = setInterval(async () => {
            const isConnected = await checkESP32Connection();
            onConnectionChange(isConnected);
            
            if (isConnected) {
                // Si está conectado, obtener datos de pH
                const phData = await getPHDataFromESP32();
                if (phData) {
                    onDataReceived(phData);
                }
            }
        }, ESP32_CONFIG.RETRY_INTERVAL);
        
        // Verificación inicial
        checkESP32Connection().then(onConnectionChange);
    };
    
    const stopConnection = () => {
        if (connectionInterval) {
            clearInterval(connectionInterval);
        }
    };
    
    return { startConnection, stopConnection };
};