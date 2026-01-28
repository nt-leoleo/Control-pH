// Validaciones y funciones de error personalizadas
export const validatePHValue = (value) => {
    const num = parseFloat(value);
    
    if (isNaN(num)) {
        throw new Error('El valor de pH debe ser un número válido');
    }
    
    if (num < 6 || num > 8) {
        throw new Error('El pH debe estar entre 6 y 8');
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

    // Allow configuration outside 6-8 but warn the developer.
    if (min < 6) {
        console.warn(`validateToleranceRange: computed min ${min.toFixed(1)} is below 6. Allowing configuration but values may be out of display range.`);
    }

    if (max > 8) {
        console.warn(`validateToleranceRange: computed max ${max.toFixed(1)} is above 8. Allowing configuration but values may be out of display range.`);
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
