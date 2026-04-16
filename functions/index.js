/**
 * Firebase Cloud Functions para Control de Pileta pH
 * Sistema autónomo 24/7 que monitorea y dosifica automáticamente
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();

// Configuración de ThingSpeak
const THINGSPEAK_CHANNEL_ID = '3249157';
const THINGSPEAK_READ_API_KEY = 'S7Q7FWREGP96KX04';
const THINGSPEAK_WRITE_API_KEY = 'GQXD1DTF1D6DPUSG';

// Límites de seguridad
const MIN_SAFE_PH = 6.0;
const MAX_SAFE_PH = 8.5;
const MIN_WAIT_BETWEEN_DOSING = 30 * 60 * 1000; // 30 minutos
const MAX_DOSING_PER_DAY = 20;

/**
 * Función que se ejecuta cada 1 minuto para verificar y dosificar
 * Configurada con Cloud Scheduler
 */
exports.checkAndDoseAutomatically = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    console.log('🔍 Iniciando verificación automática...');
    
    try {
      // 1. Obtener todos los usuarios con modo automático activado
      const usersSnapshot = await admin.database()
        .ref('users')
        .orderByChild('config/dosingMode')
        .equalTo('automatic')
        .once('value');
      
      if (!usersSnapshot.exists()) {
        console.log('ℹ️ No hay usuarios con modo automático activado');
        return null;
      }
      
      const users = usersSnapshot.val();
      const userIds = Object.keys(users);
      
      console.log(`📊 Verificando ${userIds.length} usuario(s) con modo automático`);
      
      // 2. Procesar cada usuario
      for (const userId of userIds) {
        await processUser(userId, users[userId]);
      }
      
      console.log('✅ Verificación completada');
      return null;
      
    } catch (error) {
      console.error('❌ Error en verificación automática:', error);
      return null;
    }
  });

/**
 * Procesa un usuario individual
 */
async function processUser(userId, userData) {
  try {
    console.log(`\n👤 Procesando usuario: ${userId}`);
    
    const config = userData.config || {};
    const dosingState = userData.dosingState || {};
    
    // Validar configuración
    if (!config.phTolerance || !config.phToleranceRange) {
      console.log('⚠️ Usuario sin configuración completa');
      return;
    }
    
    const targetPH = config.phTolerance;
    const tolerance = config.phToleranceRange;
    
    console.log(`📊 Config: pH objetivo ${targetPH} ±${tolerance}`);
    
    // 1. Leer pH actual de ThingSpeak
    const currentPH = await readPHFromThingSpeak();
    if (!currentPH) {
      console.log('❌ No se pudo leer pH de ThingSpeak');
      return;
    }
    
    console.log(`🧪 pH actual: ${currentPH}`);
    
    // 2. Verificar si necesita dosificar
    const deviation = currentPH - targetPH;
    const needsDosing = Math.abs(deviation) > tolerance;
    
    if (!needsDosing) {
      console.log(`✅ pH en rango (${targetPH - tolerance} - ${targetPH + tolerance})`);
      return;
    }
    
    console.log(`⚠️ pH fuera de rango! Desviación: ${deviation.toFixed(2)}`);
    
    // 3. Verificar límites de seguridad
    if (currentPH < MIN_SAFE_PH || currentPH > MAX_SAFE_PH) {
      console.log(`❌ pH fuera de rango seguro (${MIN_SAFE_PH} - ${MAX_SAFE_PH})`);
      await logEvent(userId, 'error', `pH fuera de rango seguro: ${currentPH}`);
      return;
    }
    
    // 4. Verificar tiempo de espera
    const lastDosingTime = dosingState.lastDosingTime || 0;
    const timeSinceLastDosing = Date.now() - lastDosingTime;
    
    if (timeSinceLastDosing < MIN_WAIT_BETWEEN_DOSING) {
      const remainingMinutes = Math.ceil((MIN_WAIT_BETWEEN_DOSING - timeSinceLastDosing) / 60000);
      console.log(`⏱️ Esperando ${remainingMinutes} minutos antes de dosificar`);
      return;
    }
    
    // 5. Verificar límite diario
    const today = new Date().toDateString();
    const dosingCountToday = (dosingState.lastDosingDate === today) 
      ? (dosingState.dosingCountToday || 0) 
      : 0;
    
    if (dosingCountToday >= MAX_DOSING_PER_DAY) {
      console.log(`❌ Límite diario alcanzado: ${dosingCountToday}/${MAX_DOSING_PER_DAY}`);
      return;
    }
    
    // 6. Ejecutar dosificación
    const product = deviation > 0 ? 'ph_minus' : 'ph_plus';
    const duration = 5; // 5 segundos
    
    console.log(`💊 Dosificando: ${product} por ${duration}s`);
    
    const success = await sendDosingCommand(product, duration);
    
    if (success) {
      // Actualizar estado
      await admin.database().ref(`users/${userId}/dosingState`).update({
        lastDosingTime: Date.now(),
        lastDosingDate: today,
        dosingCountToday: dosingCountToday + 1,
        lastProduct: product,
        lastDuration: duration,
        lastPH: currentPH,
        lastDeviation: deviation
      });
      
      // Registrar en historial
      await logDosingEvent(userId, {
        timestamp: Date.now(),
        product: product,
        duration: duration,
        phBefore: currentPH,
        phTarget: targetPH,
        deviation: deviation,
        mode: 'automatic',
        source: 'cloud-function'
      });
      
      console.log('✅ Dosificación completada y registrada');
    } else {
      console.log('❌ Error al enviar comando de dosificación');
    }
    
  } catch (error) {
    console.error(`❌ Error procesando usuario ${userId}:`, error);
  }
}

/**
 * Lee el pH actual desde ThingSpeak
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
    
    if (isNaN(ph) || ph < 0 || ph > 14) {
      return null;
    }
    
    // Verificar que los datos sean recientes (últimos 5 minutos)
    const dataTime = new Date(data.created_at).getTime();
    const now = Date.now();
    const dataAge = now - dataTime;
    
    if (dataAge > 5 * 60 * 1000) {
      console.log(`⚠️ Datos obsoletos (${Math.round(dataAge/60000)} minutos)`);
      return null;
    }
    
    return ph;
    
  } catch (error) {
    console.error('Error leyendo ThingSpeak:', error);
    return null;
  }
}

/**
 * Envía comando de dosificación al ESP32 vía ThingSpeak
 */
async function sendDosingCommand(product, duration) {
  try {
    const productCode = product === 'ph_plus' ? '1' : '2';
    
    // Leer contador actual
    const currentCountUrl = `https://api.thingspeak.com/channels/${THINGSPEAK_CHANNEL_ID}/fields/7/last.txt`;
    const countResponse = await fetch(currentCountUrl);
    let currentCount = 0;
    
    if (countResponse.ok) {
      const countText = await countResponse.text();
      currentCount = parseInt(countText) || 0;
    }
    
    const newCount = currentCount + 1;
    
    // Enviar comando
    const commandUrl = `https://api.thingspeak.com/update?api_key=${THINGSPEAK_WRITE_API_KEY}&field5=${productCode}&field6=${duration}&field7=${newCount}`;
    
    const response = await fetch(commandUrl);
    const entryId = await response.text();
    
    if (entryId !== '0') {
      console.log(`✅ Comando enviado (Entry ID: ${entryId})`);
      return true;
    } else {
      console.log('❌ ThingSpeak rechazó el comando (rate limit)');
      return false;
    }
    
  } catch (error) {
    console.error('Error enviando comando:', error);
    return false;
  }
}

/**
 * Registra evento de dosificación en el historial
 */
async function logDosingEvent(userId, event) {
  try {
    const historyRef = admin.database().ref(`users/${userId}/dosingHistory`);
    await historyRef.push(event);
  } catch (error) {
    console.error('Error registrando evento:', error);
  }
}

/**
 * Registra evento general (errores, alertas, etc.)
 */
async function logEvent(userId, type, message) {
  try {
    const eventsRef = admin.database().ref(`users/${userId}/events`);
    await eventsRef.push({
      timestamp: Date.now(),
      type: type,
      message: message
    });
  } catch (error) {
    console.error('Error registrando evento:', error);
  }
}

/**
 * Recibe datos del sensor desde ESP32
 * URL: https://us-central1-control-ph-82951.cloudfunctions.net/receiveSensorData
 * POST JSON: { deviceId, ph, voltage, wifiRSSI, uptime, offline }
 */
exports.receiveSensorData = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    const { deviceId, ph, voltage, wifiRSSI, uptime, offline } = req.body;
    
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId required' });
      return;
    }
    
    console.log(`📡 [SENSOR] Datos recibidos - Device: ${deviceId}, pH: ${ph}, Voltage: ${voltage}V`);
    
    // Enviar a ThingSpeak
    if (ph !== undefined && voltage !== undefined) {
      const thingspeakUrl = `https://api.thingspeak.com/update?api_key=${THINGSPEAK_WRITE_API_KEY}&field1=${ph}&field2=${voltage}&field3=${wifiRSSI || 0}&field4=${uptime || 0}`;
      
      try {
        await fetch(thingspeakUrl);
        console.log('✅ Datos enviados a ThingSpeak');
      } catch (error) {
        console.warn('⚠️ Error enviando a ThingSpeak:', error.message);
      }
    }
    
    // Almacenar última medición en Realtime DB
    await admin.database().ref(`devices/${deviceId}/lastSensorData`).set({
      timestamp: Date.now(),
      ph: ph,
      voltage: voltage,
      wifiRSSI: wifiRSSI,
      uptime: uptime,
      offline: offline || false
    });
    
    res.json({ 
      success: true, 
      message: 'Datos recibidos correctamente',
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error en receiveSensorData:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Obtiene comandos pendientes para ESP32
 * URL: https://us-central1-control-ph-82951.cloudfunctions.net/getCommand?deviceId=XXX
 */
exports.getCommand = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    const deviceId = req.query.deviceId;
    
    if (!deviceId) {
      res.status(400).json({ error: 'deviceId required' });
      return;
    }
    
    console.log(`🔍 [COMMAND] ESP32 verificando comandos - Device: ${deviceId}`);
    
    // Buscar comandos pendientes
    const commandsRef = admin.database().ref(`devices/${deviceId}/commands`);
    const snapshot = await commandsRef.orderByChild('status').equalTo('pending').limitToFirst(1).once('value');
    
    if (snapshot.exists()) {
      const commands = snapshot.val();
      const commandId = Object.keys(commands)[0];
      const command = commands[commandId];
      
      console.log(`📝 [COMMAND] Comando encontrado: ${command.product} (${command.duration}s)`);
      
      // Marcar como enviado
      await commandsRef.child(commandId).update({ 
        status: 'sent',
        sentAt: Date.now()
      });
      
      res.json({
        success: true,
        command: {
          id: commandId,
          product: command.product,
          duration: command.duration,
          source: command.source || 'cloud'
        }
      });
    } else {
      // Sin comandos pendientes
      res.json({
        success: true,
        command: null
      });
    }
    
  } catch (error) {
    console.error('❌ Error en getCommand:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Confirma la ejecución de un comando desde ESP32
 * URL: https://us-central1-control-ph-82951.cloudfunctions.net/confirmCommand
 * POST JSON: { commandId, deviceId, userId, status }
 */
exports.confirmCommand = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    const { commandId, deviceId, userId, status } = req.body;
    
    if (!commandId || !deviceId || !status) {
      res.status(400).json({ error: 'commandId, deviceId, and status required' });
      return;
    }
    
    console.log(`✅ [CONFIRM] Comando ${commandId} - Status: ${status} - Device: ${deviceId}`);
    
    // Actualizar estado del comando
    const commandRef = admin.database().ref(`devices/${deviceId}/commands/${commandId}`);
    await commandRef.update({
      status: status,
      completedAt: Date.now()
    });
    
    // Si hay userId, registrar en historial del usuario
    if (userId) {
      await logDosingEvent(userId, {
        timestamp: Date.now(),
        commandId: commandId,
        deviceId: deviceId,
        status: status,
        source: 'esp32-confirmation'
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Confirmación recibida',
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('❌ Error en confirmCommand:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Función HTTP para verificar estado del sistema
 * URL: https://us-central1-control-ph-82951.cloudfunctions.net/getSystemStatus
 */
exports.getSystemStatus = functions.https.onRequest(async (req, res) => {
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
 * URL: https://us-central1-control-ph-82951.cloudfunctions.net/forceCheck
 */
exports.forceCheck = functions.https.onRequest(async (req, res) => {
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
    
    const userSnapshot = await admin.database()
      .ref(`users/${userId}`)
      .once('value');
    
    if (!userSnapshot.exists()) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    await processUser(userId, userSnapshot.val());
    
    res.json({ 
      success: true, 
      message: 'Verificación forzada completada',
      timestamp: Date.now()
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const getAdminAllowlist = () => {
  const fromEnv = (process.env.ADMIN_ACCESS_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  const fromRuntime = ((((functions.config() || {}).admin || {}).emails) || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([...fromEnv, ...fromRuntime]));
};

const verifyAdminRequest = async (req) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('AUTH_MISSING');
  }

  const idToken = authHeader.slice(7);
  const decoded = await admin.auth().verifyIdToken(idToken);
  const requesterEmail = (decoded.email || '').toLowerCase();
  const allowlist = getAdminAllowlist();
  const isAllowedByEmail = allowlist.includes(requesterEmail);
  const isAllowedByClaim = decoded.admin === true;

  if (!isAllowedByEmail && !isAllowedByClaim) {
    throw new Error('ADMIN_REQUIRED');
  }

  return decoded;
};

const detachDevicesFromUser = async (targetUserId) => {
  const db = admin.firestore();
  const [legacyDevicesSnapshot, linkedDevicesSnapshot] = await Promise.all([
    db.collection('devices').where('userId', '==', targetUserId).get(),
    db.collection('devices').where('userIds', 'array-contains', targetUserId).get()
  ]);

  const devicesMap = new Map();
  legacyDevicesSnapshot.forEach((deviceDoc) => devicesMap.set(deviceDoc.id, deviceDoc));
  linkedDevicesSnapshot.forEach((deviceDoc) => devicesMap.set(deviceDoc.id, deviceDoc));

  const tasks = [];
  devicesMap.forEach((deviceDoc) => {
    const data = deviceDoc.data() || {};
    const linkedUserIds = Array.isArray(data.userIds) ? data.userIds : [];

    if (linkedUserIds.length > 1) {
      const remaining = linkedUserIds.filter((id) => id !== targetUserId);
      const updatePayload = {
        userIds: admin.firestore.FieldValue.arrayRemove(targetUserId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (data.userId === targetUserId && remaining.length > 0) {
        updatePayload.userId = remaining[0];
      }

      tasks.push(deviceDoc.ref.update(updatePayload));
      return;
    }

    tasks.push(deviceDoc.ref.delete());
  });

  await Promise.all(tasks);
};

exports.deleteUserCompletely = functions.https.onRequest(async (req, res) => {
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
    const requester = await verifyAdminRequest(req);
    const targetUserId = req.body.targetUserId;

    if (!targetUserId || typeof targetUserId !== 'string') {
      res.status(400).json({ error: 'targetUserId required' });
      return;
    }

    if (targetUserId === requester.uid) {
      res.status(400).json({ error: 'No puedes eliminar tu propia cuenta desde este endpoint' });
      return;
    }

    await detachDevicesFromUser(targetUserId);
    await admin.database().ref(`users/${targetUserId}`).remove();
    await admin.firestore().doc(`users/${targetUserId}`).delete();

    try {
      await admin.auth().deleteUser(targetUserId);
    } catch (authError) {
      if (authError.code !== 'auth/user-not-found') {
        throw authError;
      }
    }

    res.json({
      success: true,
      message: 'Usuario eliminado completamente',
      targetUserId
    });
  } catch (error) {
    if (error.message === 'AUTH_MISSING') {
      res.status(401).json({ error: 'Authorization header missing' });
      return;
    }
    if (error.message === 'ADMIN_REQUIRED') {
      res.status(403).json({ error: 'Admin privileges required' });
      return;
    }

    console.error('Error en deleteUserCompletely:', error);
    res.status(500).json({ error: error.message || 'Unexpected error' });
  }
});

/**
 * Función que escucha cambios en sharedSensorData y los copia a cada usuario
 * Se activa automáticamente cuando el ESP32 escribe datos
 * Version: 1.0
 */
exports.propagateSensorData = functions.database
  .ref('/sharedSensorData/{deviceId}')
  .onWrite(async (change, context) => {
    const deviceId = context.params.deviceId;
    const sensorData = change.after.val();
    
    if (!sensorData) {
      console.log(`📡 [SENSOR] Datos eliminados para device ${deviceId}`);
      return null;
    }
    
    console.log(`📡 [SENSOR] Nuevos datos de device ${deviceId}: pH ${sensorData.ph}`);
    
    try {
      // Buscar todos los usuarios que tienen este dispositivo vinculado
      const devicesSnapshot = await admin.firestore()
        .collection('devices')
        .where('deviceId', '==', deviceId)
        .get();
      
      if (devicesSnapshot.empty) {
        console.log(`⚠️ [SENSOR] No hay usuarios vinculados al device ${deviceId}`);
        // Aún así, guardar en una ubicación por defecto para que la app pueda leerlo
        await admin.database().ref(`users/sensorData`).set(sensorData);
        return null;
      }
      
      // Copiar datos a cada usuario vinculado
      const updates = {};
      devicesSnapshot.forEach(doc => {
        const deviceData = doc.data();
        const userIds = deviceData.userIds || [deviceData.userId];
        
        userIds.forEach(userId => {
          if (userId) {
            updates[`users/${userId}/sensorData`] = sensorData;
            console.log(`✅ [SENSOR] Copiando datos a usuario ${userId}`);
          }
        });
      });
      
      // Aplicar todas las actualizaciones de una vez
      await admin.database().ref().update(updates);
      
      console.log(`✅ [SENSOR] Datos propagados a ${Object.keys(updates).length} ubicaciones`);
      return null;
      
    } catch (error) {
      console.error(`❌ [SENSOR] Error propagando datos:`, error);
      return null;
    }
  });
