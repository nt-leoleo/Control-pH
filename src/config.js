/**
 * Runtime tunables for dosing and safety logic.
 * Set DEV_MODE to false before production deploys.
 */
export const CONFIG = {
    DEV_MODE: true,

    PRODUCTION: {
        MIN_WAIT_TIME: 2 * 60 * 60 * 1000,
        CHECK_INTERVAL: 5 * 60 * 1000,
        DOSING_DELAY: 2000,
    },

    DEVELOPMENT: {
        MIN_WAIT_TIME: 10 * 1000,
        CHECK_INTERVAL: 5 * 1000,
        DOSING_DELAY: 1000,
    },

    HARDWARE: {
        PUMP_FLOW_RATE: 60,
        MAX_DOSE_VOLUME: 0.5,
        CORRECTION_FACTOR: 0.8,
        MIN_DOSE_VOLUME: 0.01,
    },

    SAFETY: {
        MIN_PH: 0.0,
        MAX_PH: 14.0,
        MAX_PH_CHANGE: 1.0,
    },
};

export const getConfig = () => (CONFIG.DEV_MODE ? CONFIG.DEVELOPMENT : CONFIG.PRODUCTION);

export const getModeDescription = () => {
    if (CONFIG.DEV_MODE) {
        return {
            mode: 'DESARROLLO',
            waitTime: '10 segundos',
            checkInterval: '5 segundos',
            warning: 'Modo de prueba activo. Cambiar a produccion antes de desplegar.',
        };
    }

    return {
        mode: 'PRODUCCION',
        waitTime: '2 horas',
        checkInterval: '5 minutos',
        warning: null,
    };
};
