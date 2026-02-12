/**
 * Firebase Cloud Functions para Control de Pileta pH
 * Sistema autónomo 24/7 que monitorea y dosifica automáticamente
 */

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { calculateAutomaticDosing } = require("./dosageCalculations");

admin.initializeApp();

// Configuración global
setGlobalOptions({ maxInstances: 10 });

// Referencias a las bases de datos
const firestore = admin.firestore();
const realtimeDb = admin.database();

// Configuración de ThingSpeak
const THINGSPEAK_CHANNEL_ID = '3249157';
const THINGSPEAK_READ_API_KEY = 'S7Q7FWREGP96KX04';
const THINGSPEAK_WRITE_API_KEY = 'GQXD1DTF1D6DPUSG';

/**
 * Función que se ejecuta cada 1 minuto para verificar y dosificar
 */
exports.checkAndDoseAutomatically = onSchedule("every 1 minutes", async (event) => {
  logger.info('🔍 Iniciando verificación automática...');
  
  try {
    // 1. Obtener todos los usuarios con modo automático activado desde FIRESTORE
    const usersSnapshot = await firestore.collection('users').get();
    
    if (usersSnapshot.empty) {
      logger.info('ℹ️ No hay usuarios registrados');
      return null;
    }
    
    // Filtrar usuarios con modo automático
    const autoUsers = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      if (userData.dosingMode === 'automatic') {
        autoUsers.push({ uid: doc.id, ...userData });
      }
    });
    
    if (autoUsers.length === 0) {
      logger.info('ℹ️ No hay usuarios con modo automático activado');
      return null;
    }
    
    logger.info(`📊 Verificando ${autoUsers.length} usuario(s) con modo automático`);
    
    // 2. Procesar cada usuario
    for (const user of autoUsers) {
      await processUser(user.uid, user);
    }
    
    logger.info('✅ Verificación completada');
    return null;
    
  } catch (error) {
    logger.error('❌ Error en verificación automática:', error);
    return null;
  }
});

/**
 * Procesa un usuario individual
 */
async function processUser(userId, userData) {
  try {
    logger.info(`\n👤 Procesando usuario: ${userId}`);
    
    // Leer estado de dosificación desde Realtime Database
    const dosingStateRef = realtimeDb.ref(`users/${userId}/dosingState`);
    const dosingStateSnapshot = await dosingStateRef.once('value');
    const dosingState = dosingStateSnapshot.val() || {};
    
    // Validar configuración desde Firestore
    if (!userData.phTolerance || !userData.phToleranceRange) {
      logger.info('⚠️ Usuario sin configuración completa');
      return;
    }
    
    // Leer configuración de administrador (si existe)
    const adminConfig = userData.adminConfig || {};
    const MIN_WAIT_TIME = (adminConfig.minWaitTimeBetweenDoses || 0.5) * 60 * 60 * 1000; // Convertir horas a ms
    const MAX_DAILY_DOSES = adminConfig.maxDailyDoses || 10;
    const MIN_PH = adminConfig.minPH || 6.0;
    const MAX_PH = adminConfig.maxPH || 8.5;
    const MAX_PH_CHANGE = adminConfig.maxPHChange || 1.0;
    const CORRECTION_FACTOR = adminConfig.correctionFactor || 0.8;
    
    const targetPH = userData.phTolerance;
    const tolerance = userData.phToleranceRange;
    
    logger.info(`📊 Config: pH objetivo ${targetPH} ±${tolerance}`);
    logger.info(`⚙️ Admin Config: Min wait ${adminConfig.minWaitTimeBetweenDoses || 0.5}h, Max doses ${MAX_DAILY_DOSES}/día`);
    
    // 1. Leer datos del sensor desde ThingSpeak
    const sensorData = await readPHFromThingSpeak();
    if (!sensorData) {
      logger.info('❌ No se pudo leer datos de ThingSpeak');
      await updateSystemStatus(userId, {
        lastCheck: Date.now(),
        currentPH: null,
        targetPH: targetPH,
        autoMode: true,
        error: 'No se pudo leer datos de ThingSpeak'
      });
      return;
    }
    
    const currentPH = sensorData.ph;
    logger.info(`🧪 pH actual: ${currentPH}`);
    
    // Actualizar datos del sensor en Firebase Realtime Database
    await realtimeDb.ref(`users/${userId}/sensorData`).set({
      currentPH: currentPH,
      voltage: sensorData.voltage,
      wifiRSSI: sensorData.wifiRSSI,
      uptime: sensorData.uptime,
      timestamp: sensorData.timestamp,
      dataAge: sensorData.dataAge,
      isRecent: sensorData.isRecent,
      lastUpdate: Date.now()
    });
    
    // 2. Verificar si necesita dosificar
    const deviation = currentPH - targetPH;
    const needsDosing = Math.abs(deviation) > tolerance;
    
    // Actualizar estado del sistema
    await updateSystemStatus(userId, {
      lastCheck: Date.now(),
      currentPH: currentPH,
      targetPH: targetPH,
      autoMode: true,
      deviation: deviation,
      needsDosing: needsDosing,
      dosingCount: dosingState.dosingCountToday || 0
    });
    
    if (!needsDosing) {
      logger.info(`✅ pH en rango (${(targetPH - tolerance).toFixed(1)} - ${(targetPH + tolerance).toFixed(1)})`);
      await addLog(userId, 'info', `pH en rango: ${currentPH.toFixed(2)}`, { currentPH, targetPH, tolerance });
      return;
    }
    
    logger.info(`⚠️ pH fuera de rango! Desviación: ${deviation.toFixed(2)}`);
    
    // 3. Verificar límites de seguridad
    if (currentPH < MIN_PH || currentPH > MAX_PH) {
      const errorMsg = `pH fuera de rango seguro (${MIN_PH} - ${MAX_PH}). pH actual: ${currentPH}`;
      logger.error(`❌ ${errorMsg}`);
      await addLog(userId, 'error', errorMsg, { currentPH, MIN_PH, MAX_PH });
      await updateSystemStatus(userId, {
        error: errorMsg
      });
      return;
    }
    
    // 4. Verificar cambio máximo de pH
    if (Math.abs(deviation) > MAX_PH_CHANGE) {
      const errorMsg = `Cambio de pH demasiado grande: ${Math.abs(deviation).toFixed(2)} > ${MAX_PH_CHANGE}. Ajusta el pH objetivo o aumenta el limite en configuracion de administrador.`;
      logger.error(`❌ ${errorMsg}`);
      await addLog(userId, 'error', errorMsg, { deviation, MAX_PH_CHANGE, currentPH, targetPH });
      await updateSystemStatus(userId, {
        error: errorMsg
      });
      return;
    }
    
    // 5. Verificar tiempo de espera
    const lastDosingTime = dosingState.lastDosingTime || 0;
    const timeSinceLastDosing = Date.now() - lastDosingTime;
    
    if (timeSinceLastDosing < MIN_WAIT_TIME) {
      const remainingMinutes = Math.ceil((MIN_WAIT_TIME - timeSinceLastDosing) / 60000);
      logger.info(`⏱️ Esperando ${remainingMinutes} minutos antes de dosificar`);
      return;
    }
    
    // 6. Verificar límite diario
    const today = new Date().toDateString();
    const dosingCountToday = (dosingState.lastDosingDate === today) 
      ? (dosingState.dosingCountToday || 0) 
      : 0;
    
    if (dosingCountToday >= MAX_DAILY_DOSES) {
      logger.error(`❌ Límite diario alcanzado: ${dosingCountToday}/${MAX_DAILY_DOSES}`);
      await addLog(userId, 'warning', `Límite diario alcanzado: ${dosingCountToday}/${MAX_DAILY_DOSES}`, { dosingCountToday, MAX_DAILY_DOSES });
      return;
    }
    
    // 7. Calcular dosificación usando fórmulas correctas
    const poolVolume = userData.poolVolume || 50000; // Litros
    const alkalinity = userData.alkalinity || 100; // ppm
    const chlorineType = userData.chlorineType || 'sodium-hypochlorite';
    const acidType = userData.acidType || 'muriatic';
    const pumpFlowRate = adminConfig.pumpFlowRate || 60; // L/h
    const maxDoseVolume = adminConfig.maxDoseVolume || 500; // ml
    
    logger.info(`📐 Calculando dosificación para piscina de ${poolVolume}L`);
    logger.info(`🧪 Químicos: Cloro=${chlorineType}, Ácido=${acidType}`);
    
    const dosingCalc = calculateAutomaticDosing({
      poolVolumeLiters: poolVolume,
      currentPH: currentPH,
      targetPH: targetPH,
      alkalinity: alkalinity,
      chlorineType: chlorineType,
      acidType: acidType,
      pumpFlowRate: pumpFlowRate,
      maxDoseVolume: maxDoseVolume
    });
    
    if (!dosingCalc.shouldDose) {
      logger.info('ℹ️ Cálculo indica que no se debe dosificar');
      await addLog(userId, 'info', dosingCalc.message || 'No se requiere dosificación', dosingCalc);
      return;
    }
    
    if (dosingCalc.safetyWarning) {
      logger.warn(`⚠️ ${dosingCalc.safetyWarning}`);
      await addLog(userId, 'warning', dosingCalc.safetyWarning, dosingCalc.details);
    }
    
    const product = dosingCalc.product;
    const duration = dosingCalc.durationSeconds;
    
    logger.info(`💊 Dosificación calculada:`);
    logger.info(`   Producto: ${product}`);
    logger.info(`   Volumen: ${dosingCalc.volumeML}ml`);
    logger.info(`   Duración: ${duration}s`);
    logger.info(`   Detalles:`, dosingCalc.details);
    
    // 8. Ejecutar dosificación
    const success = await sendDosingCommand(product, duration);
    
    if (success) {
      // Actualizar estado en Realtime Database
      await realtimeDb.ref(`users/${userId}/dosingState`).update({
        lastDosingTime: Date.now(),
        lastDosingDate: today,
        dosingCountToday: dosingCountToday + 1,
        lastProduct: product,
        lastDuration: duration,
        lastPH: currentPH,
        lastDeviation: deviation
      });
      
      // Actualizar estado del sistema
      await updateSystemStatus(userId, {
        lastDosing: Date.now(),
        dosingCount: dosingCountToday + 1
      });
      
      // Registrar en historial en Realtime Database
      await logDosingEvent(userId, {
        timestamp: Date.now(),
        product: product,
        duration: duration,
        phBefore: currentPH,
        phTarget: targetPH,
        deviation: deviation,
        mode: 'automatic',
        source: 'cloud-function',
        correctionFactor: CORRECTION_FACTOR
      });
      
      // Agregar log
      await addLog(userId, 'success', `Dosificación automática: ${product} por ${duration}s`, {
        product,
        duration,
        currentPH,
        targetPH,
        deviation
      });
      
      logger.info('✅ Dosificación completada y registrada');
    } else {
      logger.error('❌ Error al enviar comando de dosificación');
      await addLog(userId, 'error', 'Error al enviar comando de dosificación', { product, duration });
    }
    
  } catch (error) {
    logger.error(`❌ Error procesando usuario ${userId}:`, error);
    await addLog(userId, 'error', `Error procesando usuario: ${error.message}`, { error: error.toString() });
  }
}

/**
 * Lee el pH actual desde ThingSpeak y actualiza Firebase
 */
async function readPHFromThingSpeak() {
  try {
    const url = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/feeds/last.json?api_key=${THINGSPEAK_READ_API_KEY}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const ph = parseFloat(data.field1);
    const voltage = parseFloat(data.field2) || 0;
    const wifiRSSI = parseInt(data.field3) || -50;
    const uptime = parseInt(data.field4) || 0;
    
    if (isNaN(ph) || ph < 0 || ph > 14) {
      return null;
    }
    
    // Verificar que los datos sean recientes (últimos 5 minutos)
    const dataTime = new Date(data.created_at).getTime();
    const now = Date.now();
    const dataAge = now - dataTime;
    
    if (dataAge > 5 * 60 * 1000) {
      logger.warn(`⚠️ Datos obsoletos (${Math.round(dataAge/60000)} minutos)`);
      return null;
    }
    
    // Retornar objeto completo con todos los datos
    return {
      ph,
      voltage,
      wifiRSSI,
      uptime,
      timestamp: dataTime,
      dataAge: Math.round(dataAge / 1000),
      isRecent: true
    };
    
  } catch (error) {
    logger.error('Error leyendo ThingSpeak:', error);
    return null;
  }
}

/**
 * Envía comando de dosificación al ESP32 vía ThingSpeak
 */
async function sendDosingCommand(product, duration) {
  try {
    logger.info(`📤 Enviando comando: ${product}, ${duration}s`);
    
    const productCode = product === 'ph_plus' ? '1' : '2';
    
    // Leer contador actual de Field7
    const currentCountUrl = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/fields/7/last.txt`;
    let currentCount = 0;
    
    try {
      const countResponse = await fetch(currentCountUrl);
      if (countResponse.ok) {
        const countText = await countResponse.text();
        currentCount = parseInt(countText) || 0;
        logger.info(`📊 Contador actual: ${currentCount}`);
      }
    } catch (error) {
      logger.warn('⚠️ No se pudo leer contador, usando 0');
    }
    
    const newCount = currentCount + 1;
    logger.info(`📊 Nuevo contador: ${newCount}`);
    
    // Enviar comando a ThingSpeak
    const commandUrl = `https://api.thingspeak.com/update?api_key=${THINGSPEAK_WRITE_API_KEY}&field5=${productCode}&field6=${duration}&field7=${newCount}`;
    
    logger.info(`🌐 URL: ${commandUrl}`);
    
    const response = await fetch(commandUrl);
    const entryId = await response.text();
    
    logger.info(`📥 Respuesta ThingSpeak: ${entryId}`);
    
    if (entryId !== '0') {
      logger.info(`✅ Comando enviado exitosamente (Entry ID: ${entryId})`);
      return true;
    } else {
      logger.error('❌ ThingSpeak rechazó el comando (rate limit o error)');
      return false;
    }
    
  } catch (error) {
    logger.error('❌ Error enviando comando:', error);
    return false;
  }
}

/**
 * Registra evento de dosificación en el historial
 */
async function logDosingEvent(userId, event) {
  try {
    const historyRef = realtimeDb.ref(`users/${userId}/dosingHistory`);
    await historyRef.push(event);
  } catch (error) {
    logger.error('Error registrando evento:', error);
  }
}

/**
 * Registra evento general (errores, alertas, etc.)
 */
async function logEvent(userId, type, message) {
  try {
    const eventsRef = realtimeDb.ref(`users/${userId}/events`);
    await eventsRef.push({
      timestamp: Date.now(),
      type: type,
      message: message
    });
  } catch (error) {
    logger.error('Error registrando evento:', error);
  }
}

/**
 * Actualiza el estado del sistema en tiempo real
 */
async function updateSystemStatus(userId, status) {
  try {
    const statusRef = realtimeDb.ref(`users/${userId}/systemStatus`);
    await statusRef.update(status);
  } catch (error) {
    logger.error('Error actualizando estado del sistema:', error);
  }
}

/**
 * Agrega un log en tiempo real
 */
async function addLog(userId, type, message, data = null) {
  try {
    const logsRef = realtimeDb.ref(`users/${userId}/logs`);
    await logsRef.push({
      timestamp: new Date().toISOString(),
      type: type,
      message: message,
      data: data
    });
  } catch (error) {
    logger.error('Error agregando log:', error);
  }
}

/**
 * Función HTTP para verificar estado del sistema
 */
exports.getSystemStatus = onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  try {
    const currentPH = await readPHFromThingSpeak();
    
    const status = {
      status: 'online',
      timestamp: Date.now(),
      currentPH: currentPH,
      thingspeakConnected: currentPH !== null,
      cloudFunctionsActive: true
    };
    
    res.json(status);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Función HTTP para forzar verificación manual
 */
exports.forceCheck = onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  try {
    const userId = req.body.userId || req.query.userId;
    
    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }
    
    const userDoc = await firestore.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    await processUser(userId, userDoc.data());
    
    res.json({ 
      success: true, 
      message: 'Verificación forzada completada',
      timestamp: Date.now()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Función HTTP para enviar comandos manuales de dosificación
 */
exports.sendManualDosingCommand = onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  try {
    const { userId, product, duration } = req.body;
    
    if (!userId || !product || !duration) {
      res.status(400).json({ error: 'userId, product y duration son requeridos' });
      return;
    }
    
    // Validar producto
    if (product !== 'ph_plus' && product !== 'ph_minus') {
      res.status(400).json({ error: 'Producto inválido. Debe ser ph_plus o ph_minus' });
      return;
    }
    
    // Validar duración
    if (duration < 1 || duration > 3600) {
      res.status(400).json({ error: 'Duración inválida. Debe estar entre 1 y 3600 segundos' });
      return;
    }
    
    logger.info(`📱 Comando manual recibido de app web: ${product}, ${duration}s`);
    
    // Enviar comando a ThingSpeak
    const success = await sendDosingCommand(product, duration);
    
    if (success) {
      // Registrar comando en Firebase
      await realtimeDb.ref(`users/${userId}/manualCommands`).push({
        product,
        duration,
        timestamp: Date.now(),
        status: 'completed',
        source: 'web-app'
      });
      
      // Agregar log
      await addLog(userId, 'success', `Comando manual enviado: ${product} por ${duration}s`, {
        product,
        duration,
        source: 'web-app'
      });
      
      res.json({
        success: true,
        message: 'Comando enviado exitosamente',
        product,
        duration,
        timestamp: Date.now()
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error enviando comando a ThingSpeak'
      });
    }
    
  } catch (error) {
    logger.error('❌ Error en sendManualDosingCommand:', error);
    res.status(500).json({ error: error.message });
  }
});
