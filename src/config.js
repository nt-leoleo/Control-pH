/**
 * Configuración del sistema de dosificación automática
 * 
 * IMPORTANTE: Cambiar DEV_MODE a false antes de desplegar en producción
 */

export const CONFIG = {
    // Modo de desarrollo: tiempos acelerados para pruebas
    DEV_MODE: true, // ⚠️ Cambiar a false para producción
    
    // Configuración de producción
    PRODUCTION: {
        MIN_WAIT_TIME: 2 * 60 * 60 * 1000, // 2 horas entre dosificaciones
        CHECK_INTERVAL: 5 * 60 * 1000,      // Verificar cada 5 minutos
        DOSING_DELAY: 2000,                 // 2 segundos de delay después de dosificar
    },
    
    // Configuración de desarrollo (tiempos acelerados)
    DEVELOPMENT: {
        MIN_WAIT_TIME: 10 * 1000,           // 10 segundos entre dosificaciones
        CHECK_INTERVAL: 5 * 1000,           // Verificar cada 5 segundos
        DOSING_DELAY: 1000,                 // 1 segundo de delay después de dosificar
    },
    
    // Constantes de hardware (no cambiar)
    HARDWARE: {
        PUMP_FLOW_RATE: 60,                 // L/h (1 L/min) - AJUSTAR según tu bomba real
        MAX_DOSE_VOLUME: 0.5,               // Litros - máximo 500ml por dosificación
        CORRECTION_FACTOR: 0.8,             // Factor de seguridad (80% de la dosis calculada)
        MIN_DOSE_VOLUME: 0.01,              // Litros - mínimo 10ml por dosificación
    },
    
    // Rangos de seguridad
    SAFETY: {
        MIN_PH: 6.0,                        // pH mínimo permitido
        MAX_PH: 8.5,                        // pH máximo permitido
        MAX_PH_CHANGE: 1.0,                 // Cambio máximo de pH por dosificación
    }
};

/**
 * Obtiene la configuración actual según el modo
 */
export const getConfig = () => {
    return CONFIG.DEV_MODE ? CONFIG.DEVELOPMENT : CONFIG.PRODUCTION;
};

/**
 * Obtiene un mensaje descriptivo del modo actual
 */
export const getModeDescription = () => {
    if (CONFIG.DEV_MODE) {
        return {
            mode: 'DESARROLLO',
            waitTime: '10 segundos',
            checkInterval: '5 segundos',
            warning: '⚠️ Modo de prueba activo - Cambiar a producción antes de desplegar'
        };
    } else {
        return {
            mode: 'PRODUCCIÓN',
            waitTime: '2 horas',
            checkInterval: '5 minutos',
            warning: null
        };
    }
};
