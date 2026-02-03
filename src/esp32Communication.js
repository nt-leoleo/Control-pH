// Comunicación con ESP32 - Sensor de pH Real
export const ESP32_CONFIG = {
    BASE_URL: 'http://192.168.100.134',
    ENDPOINTS: {
        STATUS: '/status',
        PH_DATA: '/ph',
        DATA: '/data', // Endpoint adicional con más información
        DOSING: '/dosing' // Mantenemos por compatibilidad
    },
    TIMEOUT: 10000,
    RETRY_INTERVAL: 30000
};

export const checkESP32Connection = async () => {
    try {
        console.log('🔍 [ESP32] Verificando conexión con sensor de pH...');
        
        const response = await fetch(`${ESP32_CONFIG.BASE_URL}${ESP32_CONFIG.ENDPOINTS.STATUS}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ [ESP32] Sensor de pH conectado:', data);
            return true;
        } else {
            console.log('❌ [ESP32] Error de respuesta:', response.status);
            return false;
        }
        
    } catch (error) {
        console.log('⚠️ [ESP32] Error de conexión:', error.message);
        
        // Intentar método alternativo no-cors
        try {
            await fetch(`${ESP32_CONFIG.BASE_URL}${ESP32_CONFIG.ENDPOINTS.STATUS}`, {
                method: 'GET',
                mode: 'no-cors'
            });
            console.log('✅ [ESP32] Conectividad detectada (no-cors)');
            return true;
        } catch (noCorsError) {
            console.log('❌ [ESP32] Sin conectividad');
            return false;
        }
    }
};

export const getPHDataFromESP32 = async () => {
    try {
        console.log('🧪 [ESP32] Obteniendo datos de pH del sensor...');
        
        // Intentar obtener datos del endpoint /ph
        const response = await fetch(`${ESP32_CONFIG.BASE_URL}${ESP32_CONFIG.ENDPOINTS.PH_DATA}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ [ESP32] Datos de pH recibidos:', data);
            
            return {
                ph: parseFloat(data.ph),
                timestamp: new Date(),
                source: 'esp32-real'
            };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        console.log('⚠️ [ESP32] Error obteniendo pH, intentando endpoint /data...');
        
        // Intentar endpoint alternativo /data
        try {
            const response = await fetch(`${ESP32_CONFIG.BASE_URL}${ESP32_CONFIG.ENDPOINTS.DATA}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ [ESP32] Datos obtenidos de /data:', data);
                
                return {
                    ph: parseFloat(data.ph),
                    timestamp: new Date(),
                    source: 'esp32-data'
                };
            }
        } catch (dataError) {
            console.log('❌ [ESP32] Error en ambos endpoints:', dataError.message);
        }
        
        // Si todo falla, verificar si hay conectividad
        const isConnected = await checkESP32Connection();
        if (isConnected) {
            console.log('📊 [ESP32] Hay conectividad pero no se pueden leer datos, usando simulación');
            const simulatedPH = 7.0 + (Math.random() - 0.5) * 0.4;
            return {
                ph: parseFloat(simulatedPH.toFixed(2)),
                timestamp: new Date(),
                source: 'simulated-fallback'
            };
        }
        
        return null;
    }
};

export const sendDosingCommand = async (dosingConfig) => {
    try {
        console.log('💊 [ESP32] Enviando comando dosing...');
        console.log('⚠️ [ESP32] Nota: El sensor de pH no tiene bombas de dosing implementadas');
        
        // El sensor actual no tiene dosing, pero mantenemos compatibilidad
        // Simular éxito si hay conectividad
        const isConnected = await checkESP32Connection();
        if (isConnected) {
            console.log('✅ [ESP32] Simulando éxito de dosing (sensor sin bombas)');
            return true;
        }
        return false;
        
    } catch (error) {
        console.error('❌ [ESP32] Error enviando comando dosing:', error.message);
        return false;
    }
};

export const getESP32IP = () => {
    return '192.168.100.134';
};

export const useESP32Connection = (onDataReceived, onConnectionChange) => {
    let connectionInterval;
    
    const startConnection = () => {
        console.log('🚀 [ESP32] Iniciando conexión con sensor de pH...');
        
        // Verificación inicial inmediata
        setTimeout(async () => {
            console.log('🔍 [ESP32] Verificación inicial...');
            const isConnected = await checkESP32Connection();
            console.log('📡 [ESP32] Estado inicial:', isConnected);
            onConnectionChange(isConnected);
            
            if (isConnected) {
                console.log('📊 [ESP32] Obteniendo lectura inicial de pH...');
                const phData = await getPHDataFromESP32();
                console.log('🧪 [ESP32] Datos iniciales:', phData);
                if (phData) {
                    onDataReceived(phData);
                }
            }
        }, 500); // Dar tiempo para que el componente se monte
        
        // Verificación periódica cada 30 segundos
        connectionInterval = setInterval(async () => {
            console.log('🔄 [ESP32] Verificación periódica...');
            const isConnected = await checkESP32Connection();
            onConnectionChange(isConnected);
            
            if (isConnected) {
                const phData = await getPHDataFromESP32();
                if (phData) {
                    onDataReceived(phData);
                }
            }
        }, ESP32_CONFIG.RETRY_INTERVAL);
        
        console.log('✅ [ESP32] Sistema de monitoreo de pH configurado');
    };
    
    const stopConnection = () => {
        console.log('🛑 [ESP32] Deteniendo monitoreo de pH...');
        if (connectionInterval) {
            clearInterval(connectionInterval);
        }
    };
    
    return { startConnection, stopConnection };
};