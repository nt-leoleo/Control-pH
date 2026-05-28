/**
 * Cloud Functions v2 (Gen 2) para ESP32
 * IMPORTANTE: Estas funciones usan v2 con invoker público para HTTPS
 */

const {onRequest} = require("firebase-functions/v2/https");
const {onValueWritten} = require("firebase-functions/v2/database");
const admin = require("firebase-admin");

// Usar la instancia de admin ya inicializada
const firestore = admin.firestore();
const realtimeDb = admin.database();

/**
 * Resolver userIds vinculados a un deviceId
 */
async function resolveDeviceUserIds(deviceId) {
  const deviceDoc = await firestore.collection('devices').doc(deviceId).get();
  const deviceData = deviceDoc.exists ? deviceDoc.data() : {};
  
  let userIds = [];
  if (Array.isArray(deviceData.userIds)) {
    userIds = deviceData.userIds.filter(Boolean);
  } else if (deviceData.userId) {
    userIds = [deviceData.userId];
  }
  
  // También buscar en users collection
  const linkedUsersSnapshot = await firestore
    .collection('users')
    .where('linkedDeviceIds', 'array-contains', deviceId)
    .get();
  
  linkedUsersSnapshot.forEach((userDoc) => {
    if (userDoc.id && !userIds.includes(userDoc.id)) {
      userIds.push(userDoc.id);
    }
  });
  
  userIds = [...new Set(userIds)];
  
  // Actualizar o crear documento de dispositivo si hay userIds
  if (userIds.length > 0) {
    await firestore.collection('devices').doc(deviceId).set({
      userId: userIds[0],
      userIds: userIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSeen: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  
  return {
    userIds,
    deviceExists: deviceDoc.exists
  };
}

function normalizeTimestamp(rawTimestamp) {
  const parsed = Number(rawTimestamp);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return Date.now();
  }
  // Si el timestamp es un valor pequeño (milisegundos desde arranque), normalizar a tiempo real
  if (parsed < 1e12) {
    return Date.now();
  }
  return parsed;
}

function parseFloatOrNull(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * ESP32: Recibe datos del sensor (HTTP POST cada 10s)
 */
exports.esp32_receiveSensorData = onRequest({ invoker: 'public' }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  try {
    const { deviceId, ph, voltage, wifiRSSI, uptime, offline, timestamp } = req.body;
    
    console.log('📥 [ESP32] Datos recibidos:', { deviceId, ph, voltage, wifiRSSI, uptime, offline, timestamp });
    
    if (!deviceId) {
      console.error('❌ [ESP32] Falta deviceId');
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    const { userIds, deviceExists } = await resolveDeviceUserIds(deviceId);
    
    if (!deviceExists) {
      console.warn(`⚠️ [ESP32] Dispositivo sin documento en /devices: ${deviceId}`);
    }
    
    const phValue = parseFloatOrNull(ph);
    const sensorPayload = {
      ph: phValue,
      voltage: parseFloatOrNull(voltage) || 0,
      wifiRSSI: Number.isFinite(Number(wifiRSSI)) ? parseInt(wifiRSSI, 10) : -50,
      uptime: Number.isFinite(Number(uptime)) ? parseInt(uptime, 10) : 0,
      timestamp: normalizeTimestamp(timestamp),
      deviceId: deviceId,
      isRecent: true
    };
    
    if (offline === true) {
      console.log(`📴 [ESP32] Dispositivo ${deviceId} modo offline`);
      sensorPayload.offlineMode = true;
      sensorPayload.isRecent = false;
    }
    
    if (phValue === null) {
      console.log(`📥 [ESP32] Heartbeat recibido sin pH valido para ${deviceId}`);
    }
    
    // Siempre guardar el último sensor en la ruta del dispositivo.
    await realtimeDb.ref(`devices/${deviceId}/lastSensorData`).set(sensorPayload);
    
    if (userIds.length > 0) {
      console.log(`✅ [ESP32] Dispositivo encontrado. Cuentas: ${userIds.join(', ')}`);
      await Promise.all(userIds.map(async (userId) => {
        const dataPath = `users/${userId}/sensorData`;
        await realtimeDb.ref(dataPath).set(sensorPayload);
      }));
      console.log(`✅ [ESP32] Datos guardados para ${userIds.length} cuenta(s)`);
    } else {
      console.warn(`⚠️ [ESP32] No hay cuentas vinculadas para ${deviceId}. Guardando en sharedSensorData de fallback.`);
      await realtimeDb.ref(`sharedSensorData/${deviceId}`).set({
        ...sensorPayload,
        fallback: true
      });
    }
    
    res.json({ success: true, message: 'Data received', userIds });
    
  } catch (error) {
    console.error('❌ [ESP32] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ESP32: Solicita comandos pendientes (HTTP GET cada 5s)
 */
exports.esp32_getCommand = onRequest({ invoker: 'public' }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  try {
    const { deviceId } = req.query;
    const isDosingInProgress = req.query.dosingInProgress === '1';
    
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId required' });
      return;
    }
    
    const { userIds } = await resolveDeviceUserIds(deviceId);
    
    if (userIds.length === 0) {
      res.status(404).json({ error: 'Device has no linked users' });
      return;
    }
    
    const commandCandidates = [];
    const now = Date.now();
    const COMMAND_PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;
    
    for (const userId of userIds) {
      const commandsRef = realtimeDb.ref(`users/${userId}/commands`);
      
      // Comandos pending
      const pendingSnapshot = await commandsRef
        .orderByChild('status')
        .equalTo('pending')
        .once('value');
      
      if (pendingSnapshot.exists()) {
        const pendingCommands = pendingSnapshot.val() || {};
        Object.entries(pendingCommands).forEach(([commandId, command]) => {
          commandCandidates.push({ userId, commandId, command: command || {} });
        });
      }
      
      // Comandos processing trabados
      const processingSnapshot = await commandsRef
        .orderByChild('status')
        .equalTo('processing')
        .once('value');
      
      if (processingSnapshot.exists()) {
        const processingCommands = processingSnapshot.val() || {};
        Object.entries(processingCommands).forEach(([commandId, command]) => {
          const processedAt = Number(command?.processedAt || 0);
          const stale = !processedAt || (now - processedAt) > COMMAND_PROCESSING_TIMEOUT_MS;
          if (stale) {
            commandCandidates.push({
              userId,
              commandId,
              command: { ...(command || {}), staleProcessing: true }
            });
          }
        });
      }
    }
    
    if (commandCandidates.length === 0) {
      res.json({ command: null });
      return;
    }
    
    // Priorizar emergency_stop
    const emergencyCandidates = commandCandidates.filter(
      (entry) => entry.command?.product === 'emergency_stop'
    );
    
    let selectedEntry = null;
    if (emergencyCandidates.length > 0) {
      selectedEntry = emergencyCandidates[0];
    } else if (!isDosingInProgress) {
      selectedEntry = commandCandidates[0];
    }
    
    if (!selectedEntry) {
      res.json({ command: null });
      return;
    }
    
    const { userId, commandId, command } = selectedEntry;
    const selectedCommandRef = realtimeDb.ref(`users/${userId}/commands/${commandId}`);
    const nowTs = Date.now();
    
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
    
    console.log(`📤 [ESP32] Comando enviado: ${command.product}, ${command.duration || 0}s`);
    
    res.json({
      commandId: commandId,
      userId,
      product: command.product,
      duration: command.duration || 0
    });
    
  } catch (error) {
    console.error('❌ [ESP32] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * ESP32: Confirma comando completado (HTTP POST)
 */
exports.esp32_confirmCommand = onRequest({ invoker: 'public' }, async (req, res) => {
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
    
    await realtimeDb.ref(`users/${commandUserId}/commands/${commandId}`).update({
      status: status,
      completedAt: nowTs
    });
    
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
    
    console.log(`✅ [ESP32] Comando ${commandId} confirmado: ${status}`);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ [ESP32] Error:', error);
    res.status(500).json({ error: error.message });
  }
});


/**
 * Función trigger que sincroniza datos de /sharedSensorData a /users
 * Se ejecuta automáticamente cuando el ESP32 escribe en /sharedSensorData
 */
exports.syncSharedSensorData = onValueWritten(
  "/sharedSensorData/{deviceId}",
  async (event) => {
    const deviceId = event.params.deviceId;
    const sensorData = event.data.after.val();
    
    if (!sensorData) {
      console.log(`[SYNC] Datos eliminados para ${deviceId}`);
      return null;
    }
    
    console.log(`[SYNC] Sincronizando datos de ${deviceId}`);
    
    // Buscar usuarios vinculados a este dispositivo
    const firestore = admin.firestore();
    const realtimeDb = admin.database();
    
    const deviceDoc = await firestore.collection('devices').doc(deviceId).get();
    let userIds = [];
    
    if (deviceDoc.exists) {
      const deviceData = deviceDoc.data();
      if (Array.isArray(deviceData.userIds)) {
        userIds = deviceData.userIds;
      } else if (deviceData.userId) {
        userIds = [deviceData.userId];
      }
    }
    
    // También buscar en users collection
    const linkedUsersSnapshot = await firestore
      .collection('users')
      .where('linkedDeviceIds', 'array-contains', deviceId)
      .get();
    
    linkedUsersSnapshot.forEach((userDoc) => {
      if (userDoc.id && !userIds.includes(userDoc.id)) {
        userIds.push(userDoc.id);
      }
    });
    
    if (userIds.length === 0) {
      console.log(`[SYNC] No hay usuarios vinculados a ${deviceId}`);
      return null;
    }
    
    // Copiar datos a cada usuario
    const updates = {};
    userIds.forEach((userId) => {
      updates[`users/${userId}/sensorData`] = {
        ...sensorData,
        isRecent: true,
        timestamp: Date.now()
      };
    });
    
    await realtimeDb.ref().update(updates);
    
    console.log(`[SYNC] Datos sincronizados para ${userIds.length} usuario(s)`);
    return null;
  });
