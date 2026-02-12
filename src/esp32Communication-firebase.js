/*
 * =====================================================
 *    COMUNICACIÓN ESP32 VÍA FIREBASE - NUEVO FLUJO
 * =====================================================
 * 
 * Flujo optimizado:
 * 1. Arduino → ThingSpeak (datos del sensor)
 * 2. Cloud Functions → Firebase (datos + decisiones)
 * 3. App Web ↔ Firebase (monitoreo + comandos)
 * 4. Cloud Functions → ThingSpeak → Arduino (comandos)
 * 
 * Ventajas:
 * - Sin conflictos de escritura
 * - Actualizaciones en tiempo real
 * - Sin polling innecesario
 * - Escalable y confiable
 * 
 * Versión: 4.0 - Firebase Integration
 * =====================================================
 */

import { ref, onValue, off, get } from 'firebase/database';
import { database } from './firebase';

// =====================================================
// CONFIGURACIÓN
// =====================================================

export const ESP32_CONFIG = {
    // Cloud Functions endpoints
    CLOUD_FUNCTIONS_BASE: 'https://us-central1-control-ph-82951.cloudfunctions.net',
    MANUAL_DOSING_ENDPOINT: '/sendManualDosingCommand',
    FORCE_CHECK_ENDPOINT: '/forceCheck',
    
    // Timeouts
    TIMEOUT: 10000,
    
    // Data validation
    MIN_PH: 0,
    MAX_PH: 14,
    MIN_VOLTAGE: 0,
    MAX_VOLTAGE: 5,
    
    // Tiempo máximo de antigüedad de datos (2 minutos)
    MAX_DATA_AGE: 120000
};

// =====================================================
// LECTURA DE DATOS DEL SENSOR DESDE FIREBASE
// =====================================================

/**
 * Obtiene los datos actuales del sensor desde Firebase
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object|null>} Datos del sensor o null si hay error
 */
export const getPHDataFromFirebase = async (userId) => {
    try {
        if (!userId) {
            console.error('❌ userId es requerido');
            return null;
        }

        const sensorDataRef = ref(database, `users/${userId}/sensorData`);
        const snapshot = await get(sensorDataRef);
        
        if (!snapshot.exists()) {
            console.warn('⚠️ No hay datos del sensor en Firebase');
            return null;
        }
        
        const data = snapshot.val();
        
        // Validar datos
        if (!data.currentPH || isNaN(data.currentPH)) {
            console.error('❌ Datos de pH inválidos');
            return null;
        }
        
        // Verificar antigüedad de los datos
        const dataAge = Date.now() - (data.lastUpdate || data.timestamp);
        const isRecent = dataAge < ESP32_CONFIG.MAX_DATA_AGE;
        
        return {
            ph: data.currentPH,
            voltage: data.voltage || 0,
            wifi_rssi: data.wifiRSSI || -50,
            uptime: data.uptime || 0,
            timestamp: new Date(data.timestamp || data.lastUpdate),
            device_id: 'esp32-firebase',
            location: 'piscina_principal',
            source: 'firebase-realtime',
            isRecent: isRecent,
            dataAge: Math.round(dataAge / 1000),
            phStatus: getPHStatus(data.currentPH),
            lastUpdate: new Date(data.lastUpdate || data.timestamp).toLocaleString(),
            connectionQuality: getConnectionQuality(data.wifiRSSI || -50),
            systemHealth: getSystemHealth(isRecent, data.currentPH, data.voltage || 0)
        };
        
    } catch (error) {
        console.error('❌ Error leyendo datos de Firebase:', error);
        return null;
    }
};

/**
 * Suscribirse a cambios en tiempo real de los datos del sensor
 * @param {string} userId - ID del usuario
 * @param {Function} callback - Función a llamar cuando hay nuevos datos
 * @returns {Function} Función para cancelar la suscripción
 */
export const subscribeToPHData = (userId, callback) => {
    if (!userId) {
        console.error('❌ userId es requerido');
        return () => {};
    }

    const sensorDataRef = ref(database, `users/${userId}/sensorData`);
    
    const unsubscribe = onValue(sensorDataRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            // Validar y procesar datos
            if (data.currentPH && !isNaN(data.currentPH)) {
                const dataAge = Date.now() - (data.lastUpdate || data.timestamp);
                const isRecent = dataAge < ESP32_CONFIG.MAX_DATA_AGE;
                
                const processedData = {
                    ph: data.currentPH,
                    voltage: data.voltage || 0,
                    wifi_rssi: data.wifiRSSI || -50,
                    uptime: data.uptime || 0,
                    timestamp: new Date(data.timestamp || data.lastUpdate),
                    device_id: 'esp32-firebase',
                    location: 'piscina_principal',
                    source: 'firebase-realtime',
                    isRecent: isRecent,
                    dataAge: Math.round(dataAge / 1000),
                    phStatus: getPHStatus(data.currentPH),
                    lastUpdate: new Date(data.lastUpdate || data.timestamp).toLocaleString(),
                    connectionQuality: getConnectionQuality(data.wifiRSSI || -50),
                    systemHealth: getSystemHealth(isRecent, data.currentPH, data.voltage || 0)
                };
                
                callback(processedData);
            }
        }
    }, (error) => {
        console.error('❌ Error en suscripción a Firebase:', error);
    });
    
    return () => off(sensorDataRef);
};

// =====================================================
// VERIFICACIÓN DE CONEXIÓN
// =====================================================

/**
 * Verifica si el ESP32 está conectado (datos recientes en Firebase)
 * @param {string} userId - ID del usuario
 * @returns {Promise<boolean>} true si está conectado
 */
export const checkESP32Connection = async (userId) => {
    try {
        const data = await getPHDataFromFirebase(userId);
        return data !== null && data.isRecent;
    } catch (error) {
        console.error('❌ Error verificando conexión:', error);
        return false;
    }
};

// =====================================================
// COMANDOS DE DOSIFICACIÓN
// =====================================================

/**
 * Envía un comando de dosificación manual a través de Cloud Functions
 * @param {string} userId - ID del usuario
 * @param {string} product - Producto a dosificar ('ph_plus' o 'ph_minus')
 * @param {number} durationSeconds - Duración en segundos
 * @returns {Promise<Object>} Resultado del comando
 */
export const sendManualDosingCommand = async (userId, product, durationSeconds) => {
    try {
        console.log('💊 Enviando comando manual de dosificación...');
        console.log('   Usuario:', userId);
        console.log('   Producto:', product);
        console.log('   Duración:', durationSeconds, 's');
        
        // Mapear productos de la app a formato Cloud Functions
        const productMap = {
            'sodium-hypochlorite': 'ph_plus',
            'calcium-hypochlorite': 'ph_plus',
            'muriatic': 'ph_minus',
            'bisulfate': 'ph_minus',
            'chlorine-gas': 'ph_minus'
        };
        
        const mappedProduct = productMap[product] || product;
        
        // Validar producto
        if (mappedProduct !== 'ph_plus' && mappedProduct !== 'ph_minus') {
            throw new Error('Producto inválido');
        }
        
        // Validar duración
        if (durationSeconds < 1 || durationSeconds > 3600) {
            throw new Error('Duración debe estar entre 1 y 3600 segundos');
        }
        
        // Llamar a Cloud Function
        const url = `${ESP32_CONFIG.CLOUD_FUNCTIONS_BASE}${ESP32_CONFIG.MANUAL_DOSING_ENDPOINT}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId,
                product: mappedProduct,
                duration: durationSeconds
            }),
            signal: AbortSignal.timeout(ESP32_CONFIG.TIMEOUT)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        console.log('✅ Comando enviado exitosamente');
        console.log('   Respuesta:', result);
        
        return {
            success: true,
            message: result.message || 'Comando enviado',
            timestamp: result.timestamp || Date.now(),
            method: 'cloud-functions',
            product: mappedProduct,
            duration: durationSeconds
        };
        
    } catch (error) {
        console.error('❌ Error enviando comando:', error);
        return {
            success: false,
            message: error.message,
            timestamp: Date.now(),
            method: 'failed'
        };
    }
};

/**
 * Alias para compatibilidad con código existente
 */
export const sendRealDosingCommand = async (product, durationSeconds, userId) => {
    if (!userId) {
        console.error('❌ userId es requerido para sendRealDosingCommand');
        return {
            success: false,
            message: 'userId es requerido',
            timestamp: Date.now()
        };
    }
    
    return await sendManualDosingCommand(userId, product, durationSeconds);
};

// =====================================================
// ESTADO DEL SISTEMA
// =====================================================

/**
 * Obtiene el estado del sistema desde Firebase
 * @param {string} userId - ID del usuario
 * @returns {Promise<Object|null>} Estado del sistema
 */
export const getSystemStatus = async (userId) => {
    try {
        const statusRef = ref(database, `users/${userId}/systemStatus`);
        const snapshot = await get(statusRef);
        
        if (!snapshot.exists()) {
            return null;
        }
        
        return snapshot.val();
    } catch (error) {
        console.error('❌ Error obteniendo estado del sistema:', error);
        return null;
    }
};

/**
 * Suscribirse a cambios en el estado del sistema
 * @param {string} userId - ID del usuario
 * @param {Function} callback - Función a llamar cuando cambia el estado
 * @returns {Function} Función para cancelar la suscripción
 */
export const subscribeToSystemStatus = (userId, callback) => {
    if (!userId) {
        console.error('❌ userId es requerido');
        return () => {};
    }

    const statusRef = ref(database, `users/${userId}/systemStatus`);
    
    const unsubscribe = onValue(statusRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        }
    }, (error) => {
        console.error('❌ Error en suscripción al estado:', error);
    });
    
    return () => off(statusRef);
};

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

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
// UTILIDADES
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

// Exportar configuración
export { ESP32_CONFIG as config };

// =====================================================
// FUNCIONES DE COMPATIBILIDAD (DEPRECATED)
// =====================================================

/**
 * @deprecated Usar subscribeToPHData en su lugar
 */
export const getPHDataFromESP32 = async (userId) => {
    console.warn('⚠️ getPHDataFromESP32 está deprecated, usar getPHDataFromFirebase');
    return await getPHDataFromFirebase(userId);
};

/**
 * @deprecated Usar subscribeToPHData en su lugar
 */
export const useESP32Connection = (userId, onDataReceived, onConnectionChange) => {
    console.warn('⚠️ useESP32Connection está deprecated, usar subscribeToPHData');
    
    let unsubscribe = null;
    
    const startConnection = () => {
        unsubscribe = subscribeToPHData(userId, (data) => {
            onDataReceived(data);
            onConnectionChange(data.isRecent);
        });
    };
    
    const stopConnection = () => {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = null;
        }
    };
    
    const getStatus = () => {
        return {
            running: unsubscribe !== null,
            interval: false,
            config: ESP32_CONFIG
        };
    };
    
    return { startConnection, stopConnection, getStatus };
};
