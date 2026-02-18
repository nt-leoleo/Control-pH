/*
 * =====================================================
 *    COMUNICACIÓN ESP32 - VERSIÓN SIMPLE Y CONFIABLE
 * =====================================================
 * 
 * Esta versión lee DIRECTAMENTE de ThingSpeak
 * Sin Firebase, sin complicaciones
 * 
 * Versión: SIMPLE - Garantizado que funciona
 * =====================================================
 */

// Configuración ThingSpeak
const CHANNEL_ID = '3249157';
const READ_API_KEY = 'S7Q7FWREGP96KX04';
const WRITE_API_KEY = 'GQXD1DTF1D6DPUSG';

/**
 * Lee datos del sensor desde ThingSpeak
 */
export const getPHDataFromESP32 = async () => {
    try {
        const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds/last.json?api_key=${READ_API_KEY}`;
        
        const response = await fetch(url, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        
        if (!response.ok) {
            console.error('❌ ThingSpeak HTTP error:', response.status);
            return null;
        }
        
        const data = await response.json();
        
        // Validar datos
        const ph = parseFloat(data.field1);
        if (isNaN(ph) || ph < 0 || ph > 14) {
            console.error('❌ pH inválido:', ph);
            return null;
        }
        
        // Verificar antigüedad
        const dataTime = new Date(data.created_at).getTime();
        const now = Date.now();
        const dataAge = now - dataTime;
        const isRecent = dataAge < 120000; // 2 minutos
        
        console.log('✅ Datos recibidos de ThingSpeak:', {
            ph: ph.toFixed(2),
            age: Math.round(dataAge / 1000) + 's',
            recent: isRecent
        });
        
        return {
            ph: ph,
            voltage: parseFloat(data.field2) || 0,
            wifi_rssi: parseInt(data.field3) || -50,
            uptime: parseInt(data.field4) || 0,
            timestamp: new Date(dataTime),
            isRecent: isRecent,
            dataAge: Math.round(dataAge / 1000),
            source: 'thingspeak-simple'
        };
        
    } catch (error) {
        console.error('❌ Error leyendo ThingSpeak:', error.message);
        return null;
    }
};

/**
 * Verifica si el ESP32 está conectado
 */
export const checkESP32Connection = async () => {
    try {
        const data = await getPHDataFromESP32();
        return data !== null && data.isRecent;
    } catch (error) {
        console.error('❌ Error verificando conexión:', error.message);
        return false;
    }
};

/**
 * Hook para conexión con polling simple
 */
export const useESP32Connection = (onDataReceived, onConnectionChange) => {
    let pollingInterval = null;
    let isRunning = false;
    
    const startConnection = () => {
        if (isRunning) {
            console.warn('⚠️ Conexión ya iniciada');
            return;
        }
        
        isRunning = true;
        console.log('🔌 Iniciando polling a ThingSpeak...');
        
        // Lectura inicial inmediata
        setTimeout(async () => {
            try {
                const data = await getPHDataFromESP32();
                if (data) {
                    onDataReceived(data);
                    onConnectionChange(data.isRecent);
                } else {
                    onConnectionChange(false);
                }
            } catch (error) {
                console.error('❌ Error en lectura inicial:', error);
                onConnectionChange(false);
            }
        }, 500);
        
        // Polling cada 15 segundos
        pollingInterval = setInterval(async () => {
            if (!isRunning) return;
            
            try {
                const data = await getPHDataFromESP32();
                if (data) {
                    onDataReceived(data);
                    onConnectionChange(data.isRecent);
                } else {
                    onConnectionChange(false);
                }
            } catch (error) {
                console.error('❌ Error en polling:', error);
                onConnectionChange(false);
            }
        }, 15000);
    };
    
    const stopConnection = () => {
        if (!isRunning) return;
        
        isRunning = false;
        console.log('🔌 Deteniendo polling...');
        
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    };
    
    const getStatus = () => {
        return {
            running: isRunning,
            method: 'thingspeak-simple-polling'
        };
    };
    
    return { 
        startConnection, 
        stopConnection, 
        getStatus 
    };
};

/**
 * Envía comando de dosificación directo a ThingSpeak
 */
export const sendDirectToThingSpeak = async (product, durationSeconds) => {
    try {
        console.log('💊 Enviando comando a ThingSpeak...');
        console.log('   Producto:', product);
        console.log('   Duración:', durationSeconds, 's');
        
        // Mapear productos
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
        
        // Leer contador actual
        const currentCountUrl = `https://api.thingspeak.com/channels/${CHANNEL_ID}/fields/7/last.txt`;
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
        
        const newCount = currentCount + 1;
        console.log('📊 Contador:', currentCount, '→', newCount);
        
        // Enviar comando
        const commandUrl = `https://api.thingspeak.com/update?api_key=${WRITE_API_KEY}&field5=${productCode}&field6=${durationSeconds}&field7=${newCount}`;
        
        const response = await fetch(commandUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
            const entryId = await response.text();
            
            if (entryId !== '0') {
                console.log('✅ Comando enviado (Entry ID:', entryId + ')');
                
                return {
                    success: true,
                    message: `Comando enviado: ${esp32Product} por ${durationSeconds}s`,
                    counter: newCount,
                    entryId: entryId,
                    timestamp: new Date().toISOString()
                };
            } else {
                throw new Error('ThingSpeak rechazó el comando (rate limit)');
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        return {
            success: false,
            message: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

/**
 * Espera confirmación del Arduino
 */
export const waitForDosingConfirmation = async (expectedCounter, maxWaitTime = 60000) => {
    try {
        console.log(`⏳ Esperando confirmación (contador: ${expectedCounter})...`);
        
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/fields/8/last.txt`;
                const response = await fetch(url);
                
                if (response.ok) {
                    const confirmationText = await response.text().then(t => t.trim());
                    const expectedConfirmation = `${expectedCounter}_OK`;
                    
                    if (confirmationText === expectedConfirmation) {
                        console.log('✅ Confirmación recibida!');
                        return true;
                    }
                }
            } catch (error) {
                console.warn('⚠️ Error leyendo confirmación:', error.message);
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        console.warn('⏱️ Timeout esperando confirmación');
        return false;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
};

// Exportar configuración
export const ESP32_CONFIG = {
    CHANNEL_ID,
    READ_API_KEY,
    WRITE_API_KEY,
    TIMEOUT: 5000,
    RETRY_INTERVAL: 15000,
    MAX_DATA_AGE: 120000
};
