// Validaciones y funciones de error personalizadas
export const validatePHValue = (value) => {
    const num = parseFloat(value);
    
    if (isNaN(num)) {
        throw new Error('El valor de pH debe ser un número válido');
    }
    
    // Permitir cualquier valor de pH (0-14 es el rango teórico completo)
    if (num < 0 || num > 14) {
        throw new Error('El pH debe estar entre 0 y 14');
    }
    
    return num;
};

export const validateTolerance = (value) => {
    const num = parseFloat(value);
    
    if (isNaN(num)) {
        throw new Error('La tolerancia debe ser un número válido');
    }
    
    if (num <= 0 || num > 1) {
        throw new Error('La tolerancia debe estar entre 0.1 y 1.0');
    }
    
    return num;
};

export const validateToleranceRange = (optimal, tolerance) => {
    let min = optimal - tolerance;
    let max = optimal + tolerance;

    // Permitir cualquier rango de pH sin warnings
    // El rango completo de pH es 0-14
    if (min < 0) {
        console.warn(`validateToleranceRange: computed min ${min.toFixed(1)} is below 0. Clamping to 0.`);
        min = 0;
    }

    if (max > 14) {
        console.warn(`validateToleranceRange: computed max ${max.toFixed(1)} is above 14. Clamping to 14.`);
        max = 14;
    }

    return { min, max };
};

export const logError = (errorType, message, additionalInfo = {}) => {
    const timestamp = new Date().toISOString();
    const errorLog = {
        timestamp,
        type: errorType,
        message,
        ...additionalInfo,
        userAgent: navigator.userAgent,
    };
    
    console.error(`[${timestamp}] ${errorType}:`, message, additionalInfo);
    
    // Aquí podrías enviar a un servicio de logging remoto
    // Por ahora solo lo guardamos en console
    
    return errorLog;
};

export const ErrorMessages = {
    PH_FETCH_ERROR: 'Error al obtener el valor del pH',
    PH_UPDATE_ERROR: 'Error al actualizar el valor del pH',
    SETTINGS_SAVE_ERROR: 'Error al guardar la configuración',
    SETTINGS_LOAD_ERROR: 'Error al cargar la configuración',
    CHART_RENDER_ERROR: 'Error al renderizar la gráfica',
    INVALID_INPUT: 'Entrada inválida',
    NETWORK_ERROR: 'Error de conexión',
    UNKNOWN_ERROR: 'Ocurrió un error inesperado',
};
