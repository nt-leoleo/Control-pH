/**
 * Dosage and pH calculations.
 */

const CHEMICAL_EFFECTIVENESS = {
    'sodium-hypochlorite': {
        name: 'Hipoclorito de Sodio',
        direction: 'up',
        ppmPerLiter: 8,
        phChangePerPpm: 0.08,
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
    muriatic: {
        name: 'Acido Muriatico',
        direction: 'down',
        ppmPerLiter: 12,
        phChangePerPpm: -0.15,
    },
    bisulfate: {
        name: 'Bisulfato de Sodio',
        direction: 'down',
        ppmPerLiter: 6,
        phChangePerPpm: -0.08,
    },
};

const DEFAULT_ALKALINITY_PPM = 100;
const ALKALINITY_BUFFER_DIVISOR = 100;

const roundTo = (value, decimals = 2) => {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
};

export const isKnownProduct = (product) =>
    Object.prototype.hasOwnProperty.call(CHEMICAL_EFFECTIVENESS, product);

/**
 * Formula:
 * dPH = (ppmAdded * chemicalFactor) / (1 + alkalinity / ALKALINITY_BUFFER_DIVISOR)
 */
export const calculatePHChange = (product, liters, poolVolumeL, alkalinityPpm) => {
    if (!isKnownProduct(product)) {
        console.error(`Producto desconocido: ${product}`);
        return NaN;
    }

    const litersValue = Number(liters);
    const poolVolumeValue = Number(poolVolumeL);
    const alkalinityValue = Number(alkalinityPpm);

    if (!Number.isFinite(litersValue) || litersValue <= 0) {
        console.error(`Litros invalidos: ${liters}`);
        return NaN;
    }

    if (!Number.isFinite(poolVolumeValue) || poolVolumeValue <= 0) {
        console.error(`Volumen de piscina invalido: ${poolVolumeL}`);
        return NaN;
    }

    const safeAlkalinity =
        Number.isFinite(alkalinityValue) && alkalinityValue >= 0
            ? alkalinityValue
            : DEFAULT_ALKALINITY_PPM;

    const chem = CHEMICAL_EFFECTIVENESS[product];
    const ppmAdded = (litersValue * chem.ppmPerLiter) / (poolVolumeValue / 1000);
    const bufferFactor = 1 + safeAlkalinity / ALKALINITY_BUFFER_DIVISOR;
    return (ppmAdded * chem.phChangePerPpm) / bufferFactor;
};

export const interpolatePhChange = (currentPH, targetPhChange, steps = 20) => {
    const values = [];

    for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        const easeProgress = progress < 0.5
            ? 2 * progress * progress
            : -1 + (4 - 2 * progress) * progress;

        const currentValue = currentPH + targetPhChange * easeProgress;
        values.push(roundTo(currentValue, 2));
    }

    return values;
};

export const getChemicalInfo = (product) => {
    return CHEMICAL_EFFECTIVENESS[product] || null;
};

export const validateDosage = (
    product,
    liters,
    poolVolumeL,
    currentPH,
    options = {}
) => {
    const {
        alkalinityPpm = DEFAULT_ALKALINITY_PPM,
        minSafePH = 0.0,
        maxSafePH = 14.0,
        maxPHChange = 2.0,
    } = options;

    const litersValue = Number(liters);
    const poolVolumeValue = Number(poolVolumeL);
    const currentPHValue = Number(currentPH);

    if (!isKnownProduct(product)) {
        return { valid: false, message: 'Producto no reconocido para dosificar' };
    }

    if (!Number.isFinite(litersValue) || litersValue <= 0) {
        return { valid: false, message: 'Cantidad debe ser mayor a 0' };
    }

    if (!Number.isFinite(poolVolumeValue) || poolVolumeValue <= 0) {
        return { valid: false, message: 'Volumen de piscina no valido' };
    }

    if (!Number.isFinite(currentPHValue)) {
        return { valid: false, message: 'pH actual no valido' };
    }

    const phChange = calculatePHChange(product, litersValue, poolVolumeValue, alkalinityPpm);
    if (!Number.isFinite(phChange)) {
        return { valid: false, message: 'No se pudo calcular el cambio esperado de pH' };
    }

    const resultingPH = currentPHValue + phChange;

    if (resultingPH < minSafePH || resultingPH > maxSafePH) {
        return {
            valid: false,
            message: `pH resultante seria ${resultingPH.toFixed(2)} (fuera de rango seguro ${minSafePH.toFixed(1)}-${maxSafePH.toFixed(1)})`,
        };
    }

    if (Math.abs(phChange) > maxPHChange) {
        return {
            valid: false,
            message: `Cambio muy grande: ${phChange > 0 ? '+' : ''}${phChange.toFixed(2)} pH. Limite configurado: ${roundTo(maxPHChange, 2)}`,
        };
    }

    return {
        valid: true,
        message: `Cambio esperado: ${phChange > 0 ? '+' : ''}${phChange.toFixed(2)} pH`,
        phChange,
        resultingPH,
    };
};

export const calculateAutomaticDosage = (currentPH, idealPH, tolerance) => {
    const deviation = currentPH - idealPH;
    const maxDeviation = tolerance;

    if (deviation > maxDeviation) {
        return {
            product: 'muriatic',
            liters: Math.min(5, Math.abs(deviation) * 2),
            reason: 'pH muy alto',
        };
    }

    if (deviation < -maxDeviation) {
        return {
            product: 'sodium-hypochlorite',
            liters: Math.min(5, Math.abs(deviation) * 2),
            reason: 'pH muy bajo',
        };
    }

    return null;
};
