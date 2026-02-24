/**
 * Cálculos de dosificación de químicos para piscinas
 * Basado en fórmulas estándar de la industria
 * 
 * Fuentes:
 * - Knorr Systems Chemical Dosing Charts
 * - Pool & Spa Operators Handbook
 * - https://www.poolweb.com/blogs/expert-advice/chemical-calculator
 * 
 * IMPORTANTE: Todas las fórmulas están basadas en 10,000 galones (37,854 litros)
 */

/**
 * Constantes de dosificación - DATOS REALES DE LA INDUSTRIA
 */
const DOSAGE_CONSTANTS = {
  // Ácido Muriático (HCl al 31.45% - concentración estándar)
  // Para BAJAR pH
  MURIATIC_ACID: {
    // Tabla real de dosificación para bajar pH a 7.6:
    // pH 8.4 → 7.6: 1 quart (946ml) por 10,000 galones
    // pH 8.2 → 7.6: 3.5 cups (828ml) por 10,000 galones
    // pH 8.0 → 7.6: 2.5 cups (592ml) por 10,000 galones
    // pH 7.8 → 7.6: 1.33 cups (315ml) por 10,000 galones
    // Promedio: ~473ml por 0.2 pH = 236ml por 0.1 pH
    ML_PER_01_PH_PER_10K_GALLONS: 236,
    CONCENTRATION: 0.3145, // 31.45%
    DENSITY: 1.16 // g/ml
  },
  
  // Bisulfato de Sodio (NaHSO4) - ácido seco
  // Para BAJAR pH (alternativa más suave al muriático)
  SODIUM_BISULFATE: {
    // Aproximadamente 75% de la efectividad del muriático
    // ~8 oz (227g) por 0.1 pH en 10,000 galones
    GRAMS_PER_01_PH_PER_10K_GALLONS: 227,
    CONCENTRATION: 1.0
  },
  
  // Soda Ash / Carbonato de Sodio (Na2CO3)
  // Para SUBIR pH
  SODA_ASH: {
    // Tabla real de dosificación para subir pH a 7.4:
    // pH 6.6 → 7.4: 1.5 lbs (680g) por 10,000 galones = 0.8 pH = 85g por 0.1 pH
    // pH 6.8 → 7.4: 1.25 lbs (567g) por 10,000 galones = 0.6 pH = 94g por 0.1 pH
    // pH 7.0 → 7.4: 1 lb (454g) por 10,000 galones = 0.4 pH = 113g por 0.1 pH
    // pH 7.2 → 7.4: 0.75 lb (340g) por 10,000 galones = 0.2 pH = 170g por 0.1 pH
    // Promedio: ~115g por 0.1 pH (más conservador)
    GRAMS_PER_01_PH_PER_10K_GALLONS: 115,
    CONCENTRATION: 1.0,
    MAX_DOSE_PER_TIME: 454 // 1 lb máximo por vez para evitar turbidez
  },
  
  // Hipoclorito de Sodio (NaClO) - cloro líquido al 12%
  // Para SUBIR pH (efecto secundario al clorar)
  SODIUM_HYPOCHLORITE: {
    // 10 fl oz (296ml) aumenta 1 ppm de cloro en 10,000 galones
    // Efecto en pH: ~0.1 por cada 5 ppm de cloro añadido
    ML_PER_1PPM_CHLORINE_PER_10K_GALLONS: 296,
    ML_PER_01_PH_PER_10K_GALLONS: 1480, // 5 ppm de cloro = 0.1 pH
    CONCENTRATION: 0.12, // 12% típico
    PH_EFFECT_PER_PPM: 0.02 // Sube pH ~0.02 por cada 1 ppm de cloro
  },
  
  // Hipoclorito de Calcio (Ca(ClO)2) - cloro granulado al 67%
  // Para SUBIR pH (efecto más fuerte que el sodio)
  CALCIUM_HYPOCHLORITE: {
    // 2 oz (57g) aumenta 1 ppm de cloro en 10,000 galones
    // Efecto en pH: ~0.15 por cada 5 ppm de cloro añadido
    GRAMS_PER_1PPM_CHLORINE_PER_10K_GALLONS: 57,
    GRAMS_PER_01_PH_PER_10K_GALLONS: 190, // 3.3 ppm de cloro = 0.1 pH
    CONCENTRATION: 0.67, // 67% típico
    PH_EFFECT_PER_PPM: 0.03, // Sube pH ~0.03 por cada 1 ppm de cloro
    PH_LEVEL: 10.8 // pH muy alto, requiere balance
  },
  
  // Cloro Gas (Cl2) - BAJA pH ligeramente
  CHLORINE_GAS: {
    // 1.3 oz (37g) aumenta 1 ppm de cloro en 10,000 galones
    // Efecto en pH: BAJA ~0.05 por cada 5 ppm de cloro añadido
    GRAMS_PER_1PPM_CHLORINE_PER_10K_GALLONS: 37,
    PH_EFFECT_PER_PPM: -0.01, // BAJA pH ~0.01 por cada 1 ppm de cloro
    WARNING: 'Cloro gas BAJA el pH, no lo sube. No usar para aumentar pH.'
  }
};

/**
 * Convierte galones a litros
 */
function gallonsToLiters(gallons) {
  return gallons * 3.78541;
}

/**
 * Convierte litros a galones
 */
function litersToGallons(liters) {
  return liters / 3.78541;
}

/**
 * Calcula la cantidad de ácido necesaria para BAJAR pH
 * 
 * @param {number} poolVolumeLiters - Volumen de la piscina en litros
 * @param {number} currentPH - pH actual
 * @param {number} targetPH - pH objetivo
 * @param {number} alkalinity - Alcalinidad total en ppm
 * @param {string} acidType - Tipo de ácido: 'muriatic' o 'bisulfate'
 * @returns {object} - { volumeML, volumeGrams, durationSeconds, safetyWarning }
 */
function calculateAcidForPHDecrease(poolVolumeLiters, currentPH, targetPH, alkalinity = 100, acidType = 'muriatic') {
  // Validaciones
  if (currentPH <= targetPH) {
    return {
      volumeML: 0,
      volumeGrams: 0,
      durationSeconds: 0,
      safetyWarning: 'El pH actual es menor o igual al objetivo. No se necesita ácido.'
    };
  }
  
  // Convertir volumen de piscina a galones
  const poolVolumeGallons = litersToGallons(poolVolumeLiters);
  
  // Calcular diferencia de pH
  const pHDifference = currentPH - targetPH;
  
  // Factor de corrección por alcalinidad
  let alkalinityFactor = 1.0;
  if (alkalinity > 120) {
    alkalinityFactor = 1.2; // +20% si alcalinidad alta
  } else if (alkalinity < 80) {
    alkalinityFactor = 0.9; // -10% si alcalinidad baja
  }
  
  let result = {};
  
  if (acidType === 'muriatic') {
    // Ácido Muriático (líquido)
    const baseML = (pHDifference / 0.1) * DOSAGE_CONSTANTS.MURIATIC_ACID.ML_PER_01_PH_PER_10K_GALLONS;
    const scaledML = baseML * (poolVolumeGallons / 10000);
    const finalML = scaledML * alkalinityFactor * 0.8; // Factor de seguridad
    const safeML = Math.min(finalML, 500); // Límite máximo
    
    result = {
      volumeML: Math.round(safeML),
      volumeGrams: 0,
      isLiquid: true
    };
  } else if (acidType === 'bisulfate') {
    // Bisulfato de Sodio (seco)
    const baseGrams = (pHDifference / 0.1) * DOSAGE_CONSTANTS.SODIUM_BISULFATE.GRAMS_PER_01_PH_PER_10K_GALLONS;
    const scaledGrams = baseGrams * (poolVolumeGallons / 10000);
    const finalGrams = scaledGrams * alkalinityFactor * 0.8;
    const safeGrams = Math.min(finalGrams, 500);
    
    result = {
      volumeML: Math.round(safeGrams), // Convertir a ml para dosificación
      volumeGrams: Math.round(safeGrams),
      isLiquid: false
    };
  }
  
  return {
    ...result,
    durationSeconds: 0,
    safetyWarning: null,
    details: {
      pHDifference: pHDifference.toFixed(2),
      poolVolumeGallons: Math.round(poolVolumeGallons),
      alkalinityFactor: alkalinityFactor,
      acidType: acidType
    }
  };
}

/**
 * Calcula la cantidad de químico para SUBIR pH
 * 
 * @param {number} poolVolumeLiters - Volumen de la piscina en litros
 * @param {number} currentPH - pH actual
 * @param {number} targetPH - pH objetivo
 * @param {string} chlorineType - Tipo de cloro: 'sodium-hypochlorite', 'calcium-hypochlorite', 'chlorine-gas'
 * @returns {object} - { volumeML, volumeGrams, durationSeconds, safetyWarning }
 */
function calculateChlorineForPHIncrease(poolVolumeLiters, currentPH, targetPH, chlorineType = 'sodium-hypochlorite') {
  // Validaciones
  if (currentPH >= targetPH) {
    return {
      volumeML: 0,
      volumeGrams: 0,
      durationSeconds: 0,
      safetyWarning: 'El pH actual es mayor o igual al objetivo. No se necesita químico.'
    };
  }
  
  // Convertir volumen de piscina a galones
  const poolVolumeGallons = litersToGallons(poolVolumeLiters);
  
  // Calcular diferencia de pH
  const pHDifference = targetPH - currentPH;
  
  // IMPORTANTE: Para subir pH, el químico principal es SODA ASH, no cloro
  // El cloro sube pH como efecto secundario, pero no es su función principal
  
  // Usar Soda Ash como químico principal para subir pH
  const baseGrams = (pHDifference / 0.1) * DOSAGE_CONSTANTS.SODA_ASH.GRAMS_PER_01_PH_PER_10K_GALLONS;
  const scaledGrams = baseGrams * (poolVolumeGallons / 10000);
  const safeGrams = Math.min(scaledGrams * 0.8, DOSAGE_CONSTANTS.SODA_ASH.MAX_DOSE_PER_TIME); // Factor de seguridad y límite
  
  let result = {
    volumeML: Math.round(safeGrams), // Convertir a ml para dosificación (densidad ~1g/ml en solución)
    volumeGrams: Math.round(safeGrams),
    isLiquid: false,
    chemicalUsed: 'Soda Ash (Carbonato de Sodio)',
    note: 'Soda Ash es el químico estándar para subir pH. El cloro sube pH como efecto secundario.'
  };
  
  // Si el usuario configuró cloro, agregar nota sobre el efecto
  let chlorineNote = '';
  switch(chlorineType) {
    case 'sodium-hypochlorite':
      chlorineNote = `Nota: Tu cloro líquido (${chlorineType}) también sube pH ligeramente (~0.02 por cada 1 ppm de cloro).`;
      break;
    case 'calcium-hypochlorite':
      chlorineNote = `Nota: Tu cloro granulado (${chlorineType}) sube pH más que el líquido (~0.03 por cada 1 ppm de cloro).`;
      break;
    case 'chlorine-gas':
      chlorineNote = `ADVERTENCIA: Cloro gas BAJA el pH, no lo sube. Usa Soda Ash para subir pH.`;
      break;
  }
  
  return {
    ...result,
    durationSeconds: 0,
    safetyWarning: chlorineNote,
    details: {
      pHDifference: pHDifference.toFixed(2),
      poolVolumeGallons: Math.round(poolVolumeGallons),
      chlorineType: chlorineType,
      rawCalculation: Math.round(scaledGrams)
    }
  };
}

/**
 * Calcula la duración de dosificación según el caudal de la bomba
 * 
 * @param {number} volumeML - Volumen a dosificar en ml
 * @param {number} pumpFlowRate - Caudal de la bomba en L/h
 * @returns {number} - Duración en segundos
 */
function calculateDosingDuration(volumeML, pumpFlowRate = 60) {
  // Convertir caudal de L/h a ml/s
  const flowRateMLPerSecond = (pumpFlowRate * 1000) / 3600;
  
  // Calcular duración
  const durationSeconds = volumeML / flowRateMLPerSecond;
  
  // Redondear a segundos enteros
  return Math.ceil(durationSeconds);
}

/**
 * Función principal para calcular dosificación automática
 * 
 * @param {object} params - Parámetros de cálculo
 * @returns {object} - Resultado del cálculo
 */
function calculateAutomaticDosing(params) {
  const {
    poolVolumeLiters,
    currentPH,
    targetPH,
    alkalinity = 100,
    chlorineType = 'sodium-hypochlorite',
    acidType = 'muriatic',
    pumpFlowRate = 60, // L/h
    maxDoseVolume = 500 // ml
  } = params;
  
  let result;
  let product;
  
  if (currentPH > targetPH) {
    // Necesita bajar pH - usar ácido
    product = 'ph_minus';
    result = calculateAcidForPHDecrease(poolVolumeLiters, currentPH, targetPH, alkalinity, acidType);
  } else if (currentPH < targetPH) {
    // Necesita subir pH - usar cloro
    product = 'ph_plus';
    result = calculateChlorineForPHIncrease(poolVolumeLiters, currentPH, targetPH, chlorineType);
  } else {
    return {
      product: null,
      volumeML: 0,
      durationSeconds: 0,
      shouldDose: false,
      message: 'pH en el objetivo, no se necesita dosificación'
    };
  }
  
  // Si el volumen calculado es muy pequeño (< 1ml), usar duración mínima de 1 segundo
  let volumeML = result.volumeML;
  let duration;
  
  if (volumeML < 1 && volumeML > 0) {
    // Para volúmenes muy pequeños, usar duración mínima
    volumeML = 1;
    duration = 1;
    result.safetyWarning = 'Volumen muy pequeño, usando dosis mínima de 1ml por 1 segundo.';
  } else if (volumeML === 0) {
    // Si el cálculo da 0, usar dosis mínima
    volumeML = 1;
    duration = 1;
    result.safetyWarning = 'Piscina muy pequeña, usando dosis mínima de 1ml por 1 segundo.';
  } else {
    // Limitar al máximo permitido
    if (volumeML > maxDoseVolume) {
      volumeML = maxDoseVolume;
      result.safetyWarning = `Dosis limitada a ${maxDoseVolume}ml por seguridad. Se requerirán múltiples dosificaciones.`;
    }
    
    // Calcular duración
    duration = calculateDosingDuration(volumeML, pumpFlowRate);
  }
  
  // Asegurar duración mínima de 1 segundo
  if (duration < 1) {
    duration = 1;
  }
  
  return {
    product: product,
    volumeML: volumeML,
    durationSeconds: duration,
    shouldDose: true, // Siempre dosificar si hay diferencia de pH
    safetyWarning: result.safetyWarning,
    details: result.details
  };
}

module.exports = {
  calculateAcidForPHDecrease,
  calculateChlorineForPHIncrease,
  calculateDosingDuration,
  calculateAutomaticDosing,
  DOSAGE_CONSTANTS
};
