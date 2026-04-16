/**
 * Proxy HTTP simple para ESP32
 * Recibe peticiones y las reenvía a otros endpoints
 */

const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");

/**
 * Proxy simple que reenvía peticiones
 * URL: https://us-central1-control-ph-82951.cloudfunctions.net/proxyESP32
 */
exports.proxyESP32 = onRequest({ invoker: 'public' }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST, GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }
  
  try {
    // Simplemente reenviar al endpoint real
    const targetFunction = req.query.target || 'receiveSensorData';
    
    logger.info(`Proxy request to: ${targetFunction}`);
    
    // Importar la función objetivo dinámicamente
    const functions = require('./index');
    
    // Reenviar la petición
    if (targetFunction === 'receiveSensorData' && functions.receiveSensorData) {
      return functions.receiveSensorData(req, res);
    } else if (targetFunction === 'getCommand' && functions.getCommand) {
      return functions.getCommand(req, res);
    } else if (targetFunction === 'confirmCommand' && functions.confirmCommand) {
      return functions.confirmCommand(req, res);
    }
    
    res.status(404).json({ error: 'Function not found' });
    
  } catch (error) {
    logger.error('Proxy error:', error);
    res.status(500).json({ error: error.message });
  }
});
