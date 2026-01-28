/**
 * Cálculos de dosificación y cambio de pH en piscinas
 * Basado en fórmulas químicas estándar
 */

// Constantes de efectividad por tipo de químico (cambio de pH por litro de producto)
const CHEMICAL_EFFECTIVENESS = {
    'sodium-hypochlorite': {
        name: 'Hipoclorito de Sodio',
        direction: 'up', // Sube pH
        ppmPerLiter: 8, // Aproximadamente 8 ppm por litro de producto
        phChangePerPpm: 0.08, // Cambio de pH por ppm
    },
    'calcium-hypochlorite': {
        name: 'Hipoclorito de Calcio',
        direction: 'up',
        ppmPerLiter: 10,
        phChangePerPpm: 0.12,
    },
    'chlorine-gas': {
        name: 'Cloro Gas',
        direction: 'down',
        ppmPerLiter: 5,
        phChangePerPpm: -0.05,
    },
    'muriatic': {
        name: 'Ácido Muriático',
        direction: 'down',
        ppmPerLiter: 12,
        phChangePerPpm: -0.15,
    },
    'bisulfate': {
        name: 'Bisulfato de Sodio',
        direction: 'down',
        ppmPerLiter: 6,
        phChangePerPpm: -0.08,
    },
};

/**
 * Calcula el cambio de pH esperado basado en:
 * - Producto químico dosificado
 * - Cantidad en litros
 * - Volumen de la piscina
 * - Alcalinidad total (amortiguador)
 * 
 * Fórmula simplificada:
 * ΔpH = (ppm_químico * factor_efectividad) / (1 + alcalinidad/50)
 * 
 * La alcalinidad actúa como amortiguador: a mayor alcalinidad, menor cambio de pH
 */
export const calculatePHChange = (
    product,
    liters,
    poolVolumeL,
    alkalinityPpm
) => {
    if (!CHEMICAL_EFFECTIVENESS[product]) {
        console.error(`Producto desconocido: ${product}`);
        return 0;
    }

    const chem = CHEMICAL_EFFECTIVENESS[product];
    
    // Calcular ppm del químico añadido
    const ppmAdded = (liters * chem.ppmPerLiter) / (poolVolumeL / 1000);
    
    // Fórmula de cambio de pH con amortiguamiento por alcalinidad
    // Alcalinidad alta = más amortiguamiento = menos cambio de pH
    const bufferFactor = 1 + (alkalinityPpm / 100);
    const phChange = (ppmAdded * chem.phChangePerPpm) / bufferFactor;
    
    return Math.round(phChange * 100) / 100; // Redondear a 2 decimales
};

/**
 * Simula la aplicación gradual de un cambio de pH
 * Retorna un array de valores interpolados para animación
 * 
 * @param currentPH - pH actual
 * @param targetPhChange - Cambio de pH a aplicar
 * @param steps - Número de pasos de animación (defecto 20 para ~10 segundos a 500ms)
 */
export const interpolatePhChange = (currentPH, targetPhChange, steps = 20) => {
    const targetPH = currentPH + targetPhChange;
    const values = [];
    
    for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        // Easing function: ease-in-out
        const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : -1 + (4 - 2 * progress) * progress;
        
        const currentValue = currentPH + (targetPhChange * easeProgress);
        values.push(Math.round(currentValue * 100) / 100);
    }
    
    return values;
};

/**
 * Obtiene información sobre un químico
 */
export const getChemicalInfo = (product) => {
    return CHEMICAL_EFFECTIVENESS[product] || null;
};

/**
 * Valida si la dosificación es segura
 * Retorna { valid: boolean, message: string }
 */
export const validateDosage = (product, liters, poolVolumeL, currentPH) => {
    if (liters <= 0) {
        return { valid: false, message: 'Cantidad debe ser mayor a 0' };
    }

    const phChange = calculatePHChange(product, liters, poolVolumeL, 100);
    const resultingPH = currentPH + phChange;

    // Validar que el pH resultante no sea extremo
    if (resultingPH < 6 || resultingPH > 8.5) {
        return { 
            valid: false, 
            message: `⚠️ pH resultante sería ${resultingPH.toFixed(2)} (fuera de rango seguro)` 
        };
    }

    if (Math.abs(phChange) > 1.0) {
        return { 
            valid: false, 
            message: `⚠️ Cambio muy grande: ${phChange > 0 ? '+' : ''}${phChange.toFixed(2)} pH. Dosifica en porciones más pequeñas` 
        };
    }

    return { valid: true, message: `Cambio esperado: ${phChange > 0 ? '+' : ''}${phChange.toFixed(2)} pH` };
};

/**
 * Simula un cambio de pH automático (para modo automático)
 * Pequeños ajustes para mantener pH en rango ideal
 */
export const calculateAutomaticDosage = (currentPH, idealPH, tolerance, poolVolumeL) => {
    const deviation = currentPH - idealPH;
    const maxDeviation = tolerance;

    // Si está fuera de tolerancia, determinar qué dosificar
    if (deviation > maxDeviation) {
        // pH muy alto, bajar con ácido
        return {
            product: 'muriatic',
            liters: Math.min(5, Math.abs(deviation) * 2), // Proporcional al desvío
            reason: 'pH muy alto'
        };
    } else if (deviation < -maxDeviation) {
        // pH muy bajo, subir con cloro
        return {
            product: 'sodium-hypochlorite',
            liters: Math.min(5, Math.abs(deviation) * 2),
            reason: 'pH muy bajo'
        };
    }

    return null; // Sin necesidad de ajuste
};
