import { ref, onValue, off, get, push, set } from 'firebase/database';
import { database } from './firebase';

export const ESP32_CONFIG = {
    CLOUD_FUNCTIONS_BASE: 'https://us-central1-control-ph-82951.cloudfunctions.net',
    MANUAL_DOSING_ENDPOINT: '/sendManualDosingCommand',
    FORCE_CHECK_ENDPOINT: '/forceCheck',
    TIMEOUT: 10000,
    MIN_PH: 0,
    MAX_PH: 14,
    MIN_VOLTAGE: 0,
    MAX_VOLTAGE: 5,
    MAX_DATA_AGE: 120000,
};

const PRODUCT_MAP = {
    'sodium-hypochlorite': 'ph_plus',
    'calcium-hypochlorite': 'ph_plus',
    muriatic: 'ph_minus',
    bisulfate: 'ph_minus',
    'chlorine-gas': 'ph_minus',
    ph_plus: 'ph_plus',
    ph_minus: 'ph_minus',
};

const toFiniteNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const resolvePHValue = (data) => {
    const direct = toFiniteNumber(data?.ph);
    if (direct !== null) return direct;
    return toFiniteNumber(data?.currentPH);
};

const resolveTimestampMs = (data) => {
    const timestamp = toFiniteNumber(data?.lastUpdate ?? data?.timestamp);
    if (timestamp !== null && timestamp > 0) return timestamp;
    return Date.now();
};

const buildProcessedSensorData = (data) => {
    const phValue = resolvePHValue(data);
    if (phValue === null || phValue < ESP32_CONFIG.MIN_PH || phValue > ESP32_CONFIG.MAX_PH) {
        return null;
    }

    const timestampMs = resolveTimestampMs(data);
    const dataAgeMs = Math.max(0, Date.now() - timestampMs);
    const isRecent = dataAgeMs < ESP32_CONFIG.MAX_DATA_AGE;
    const voltage = toFiniteNumber(data?.voltage) ?? 0;
    const wifiRSSI = toFiniteNumber(data?.wifiRSSI) ?? -50;
    const uptime = toFiniteNumber(data?.uptime) ?? 0;

    return {
        ph: phValue,
        voltage,
        wifi_rssi: wifiRSSI,
        uptime,
        timestamp: new Date(timestampMs),
        device_id: data?.deviceId || 'esp32-firebase',
        location: 'piscina_principal',
        source: 'firebase-realtime',
        isRecent,
        dataAge: Math.round(dataAgeMs / 1000),
        phStatus: getPHStatus(phValue),
        lastUpdate: new Date(timestampMs).toLocaleString(),
        connectionQuality: getConnectionQuality(wifiRSSI),
        systemHealth: getSystemHealth(isRecent, phValue, voltage),
    };
};

export const getPHDataFromFirebase = async (userId) => {
    try {
        if (!userId) {
            return null;
        }

        const sensorDataRef = ref(database, `users/${userId}/sensorData`);
        const snapshot = await get(sensorDataRef);
        if (!snapshot.exists()) {
            return null;
        }

        return buildProcessedSensorData(snapshot.val());
    } catch (error) {
        console.error('Error leyendo datos de Firebase:', error);
        return null;
    }
};

export const subscribeToPHData = (userId, callback) => {
    if (!userId) {
        return () => {};
    }

    const sensorDataRef = ref(database, `users/${userId}/sensorData`);
    const unsubscribe = onValue(
        sensorDataRef,
        (snapshot) => {
            if (!snapshot.exists()) {
                return;
            }

            const processedData = buildProcessedSensorData(snapshot.val());
            if (processedData) {
                callback(processedData);
            }
        },
        (error) => {
            console.error('Error en suscripcion de sensorData:', error);
        }
    );

    return () => {
        unsubscribe();
        off(sensorDataRef);
    };
};

export const checkESP32Connection = async (userId) => {
    try {
        const data = await getPHDataFromFirebase(userId);
        return data !== null && data.isRecent;
    } catch (error) {
        console.error('Error verificando conexion ESP32:', error);
        return false;
    }
};

export const sendManualDosingCommand = async (userId, product, durationSeconds) => {
    try {
        const mappedProduct = PRODUCT_MAP[product];
        if (!mappedProduct) {
            throw new Error('Producto invalido');
        }

        const normalizedDuration = Number(durationSeconds);
        if (!Number.isFinite(normalizedDuration) || normalizedDuration < 1 || normalizedDuration > 3600) {
            throw new Error('Duracion debe estar entre 1 y 3600 segundos');
        }

        const url = `${ESP32_CONFIG.CLOUD_FUNCTIONS_BASE}${ESP32_CONFIG.MANUAL_DOSING_ENDPOINT}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId,
                product: mappedProduct,
                duration: normalizedDuration,
            }),
            signal: AbortSignal.timeout(ESP32_CONFIG.TIMEOUT),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const result = await response.json();
        return {
            success: true,
            message: result.message || 'Comando enviado',
            timestamp: result.timestamp || Date.now(),
            method: 'cloud-functions',
            product: mappedProduct,
            duration: normalizedDuration,
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            timestamp: Date.now(),
            method: 'failed',
        };
    }
};

export const sendRealDosingCommand = async (product, durationSeconds, userId) => {
    if (!userId) {
        return {
            success: false,
            message: 'userId es requerido',
            timestamp: Date.now(),
        };
    }

    return sendManualDosingCommand(userId, product, durationSeconds);
};

export const getSystemStatus = async (userId) => {
    try {
        const statusRef = ref(database, `users/${userId}/systemStatus`);
        const snapshot = await get(statusRef);
        if (!snapshot.exists()) {
            return null;
        }

        return snapshot.val();
    } catch (error) {
        console.error('Error obteniendo systemStatus:', error);
        return null;
    }
};

export const subscribeToSystemStatus = (userId, callback) => {
    if (!userId) {
        return () => {};
    }

    const statusRef = ref(database, `users/${userId}/systemStatus`);
    const unsubscribe = onValue(
        statusRef,
        (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.val());
            }
        },
        (error) => {
            console.error('Error en suscripcion systemStatus:', error);
        }
    );

    return () => {
        unsubscribe();
        off(statusRef);
    };
};

function getPHStatus(ph) {
    if (ph < 6.5) {
        return {
            status: 'acidic',
            label: 'Acido',
            description: 'pH bajo - necesita subir',
            color: '#FF5722',
        };
    }

    if (ph > 7.5) {
        return {
            status: 'basic',
            label: 'Basico',
            description: 'pH alto - necesita bajar',
            color: '#9C27B0',
        };
    }

    return {
        status: 'neutral',
        label: 'Neutro',
        description: 'pH ideal para piscina',
        color: '#4CAF50',
    };
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
    if (ph < ESP32_CONFIG.MIN_PH || ph > ESP32_CONFIG.MAX_PH) {
        issues.push('pH fuera de rango seguro');
    }
    if (voltage < 0.1 || voltage > 4.0) issues.push('Voltaje anomalo');

    if (issues.length === 0) {
        return { status: 'healthy', label: 'Saludable', issues: [] };
    }

    return { status: 'warning', label: 'Advertencia', issues };
}

export const formatPHValue = (ph) => {
    if (typeof ph !== 'number' || Number.isNaN(ph)) return '--';
    return ph.toFixed(2);
};

export const formatVoltage = (voltage) => {
    if (typeof voltage !== 'number' || Number.isNaN(voltage)) return '--';
    return `${voltage.toFixed(3)}V`;
};

export const formatUptime = (seconds) => {
    if (typeof seconds !== 'number' || Number.isNaN(seconds)) return '--';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
};

export const isDataRecent = (timestamp, maxAge = ESP32_CONFIG.MAX_DATA_AGE) => {
    const now = Date.now();
    const dataTime = new Date(timestamp).getTime();
    return now - dataTime < maxAge;
};

export { ESP32_CONFIG as config };

export const getPHDataFromESP32 = async (userId) => {
    return getPHDataFromFirebase(userId);
};

export const useESP32Connection = (userId, onDataReceived, onConnectionChange) => {
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

    const getStatus = () => ({
        running: unsubscribe !== null,
        interval: false,
        config: ESP32_CONFIG,
    });

    return { startConnection, stopConnection, getStatus };
};

export const sendDosingCommandToFirebase = async (
    userId,
    product,
    durationSeconds,
    maxDurationSeconds = 300
) => {
    try {
        if (!userId) {
            throw new Error('userId es requerido');
        }

        const mappedProduct = PRODUCT_MAP[product];
        if (!mappedProduct) {
            throw new Error('Producto no reconocido');
        }

        const normalizedDuration = Number(durationSeconds);
        const safeMaxDuration = Math.max(1, Math.min(3600, Number(maxDurationSeconds) || 300));
        if (!Number.isFinite(normalizedDuration) || normalizedDuration < 1 || normalizedDuration > safeMaxDuration) {
            throw new Error(`Duracion debe estar entre 1 y ${safeMaxDuration} segundos`);
        }

        const commandsRef = ref(database, `users/${userId}/commands`);
        const newCommandRef = push(commandsRef);

        const commandData = {
            product: mappedProduct,
            duration: normalizedDuration,
            status: 'pending',
            createdAt: Date.now(),
            timestamp: Date.now(),
        };

        await set(newCommandRef, commandData);

        return {
            success: true,
            commandId: newCommandRef.key,
            product: mappedProduct,
            duration: normalizedDuration,
            message: 'Comando enviado a Firebase. Arduino lo ejecutara en breve.',
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: `Error enviando comando a Firebase: ${error.message}`,
        };
    }
};

export const sendEmergencyStopCommand = async (userId) => {
    try {
        if (!userId) {
            throw new Error('userId es requerido');
        }

        const commandId = '!emergency_stop';
        const emergencyRef = ref(database, `users/${userId}/commands/${commandId}`);

        const commandData = {
            product: 'emergency_stop',
            duration: 0,
            status: 'pending',
            priority: 'critical',
            source: 'web-app',
            createdAt: Date.now(),
            timestamp: Date.now(),
        };

        await set(emergencyRef, commandData);

        return {
            success: true,
            commandId,
            product: 'emergency_stop',
            message: 'Parada de emergencia enviada al ESP32',
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'No se pudo enviar la parada de emergencia',
        };
    }
};

export const sendWifiResetCommand = async (userId) => {
    try {
        if (!userId) {
            throw new Error('userId es requerido');
        }

        const commandId = '!wifi_reset';
        const wifiResetRef = ref(database, `users/${userId}/commands/${commandId}`);

        const commandData = {
            product: 'wifi_reset',
            duration: 0,
            status: 'pending',
            priority: 'high',
            source: 'web-app',
            createdAt: Date.now(),
            timestamp: Date.now(),
        };

        await set(wifiResetRef, commandData);

        return {
            success: true,
            commandId,
            product: 'wifi_reset',
            message: 'Comando de reinicio WiFi enviado al ESP32',
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            message: 'No se pudo enviar el reinicio de WiFi',
        };
    }
};

export const waitForCommandConfirmation = async (userId, commandId, maxWaitTime = 60000) => {
    try {
        const commandRef = ref(database, `users/${userId}/commands/${commandId}`);
        const startTime = Date.now();

        return await new Promise((resolve) => {
            let settled = false;
            let timeoutId = null;

            const finish = (value, unsubscribe) => {
                if (settled) return;
                settled = true;
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                unsubscribe();
                resolve(value);
            };

            const unsubscribe = onValue(commandRef, (snapshot) => {
                if (!snapshot.exists()) {
                    finish(false, unsubscribe);
                    return;
                }

                const command = snapshot.val();
                const elapsed = Date.now() - startTime;

                if (command.status === 'completed') {
                    finish(true, unsubscribe);
                    return;
                }

                if (command.status === 'failed') {
                    finish(false, unsubscribe);
                    return;
                }

                if (elapsed > maxWaitTime) {
                    finish(false, unsubscribe);
                }
            });

            timeoutId = setTimeout(() => {
                finish(false, unsubscribe);
            }, maxWaitTime + 1000);
        });
    } catch (error) {
        console.error('Error esperando confirmacion de comando:', error);
        return false;
    }
};
