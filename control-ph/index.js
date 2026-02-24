/**
 * Firebase Cloud Functions para Control de Pileta pH
 * Sistema Cloud-Native Completo
 * 
 * NUEVA ARQUITECTURA:
 * - Arduino → Cloud Functions (HTTP POST/GET directo)
 * - Cloud Functions ↔ Firebase Realtime DB
 * - App Web ↔ Firebase (tiempo real)
 * 
 * Sin ThingSpeak, sin rate limits, sin "pelea por tiempos"
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
const DEVICE_ID_REGEX = /^[A-Z0-9_-]{6,64}$/;

function getDeviceUserIds(deviceData = {}) {
  const userIds = Array.isArray(deviceData.userIds) ? deviceData.userIds.filter(Boolean) : [];
  if (userIds.length > 0) {
    return [...new Set(userIds)];
  }
  if (deviceData.userId) {
    return [deviceData.userId];
  }
  return [];
}

function normalizeDeviceId(rawValue) {
  const upper = String(rawValue || '').toUpperCase();
  const candidates = upper.match(/[A-Z0-9_-]{6,64}/g) || [];
  if (candidates.length === 0) {
    return '';
  }
  return candidates.sort((a, b) => b.length - a.length)[0];
}

async function verifyAuthenticatedRequest(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('AUTH_MISSING');
  }

  const idToken = authHeader.slice(7);
  return admin.auth().verifyIdToken(idToken);
}

async function getLinkedUserIdsFromUsersCollection(deviceId) {
  const linkedUsersSnapshot = await firestore
    .collection('users')
    .where('linkedDeviceIds', 'array-contains', deviceId)
    .get();

  const linkedUserIds = [];
  linkedUsersSnapshot.forEach((userDoc) => {
    if (userDoc.id) {
      linkedUserIds.push(userDoc.id);
    }
  });

  return linkedUserIds;
}

async function resolveDeviceUserIds(deviceId) {
  const deviceDoc = await firestore.collection('devices').doc(deviceId).get();
  const fromDeviceDoc = deviceDoc.exists ? getDeviceUserIds(deviceDoc.data() || {}) : [];
  const fromUsersCollection = await getLinkedUserIdsFromUsersCollection(deviceId);
  const userIds = [...new Set([...fromDeviceDoc, ...fromUsersCollection])];

  if (userIds.length > 0) {
    const primaryUserId = userIds[0];
    await firestore
      .collection('devices')
      .doc(deviceId)
      .set(
        {
          userId: primaryUserId,
          userIds,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }

  return {
    userIds,
    deviceExists: deviceDoc.exists,
  };
}

function sortCommandCandidates(a, b) {
  const aCreated = Number(a.command?.createdAt || a.command?.timestamp || 0);
  const bCreated = Number(b.command?.createdAt || b.command?.timestamp || 0);
  if (aCreated !== bCreated) {
    return aCreated - bCreated;
  }
  if (a.userId !== b.userId) {
    return a.userId.localeCompare(b.userId);
  }
  return a.commandId.localeCompare(b.commandId);
}

// =====================================================
// CLOUD FUNCTIONS - COMUNICACIÓN DIRECTA CON ARDUINO
// =====================================================

/**
 * Recibe datos del sensor desde Arduino (HTTP POST cada 10s)
 */
exports.receiveSensorData = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  try {
    const { deviceId, ph, voltage, wifiRSSI, uptime } = req.body;
    
    logger.info('📥 Datos recibidos:', { deviceId, ph, voltage, wifiRSSI, uptime });
    
    // Validar datos
    if (!deviceId || ph === undefined) {
      logger.error('❌ Faltan campos requeridos');
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    // Resolver cuentas vinculadas por deviceId
    logger.info(`🔍 Buscando dispositivo: ${deviceId}`);
    const { userIds, deviceExists } = await resolveDeviceUserIds(deviceId);

    if (userIds.length === 0) {
      logger.error(`❌ Dispositivo sin cuentas vinculadas: ${deviceId}`);
      res.status(404).json({ error: 'Device has no linked users' });
      return;
    }

    if (!deviceExists) {
      logger.warn(`⚠️ Dispositivo sin documento en /devices. Vinculos resueltos desde /users: ${deviceId}`);
    }
    
    logger.info(`✅ Dispositivo encontrado. cuentas vinculadas: ${userIds.join(', ')}`);

    const sensorPayload = {
      ph: parseFloat(ph),
      voltage: parseFloat(voltage) || 0,
      wifiRSSI: parseInt(wifiRSSI) || -50,
      uptime: parseInt(uptime) || 0,
      timestamp: Date.now(),
      deviceId: deviceId,
      isRecent: true
    };

    await Promise.all(userIds.map(async (userId) => {
      const dataPath = `users/${userId}/sensorData`;
      logger.info(`💾 Guardando en: ${dataPath}`);
      await realtimeDb.ref(dataPath).set(sensorPayload);
    }));
    
    logger.info(`✅ Datos guardados correctamente para ${userIds.length} cuenta(s)`);
    
    res.json({ success: true, message: 'Data received', userIds });
    
  } catch (error) {
    logger.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Arduino solicita comandos pendientes (HTTP GET cada 5s)
 */
exports.getCommand = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    const { deviceId } = req.query;
    const isDosingInProgress = req.query.dosingInProgress === '1';
    
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId required' });
      return;
    }
    
    // Resolver cuentas vinculadas por deviceId
    const { userIds } = await resolveDeviceUserIds(deviceId);

    if (userIds.length === 0) {
      res.status(404).json({ error: 'Device has no linked users' });
      return;
    }

    const commandCandidates = [];

    for (const userId of userIds) {
      const commandsRef = realtimeDb.ref(`users/${userId}/commands`);
      const snapshot = await commandsRef
        .orderByChild('status')
        .equalTo('pending')
        .once('value');

      if (!snapshot.exists()) {
        continue;
      }

      const pendingCommands = snapshot.val() || {};
      Object.entries(pendingCommands).forEach(([commandId, command]) => {
        commandCandidates.push({
          userId,
          commandId,
          command: command || {}
        });
      });
    }

    if (commandCandidates.length === 0) {
      res.json({ command: null });
      return;
    }

    const emergencyCandidates = commandCandidates
      .filter((entry) => entry.command?.product === 'emergency_stop')
      .sort(sortCommandCandidates);

    let selectedEntry = null;
    if (emergencyCandidates.length > 0) {
      selectedEntry = emergencyCandidates[0];
    } else if (!isDosingInProgress) {
      selectedEntry = commandCandidates.sort(sortCommandCandidates)[0];
    }

    if (!selectedEntry) {
      res.json({ command: null });
      return;
    }

    const { userId, commandId, command } = selectedEntry;
    const selectedCommandRef = realtimeDb.ref(`users/${userId}/commands/${commandId}`);

    // Marcar como "processing"
    await selectedCommandRef.update({
      status: 'processing',
      processedAt: Date.now()
    });

    logger.info(`📤 Comando enviado a ${deviceId} (${userId}): ${command.product}, ${command.duration || 0}s`);

    res.json({
      commandId: commandId,
      userId,
      product: command.product,
      duration: command.duration || 0
    });
    
  } catch (error) {
    logger.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Arduino confirma comando completado (HTTP POST)
 */
exports.confirmCommand = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  try {
    const { commandId, deviceId, status, userId: requestedUserId } = req.body;
    
    if (!commandId || !deviceId || !status) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    // Resolver cuentas vinculadas por deviceId
    const { userIds: deviceUserIds } = await resolveDeviceUserIds(deviceId);

    if (deviceUserIds.length === 0) {
      res.status(404).json({ error: 'Device has no linked users' });
      return;
    }

    let commandUserId = null;

    if (requestedUserId && deviceUserIds.includes(requestedUserId)) {
      const requestedSnapshot = await realtimeDb
        .ref(`users/${requestedUserId}/commands/${commandId}`)
        .once('value');
      if (requestedSnapshot.exists()) {
        commandUserId = requestedUserId;
      }
    } else {
      for (const candidateUserId of deviceUserIds) {
        const commandSnapshot = await realtimeDb
          .ref(`users/${candidateUserId}/commands/${commandId}`)
          .once('value');
        if (commandSnapshot.exists()) {
          commandUserId = candidateUserId;
          break;
        }
      }
    }

    if (!commandUserId) {
      res.status(404).json({ error: 'Command owner not found for this device' });
      return;
    }
    
    // Actualizar comando
    await realtimeDb.ref(`users/${commandUserId}/commands/${commandId}`).update({
      status: status,
      completedAt: Date.now()
    });
    
    // Registrar en historial
    await realtimeDb.ref(`users/${commandUserId}/dosingHistory`).push({
      commandId: commandId,
      status: status,
      timestamp: Date.now(),
      deviceId: deviceId
    });
    
    logger.info(`✅ Comando ${commandId} confirmado (${commandUserId}): ${status}`);
    
    res.json({ success: true });
    
  } catch (error) {
    logger.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Vincula un Device ID a la cuenta autenticada.
 * Se ejecuta con Admin SDK (no depende de reglas de cliente en /devices).
 */
exports.linkDeviceToAccount = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const decoded = await verifyAuthenticatedRequest(req);
    const uid = decoded.uid;
    const email = decoded.email || '';

    const normalizedDeviceId = normalizeDeviceId(req.body?.deviceId);
    const requestedName = String(req.body?.deviceName || '').trim();
    const deviceName = requestedName || 'Piscina principal';

    if (!normalizedDeviceId || !DEVICE_ID_REGEX.test(normalizedDeviceId)) {
      res.status(400).json({ error: 'Invalid deviceId' });
      return;
    }

    const userRef = firestore.collection('users').doc(uid);
    const deviceRef = firestore.collection('devices').doc(normalizedDeviceId);

    await userRef.set(
      {
        linkedDeviceIds: admin.firestore.FieldValue.arrayUnion(normalizedDeviceId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await userRef.set(
      {
        linkedDeviceNames: {
          [normalizedDeviceId]: deviceName,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const deviceSnap = await deviceRef.get();
    if (deviceSnap.exists) {
      await deviceRef.update({
        userIds: admin.firestore.FieldValue.arrayUnion(uid),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await deviceRef.set({
        userId: uid,
        userIds: [uid],
        name: deviceName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeen: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          registeredFrom: 'cloud-function-link',
          userEmail: email,
        },
      });
    }

    res.json({
      success: true,
      userId: uid,
      deviceId: normalizedDeviceId,
    });
  } catch (error) {
    if (error.message === 'AUTH_MISSING') {
      res.status(401).json({ error: 'Authorization header missing' });
      return;
    }

    logger.error('❌ Error en linkDeviceToAccount:', error);
    res.status(500).json({ error: error.message || 'Unexpected error' });
  }
});

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
 * NUEVO: Lee datos de Firebase (enviados por Arduino vía receiveSensorData)
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
    const minWaitHours = adminConfig.minWaitTimeBetweenDoses !== undefined 
      ? adminConfig.minWaitTimeBetweenDoses 
      : 0.5;
    const MIN_WAIT_TIME = minWaitHours * 60 * 60 * 1000; // Convertir horas a ms
    const MAX_DAILY_DOSES = adminConfig.maxDailyDoses || 10;
    const MIN_PH = adminConfig.minPH || 6.0;
    const MAX_PH = adminConfig.maxPH || 8.5;
    const MAX_PH_CHANGE = adminConfig.maxPHChange || 1.0;
    const CORRECTION_FACTOR = adminConfig.correctionFactor || 0.8;
    
    const targetPH = userData.phTolerance;
    const tolerance = userData.phToleranceRange;
    
    logger.info(`📊 Config: pH objetivo ${targetPH} ±${tolerance}`);
    logger.info(`⚙️ Admin Config: Min wait ${minWaitHours}h, Max doses ${MAX_DAILY_DOSES}/día`);
    
    // 1. Leer datos del sensor desde Firebase (enviados por Arduino)
    const sensorDataRef = realtimeDb.ref(`users/${userId}/sensorData`);
    const sensorDataSnapshot = await sensorDataRef.once('value');
    const sensorData = sensorDataSnapshot.val();
    
    if (!sensorData || !sensorData.ph) {
      logger.info('❌ No hay datos del sensor en Firebase');
      await updateSystemStatus(userId, {
        lastCheck: Date.now(),
        currentPH: null,
        targetPH: targetPH,
        autoMode: true,
        error: 'No hay datos del sensor'
      });
      return;
    }
    
    // Verificar que los datos sean recientes (últimos 2 minutos)
    const dataAge = Date.now() - sensorData.timestamp;
    if (dataAge > 2 * 60 * 1000) {
      logger.info(`❌ Datos obsoletos (${Math.round(dataAge/1000)}s)`);
      await updateSystemStatus(userId, {
        lastCheck: Date.now(),
        currentPH: sensorData.ph,
        targetPH: targetPH,
        autoMode: true,
        error: 'Datos del sensor obsoletos'
      });
      return;
    }
    
    const currentPH = sensorData.ph;
    logger.info(`🧪 pH actual: ${currentPH} (edad: ${Math.round(dataAge/1000)}s)`);
    
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
    
    // 5. Verificar tiempo de espera (solo si es mayor a 0)
    const lastDosingTime = dosingState.lastDosingTime || 0;
    const timeSinceLastDosing = Date.now() - lastDosingTime;
    
    if (minWaitHours > 0 && timeSinceLastDosing < MIN_WAIT_TIME) {
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
    
    // 8. Crear comando en Firebase (Arduino lo leerá con getCommand)
    const commandsRef = realtimeDb.ref(`users/${userId}/commands`);
    const newCommandRef = commandsRef.push();
    
    await newCommandRef.set({
      product: product,
      duration: duration,
      status: 'pending',
      createdAt: Date.now(),
      source: 'automatic',
      phBefore: currentPH,
      phTarget: targetPH,
      deviation: deviation
    });
    
    const commandId = newCommandRef.key;
    
    logger.info(`✅ Comando automático creado en Firebase: ${commandId}`);
    
    // Actualizar estado en Realtime Database
    await realtimeDb.ref(`users/${userId}/dosingState`).update({
      lastDosingTime: Date.now(),
      lastDosingDate: today,
      dosingCountToday: dosingCountToday + 1,
      lastProduct: product,
      lastDuration: duration,
      lastPH: currentPH,
      lastDeviation: deviation,
      lastCommandId: commandId
    });
    
    // Actualizar estado del sistema
    await updateSystemStatus(userId, {
      lastDosing: Date.now(),
      dosingCount: dosingCountToday + 1,
      lastCommandId: commandId
    });
    
    // Agregar log
    await addLog(userId, 'success', `Dosificación automática creada: ${product} por ${duration}s`, {
      commandId,
      product,
      duration,
      currentPH,
      targetPH,
      deviation
    });
    
    logger.info('✅ Comando creado, Arduino lo procesará en máximo 5 segundos');
    
  } catch (error) {
    logger.error(`❌ Error procesando usuario ${userId}:`, error);
    await addLog(userId, 'error', `Error procesando usuario: ${error.message}`, { error: error.toString() });
  }
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

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
    const userId = req.query.userId;

    if (!userId) {
      res.status(400).json({ error: 'userId required' });
      return;
    }

    const sensorDataRef = realtimeDb.ref(`users/${userId}/sensorData`);
    const sensorDataSnapshot = await sensorDataRef.once('value');
    const sensorData = sensorDataSnapshot.val();
    const lastTimestamp = sensorData?.timestamp || 0;
    const dataAgeMs = lastTimestamp ? (Date.now() - lastTimestamp) : null;
    const sensorConnected = dataAgeMs !== null && dataAgeMs <= (2 * 60 * 1000);
    
    const status = {
      status: 'online',
      timestamp: Date.now(),
      userId,
      currentPH: sensorData?.ph ?? null,
      sensorConnected,
      dataAgeSeconds: dataAgeMs !== null ? Math.round(dataAgeMs / 1000) : null,
      source: 'firebase-realtime',
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
 * NUEVO: Crea comando en Firebase, Arduino lo lee con getCommand
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
    
    // Crear comando en Firebase Realtime DB
    const commandsRef = realtimeDb.ref(`users/${userId}/commands`);
    const newCommandRef = commandsRef.push();
    
    await newCommandRef.set({
      product: product,
      duration: duration,
      status: 'pending',
      createdAt: Date.now(),
      source: 'web-app'
    });
    
    const commandId = newCommandRef.key;
    
    logger.info(`✅ Comando creado en Firebase: ${commandId}`);
    
    // Agregar log
    await addLog(userId, 'info', `Comando manual creado: ${product} por ${duration}s`, {
      commandId,
      product,
      duration,
      source: 'web-app'
    });
    
    res.json({
      success: true,
      message: 'Comando creado, Arduino lo procesará en máximo 5 segundos',
      commandId: commandId,
      product,
      duration,
      timestamp: Date.now()
    });
    
  } catch (error) {
    logger.error('❌ Error en sendManualDosingCommand:', error);
    res.status(500).json({ error: error.message });
  }
});
