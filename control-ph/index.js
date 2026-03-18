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
const COMMAND_PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;

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
  const aStatus = String(a.command?.status || '');
  const bStatus = String(b.command?.status || '');
  if (aStatus !== bStatus) {
    if (aStatus === 'pending') return -1;
    if (bStatus === 'pending') return 1;
  }

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
exports.receiveSensorData = onRequest({ invoker: 'public' }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  try {
    const { deviceId, ph, voltage, wifiRSSI, uptime, offline } = req.body;
    
    logger.info('📥 Datos recibidos:', { deviceId, ph, voltage, wifiRSSI, uptime, offline });
    
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
      isRecent: offline !== true  // Si offline=true, marcar como NO reciente
    };
    
    // Si el dispositivo está notificando que va offline, registrarlo
    if (offline === true) {
      logger.info(`📴 Dispositivo ${deviceId} notificó que está cambiando a modo offline`);
      sensorPayload.offlineMode = true;
    }

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
exports.getCommand = onRequest({ invoker: 'public' }, async (req, res) => {
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
    const now = Date.now();

    for (const userId of userIds) {
      const commandsRef = realtimeDb.ref(`users/${userId}/commands`);
      const pendingSnapshot = await commandsRef
        .orderByChild('status')
        .equalTo('pending')
        .once('value');

      if (pendingSnapshot.exists()) {
        const pendingCommands = pendingSnapshot.val() || {};
        Object.entries(pendingCommands).forEach(([commandId, command]) => {
          commandCandidates.push({
            userId,
            commandId,
            command: command || {}
          });
        });
      }

      // Recuperar comandos que quedaron trabados en "processing"
      // (por reinicio de ESP32 o corte de red antes de confirmar).
      const processingSnapshot = await commandsRef
        .orderByChild('status')
        .equalTo('processing')
        .once('value');

      if (processingSnapshot.exists()) {
        const processingCommands = processingSnapshot.val() || {};
        Object.entries(processingCommands).forEach(([commandId, command]) => {
          const processedAt = Number(command?.processedAt || 0);
          const stale = !processedAt || (now - processedAt) > COMMAND_PROCESSING_TIMEOUT_MS;
          if (!stale) {
            return;
          }

          commandCandidates.push({
            userId,
            commandId,
            command: {
              ...(command || {}),
              staleProcessing: true
            }
          });
        });
      }
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
    const nowTs = Date.now();

    // Marcar como "processing"
    await selectedCommandRef.update({
      status: 'processing',
      processedAt: nowTs,
      dispatchCount: Number(command?.dispatchCount || 0) + 1,
      lastDispatchAt: nowTs
    });

    if (command?.source === 'automatic') {
      await realtimeDb.ref(`users/${userId}/dosingState`).update({
        autoCommandId: commandId,
        autoCommandStatus: 'processing',
        autoCommandProduct: command.product || null,
        autoCommandDuration: Number(command?.duration || 0),
        autoCommandStartedAt: nowTs,
        autoCommandUpdatedAt: nowTs,
        autoDosingActive: true,
      });
    }

    logger.info(`📤 Comando enviado a ${deviceId} (${userId}): ${command.product}, ${command.duration || 0}s`);
    if (command?.staleProcessing) {
      logger.warn(`♻️ Reintentando comando trabado en processing: ${commandId} (${userId})`);
    }

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
exports.confirmCommand = onRequest({ invoker: 'public' }, async (req, res) => {
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
    let commandData = null;

    if (requestedUserId && deviceUserIds.includes(requestedUserId)) {
      const requestedSnapshot = await realtimeDb
        .ref(`users/${requestedUserId}/commands/${commandId}`)
        .once('value');
      if (requestedSnapshot.exists()) {
        commandUserId = requestedUserId;
        commandData = requestedSnapshot.val() || null;
      }
    } else {
      for (const candidateUserId of deviceUserIds) {
        const commandSnapshot = await realtimeDb
          .ref(`users/${candidateUserId}/commands/${commandId}`)
          .once('value');
        if (commandSnapshot.exists()) {
          commandUserId = candidateUserId;
          commandData = commandSnapshot.val() || null;
          break;
        }
      }
    }

    if (!commandUserId) {
      res.status(404).json({ error: 'Command owner not found for this device' });
      return;
    }
    
    const nowTs = Date.now();

    // Actualizar comando
    await realtimeDb.ref(`users/${commandUserId}/commands/${commandId}`).update({
      status: status,
      completedAt: nowTs
    });
    
    // Registrar en historial
    await realtimeDb.ref(`users/${commandUserId}/dosingHistory`).push({
      commandId: commandId,
      status: status,
      timestamp: nowTs,
      deviceId: deviceId
    });

    if (commandData?.source === 'automatic') {
      await realtimeDb.ref(`users/${commandUserId}/dosingState`).update({
        autoCommandId: commandId,
        autoCommandStatus: status,
        autoCommandUpdatedAt: nowTs,
        autoCommandCompletedAt: nowTs,
        autoDosingActive: false,
      });
    }
    
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
    
    // Filtrar usuarios con modo automático.
    // Compatibilidad: usuarios legacy pueden no tener "dosingMode",
    // pero sí "autoDosingEnabled" (o ninguno, que por defecto era automático).
    const autoUsers = [];
    usersSnapshot.forEach(doc => {
      const userData = doc.data() || {};
      const configuredMode =
        typeof userData.dosingMode === 'string' ? userData.dosingMode : '';
      const fallbackAutoEnabled = userData.autoDosingEnabled !== false;
      const resolvedMode = configuredMode || (fallbackAutoEnabled ? 'automatic' : 'manual');

      if (resolvedMode === 'automatic') {
        autoUsers.push({ uid: doc.id, ...userData, dosingMode: resolvedMode });
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
    const setAutoState = async (patch = {}) => {
      const nowTs = Date.now();
      await dosingStateRef.update({
        autoDosingActive: false,
        autoCommandUpdatedAt: nowTs,
        ...patch,
      });
    };
    
    // Validar configuración desde Firestore
    if (!userData.phTolerance || !userData.phToleranceRange) {
      await setAutoState({
        autoCommandStatus: 'misconfigured',
        autoCommandMessage: 'Configuracion incompleta para modo automatico',
      });
      logger.info('⚠️ Usuario sin configuración completa');
      return;
    }
    
    // Leer configuración de administrador (si existe)
    const adminConfig = userData.adminConfig || {};
    const toNumberOr = (value, fallback) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const minWaitHours = adminConfig.minWaitTimeBetweenDoses !== undefined 
      ? adminConfig.minWaitTimeBetweenDoses 
      : 0; // Sin espera por defecto, usar configuración de admin
    const MIN_WAIT_TIME = minWaitHours * 60 * 60 * 1000; // Convertir horas a ms
    const MAX_DAILY_DOSES = toNumberOr(adminConfig.maxDailyDoses, 10);
    const MIN_PH = toNumberOr(adminConfig.minPH, 0.0);
    const MAX_PH = toNumberOr(adminConfig.maxPH, 14.0);
    const MAX_PH_CHANGE = toNumberOr(adminConfig.maxPHChange, 2.0);
    const CORRECTION_FACTOR = toNumberOr(adminConfig.correctionFactor, 0.8);
    
    const targetPH = userData.phTolerance;
    const tolerance = userData.phToleranceRange;
    
    logger.info(`📊 Config: pH objetivo ${targetPH} ±${tolerance}`);
    logger.info(`⚙️ Admin Config: Min wait ${minWaitHours}h, Max doses ${MAX_DAILY_DOSES}/día`);
    
    // Verificar ventanas horarias de dosificación automática
    const autoDosingWindows = userData.autoDosingWindows || [];
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Si hay ventanas configuradas, verificar que estemos dentro de una
    if (Array.isArray(autoDosingWindows) && autoDosingWindows.length > 0) {
      const activeWindows = autoDosingWindows.filter(w => w.enabled);
      
      if (activeWindows.length > 0) {
        const isWithinWindow = activeWindows.some(window => {
          // Verificar día
          if (!Array.isArray(window.days) || !window.days.includes(currentDay)) {
            return false;
          }
          
          // Verificar hora
          const [startH, startM] = (window.startTime || '00:00').split(':').map(Number);
          const [endH, endM] = (window.endTime || '23:59').split(':').map(Number);
          const startMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;
          
          return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        });
        
        if (!isWithinWindow) {
          logger.info(`⏰ Fuera de ventana horaria. Hora actual: ${currentTime}, Día: ${currentDay}`);
          await setAutoState({
            autoCommandStatus: 'outside_window',
            autoCommandMessage: `Fuera de ventana horaria (${currentTime})`,
          });
          return;
        }
        
        logger.info(`✅ Dentro de ventana horaria permitida`);
      }
    }
    
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
      await setAutoState({
        autoCommandStatus: 'sensor_missing',
        autoCommandMessage: 'Sin datos del sensor en Firebase',
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
      await setAutoState({
        autoCommandStatus: 'sensor_stale',
        autoCommandMessage: `Datos obsoletos (${Math.round(dataAge / 1000)}s)`,
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
      await setAutoState({
        autoCommandStatus: 'idle_in_range',
        autoCommandMessage: 'pH en rango. Sin correccion necesaria',
      });
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
      await setAutoState({
        autoCommandStatus: 'blocked_safety',
        autoCommandMessage: errorMsg,
      });
      return;
    }
    
    // 4. Verificar si necesita dosificación en bloques
    let targetDeviation = deviation;
    let blockInfo = null;
    
    if (Math.abs(deviation) > MAX_PH_CHANGE) {
      // Calcular cuántos bloques se necesitan
      const totalBlocks = Math.ceil(Math.abs(deviation) / MAX_PH_CHANGE);
      const currentBlock = (dosingState.currentBlock || 0) + 1;
      
      if (currentBlock <= totalBlocks) {
        // Dosificar solo MAX_PH_CHANGE en este bloque
        targetDeviation = deviation > 0 ? MAX_PH_CHANGE : -MAX_PH_CHANGE;
        blockInfo = {
          currentBlock,
          totalBlocks,
          originalDeviation: deviation
        };
        
        logger.info(`📦 Dosificación en bloques: ${currentBlock}/${totalBlocks}`);
        logger.info(`   Desviación original: ${deviation.toFixed(2)}`);
        logger.info(`   Desviación este bloque: ${targetDeviation.toFixed(2)}`);
        
        await addLog(userId, 'info', `Dosificación en bloques ${currentBlock}/${totalBlocks}`, {
          originalDeviation: deviation,
          blockDeviation: targetDeviation,
          currentBlock,
          totalBlocks
        });
      } else {
        // Ya se completaron todos los bloques, resetear
        await realtimeDb.ref(`users/${userId}/dosingState`).update({
          currentBlock: 0
        });
        logger.info('✅ Todos los bloques de dosificación completados');
        return;
      }
    } else {
      // Resetear contador de bloques si la desviación es pequeña
      if (dosingState.currentBlock) {
        await realtimeDb.ref(`users/${userId}/dosingState`).update({
          currentBlock: 0
        });
      }
    }
    
    // 5. Verificar si ya hay un comando pendiente o en progreso
    const autoCommandStatus = dosingState.autoCommandStatus || '';
    if (autoCommandStatus === 'pending' || autoCommandStatus === 'processing') {
      const commandAge = Date.now() - (dosingState.autoCommandCreatedAt || 0);
      // Si el comando tiene menos de 5 minutos, esperar
      if (commandAge < 5 * 60 * 1000) {
        logger.info(`⏳ Comando en progreso (${autoCommandStatus}), esperando...`);
        return;
      } else {
        // Si el comando tiene más de 5 minutos, considerarlo trabado y continuar
        logger.warn(`⚠️ Comando trabado (${autoCommandStatus}), creando nuevo comando`);
      }
    }
    
    // 6. Verificar tiempo de espera (solo si es mayor a 0)
    // Usar el tiempo de finalización del último comando, no el de creación
    const lastDosingCompletedTime = dosingState.autoCommandCompletedAt || dosingState.lastDosingTime || 0;
    const timeSinceLastDosing = Date.now() - lastDosingCompletedTime;
    
    if (minWaitHours > 0 && timeSinceLastDosing < MIN_WAIT_TIME) {
      const remainingMinutes = Math.ceil((MIN_WAIT_TIME - timeSinceLastDosing) / 60000);
      logger.info(`⏱️ Esperando ${remainingMinutes} minutos desde última dosificación completada`);
      return;
    }
    
    // 7. Verificar límite diario
    const today = new Date().toDateString();
    const dosingCountToday = (dosingState.lastDosingDate === today) 
      ? (dosingState.dosingCountToday || 0) 
      : 0;
    
    if (dosingCountToday >= MAX_DAILY_DOSES) {
      logger.error(`❌ Límite diario alcanzado: ${dosingCountToday}/${MAX_DAILY_DOSES}`);
      await addLog(userId, 'warning', `Límite diario alcanzado: ${dosingCountToday}/${MAX_DAILY_DOSES}`, { dosingCountToday, MAX_DAILY_DOSES });
      return;
    }
    
    // 8. Calcular dosificación usando fórmulas correctas
    const poolVolume = userData.poolVolume || 50000; // Litros
    const alkalinity = userData.alkalinity || 100; // ppm
    const chlorineType = userData.chlorineType || 'sodium-hypochlorite';
    const acidType = userData.acidType || 'muriatic';
    const pumpFlowRate = toNumberOr(adminConfig.pumpFlowRate, 3.0); // L/h - Ajustar según tu bomba
    const maxDoseVolume = toNumberOr(adminConfig.maxDoseVolume, 500); // ml
    
    // Calcular pH objetivo para este bloque
    const blockTargetPH = currentPH - targetDeviation;
    
    logger.info(`📐 Calculando dosificación para piscina de ${poolVolume}L`);
    logger.info(`🧪 Químicos: Cloro=${chlorineType}, Ácido=${acidType}`);
    if (blockInfo) {
      logger.info(`📦 Bloque ${blockInfo.currentBlock}/${blockInfo.totalBlocks}`);
      logger.info(`   pH actual: ${currentPH.toFixed(2)}`);
      logger.info(`   pH objetivo final: ${targetPH.toFixed(2)}`);
      logger.info(`   pH objetivo este bloque: ${blockTargetPH.toFixed(2)}`);
    }
    
    const dosingCalc = calculateAutomaticDosing({
      poolVolumeLiters: poolVolume,
      currentPH: currentPH,
      targetPH: blockTargetPH,
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
    
    // 9. Crear comando en Firebase (Arduino lo leerá con getCommand)
    const commandsRef = realtimeDb.ref(`users/${userId}/commands`);
    const newCommandRef = commandsRef.push();
    
    const commandCreatedAt = Date.now();

    await newCommandRef.set({
      product: product,
      duration: duration,
      status: 'pending',
      createdAt: commandCreatedAt,
      source: 'automatic',
      phBefore: currentPH,
      phTarget: blockTargetPH,
      phTargetFinal: targetPH,
      deviation: targetDeviation,
      deviationOriginal: deviation,
      blockInfo: blockInfo || null
    });
    
    const commandId = newCommandRef.key;
    
    logger.info(`✅ Comando automático creado en Firebase: ${commandId}`);
    if (blockInfo) {
      logger.info(`   📦 Bloque ${blockInfo.currentBlock}/${blockInfo.totalBlocks}`);
    }
    
    // Actualizar estado en Realtime Database
    const stateUpdate = {
      lastDosingTime: commandCreatedAt,
      lastDosingDate: today,
      dosingCountToday: dosingCountToday + 1,
      lastProduct: product,
      lastDuration: duration,
      lastPH: currentPH,
      lastDeviation: deviation,
      lastCommandId: commandId,
      autoCommandId: commandId,
      autoCommandStatus: 'pending',
      autoCommandProduct: product,
      autoCommandDuration: duration,
      autoCommandCreatedAt: commandCreatedAt,
      autoCommandUpdatedAt: commandCreatedAt,
      autoCommandMessage: blockInfo 
        ? `Dosificando bloque ${blockInfo.currentBlock}/${blockInfo.totalBlocks}`
        : `Comando automatico creado: ${product} por ${duration}s`,
      autoDosingActive: true,
    };
    
    // Si hay bloques, actualizar el contador
    if (blockInfo) {
      stateUpdate.currentBlock = blockInfo.currentBlock;
      stateUpdate.totalBlocks = blockInfo.totalBlocks;
    }
    
    await realtimeDb.ref(`users/${userId}/dosingState`).update(stateUpdate);
    
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
exports.getSystemStatus = onRequest({ invoker: 'public' }, async (req, res) => {
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
exports.forceCheck = onRequest({ invoker: 'public' }, async (req, res) => {
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
exports.sendManualDosingCommand = onRequest({ invoker: 'public' }, async (req, res) => {
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
    
    const userDoc = await firestore.collection('users').doc(userId).get();
    const userData = userDoc.exists ? (userDoc.data() || {}) : {};
    const adminConfig = userData.adminConfig || {};
    const parsedMaxManual = Number(adminConfig.maxManualDosingSeconds);
    const maxManualDosingSeconds = Number.isFinite(parsedMaxManual)
      ? Math.max(1, Math.min(3600, Math.round(parsedMaxManual)))
      : 300;

    // Validar duración
    if (duration < 1 || duration > maxManualDosingSeconds) {
      res.status(400).json({
        error: `Duración inválida. Debe estar entre 1 y ${maxManualDosingSeconds} segundos`,
      });
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


// =====================================================
// FUNCIONES DE ADMINISTRACIÓN DE USUARIOS
// =====================================================

/**
 * Lista todos los usuarios registrados (solo para administradores)
 * Requiere autenticación con token de Firebase Auth
 */
exports.listAllUsers = onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Verificar autenticación
    const decoded = await verifyAuthenticatedRequest(req);
    const requestingUserId = decoded.uid;

    logger.info(`📋 Usuario ${requestingUserId} solicitando lista de usuarios`);

    // Verificar si el usuario es administrador
    const requestingUserDoc = await firestore.collection('users').doc(requestingUserId).get();
    const requestingUserData = requestingUserDoc.data() || {};
    
    // Verificar rol de administrador
    if (requestingUserData.role !== 'admin') {
      logger.warn(`⚠️ Usuario ${requestingUserId} no tiene permisos de administrador`);
      res.status(403).json({ error: 'Insufficient permissions. Admin role required.' });
      return;
    }

    logger.info(`✅ Usuario ${requestingUserId} verificado como administrador`);

    // Listar todos los usuarios de Firebase Auth
    const listUsersResult = await admin.auth().listUsers(1000); // Máximo 1000 usuarios
    
    // Obtener datos adicionales de Firestore para cada usuario
    const usersWithData = await Promise.all(
      listUsersResult.users.map(async (userRecord) => {
        try {
          const userDoc = await firestore.collection('users').doc(userRecord.uid).get();
          const userData = userDoc.exists ? userDoc.data() : {};
          
          return {
            id: userRecord.uid,
            email: userRecord.email || null,
            displayName: userRecord.displayName || userData.displayName || null,
            emailVerified: userRecord.emailVerified || false,
            disabled: userRecord.disabled || false,
            createdAt: userRecord.metadata.creationTime || null,
            lastSignIn: userRecord.metadata.lastSignInTime || null,
            role: userData.role || 'user',
            linkedDeviceIds: userData.linkedDeviceIds || [],
            linkedDeviceNames: userData.linkedDeviceNames || {},
          };
        } catch (error) {
          logger.error(`Error obteniendo datos de usuario ${userRecord.uid}:`, error);
          return {
            id: userRecord.uid,
            email: userRecord.email || null,
            displayName: userRecord.displayName || null,
            emailVerified: userRecord.emailVerified || false,
            disabled: userRecord.disabled || false,
            createdAt: userRecord.metadata.creationTime || null,
            lastSignIn: userRecord.metadata.lastSignInTime || null,
            role: 'user',
            linkedDeviceIds: [],
            linkedDeviceNames: {},
          };
        }
      })
    );

    logger.info(`✅ Listados ${usersWithData.length} usuarios`);

    res.json({
      success: true,
      users: usersWithData,
      count: usersWithData.length,
      timestamp: Date.now()
    });

  } catch (error) {
    if (error.message === 'AUTH_MISSING') {
      res.status(401).json({ error: 'Authorization header missing' });
      return;
    }

    logger.error('❌ Error en listAllUsers:', error);
    res.status(500).json({ error: error.message || 'Unexpected error' });
  }
});

/**
 * Elimina completamente un usuario (solo para administradores)
 * Elimina: Firebase Auth, Firestore, Realtime Database, y vínculos de dispositivos
 */
exports.deleteUserCompletely = onRequest(async (req, res) => {
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
    // Verificar autenticación
    const decoded = await verifyAuthenticatedRequest(req);
    const requestingUserId = decoded.uid;
    const targetUserId = req.body.targetUserId;

    if (!targetUserId) {
      res.status(400).json({ error: 'targetUserId is required' });
      return;
    }

    logger.info(`🗑️ Usuario ${requestingUserId} solicitando eliminar usuario ${targetUserId}`);

    // Verificar si el usuario solicitante es administrador
    const requestingUserDoc = await firestore.collection('users').doc(requestingUserId).get();
    const requestingUserData = requestingUserDoc.data() || {};
    
    if (requestingUserData.role !== 'admin') {
      logger.warn(`⚠️ Usuario ${requestingUserId} no tiene permisos de administrador`);
      res.status(403).json({ error: 'Insufficient permissions. Admin role required.' });
      return;
    }

    // Prevenir auto-eliminación
    if (requestingUserId === targetUserId) {
      logger.warn(`⚠️ Usuario ${requestingUserId} intentó eliminarse a sí mismo`);
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    logger.info(`✅ Usuario ${requestingUserId} verificado como administrador`);

    // 1. Obtener datos del usuario antes de eliminar
    const targetUserDoc = await firestore.collection('users').doc(targetUserId).get();
    const targetUserData = targetUserDoc.exists ? targetUserDoc.data() : {};
    const linkedDeviceIds = targetUserData.linkedDeviceIds || [];

    logger.info(`📋 Usuario a eliminar: ${targetUserId}`);
    logger.info(`   Dispositivos vinculados: ${linkedDeviceIds.length}`);

    // 2. Eliminar vínculos de dispositivos
    for (const deviceId of linkedDeviceIds) {
      try {
        const deviceRef = firestore.collection('devices').doc(deviceId);
        const deviceDoc = await deviceRef.get();
        
        if (deviceDoc.exists) {
          const deviceData = deviceDoc.data() || {};
          const deviceUserIds = deviceData.userIds || [];
          
          // Remover el usuario de la lista de userIds
          const updatedUserIds = deviceUserIds.filter(uid => uid !== targetUserId);
          
          if (updatedUserIds.length > 0) {
            // Si quedan otros usuarios vinculados, actualizar
            await deviceRef.update({
              userIds: updatedUserIds,
              userId: updatedUserIds[0], // Actualizar userId principal
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            logger.info(`   ✅ Dispositivo ${deviceId} actualizado (quedan ${updatedUserIds.length} usuarios)`);
          } else {
            // Si no quedan usuarios, eliminar el dispositivo
            await deviceRef.delete();
            logger.info(`   ✅ Dispositivo ${deviceId} eliminado (sin usuarios restantes)`);
          }
        }
      } catch (error) {
        logger.error(`   ❌ Error procesando dispositivo ${deviceId}:`, error);
      }
    }

    // 3. Eliminar datos de Realtime Database
    try {
      await realtimeDb.ref(`users/${targetUserId}`).remove();
      logger.info(`   ✅ Datos de Realtime Database eliminados`);
    } catch (error) {
      logger.error(`   ❌ Error eliminando Realtime Database:`, error);
    }

    // 4. Eliminar documento de Firestore
    try {
      await firestore.collection('users').doc(targetUserId).delete();
      logger.info(`   ✅ Documento de Firestore eliminado`);
    } catch (error) {
      logger.error(`   ❌ Error eliminando Firestore:`, error);
    }

    // 5. Eliminar usuario de Firebase Auth
    try {
      await admin.auth().deleteUser(targetUserId);
      logger.info(`   ✅ Usuario de Firebase Auth eliminado`);
    } catch (error) {
      logger.error(`   ❌ Error eliminando Firebase Auth:`, error);
    }

    logger.info(`✅ Usuario ${targetUserId} eliminado completamente`);

    res.json({
      success: true,
      message: 'User deleted completely',
      deletedUserId: targetUserId,
      devicesProcessed: linkedDeviceIds.length,
      timestamp: Date.now()
    });

  } catch (error) {
    if (error.message === 'AUTH_MISSING') {
      res.status(401).json({ error: 'Authorization header missing' });
      return;
    }

    logger.error('❌ Error en deleteUserCompletely:', error);
    res.status(500).json({ error: error.message || 'Unexpected error' });
  }
});
