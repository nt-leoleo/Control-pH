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
