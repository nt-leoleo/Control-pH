/**
 * Servidor Proxy HTTP → HTTPS para ESP32
 * Corre en tu PC local y reenvía peticiones a Firebase
 * 
 * USO:
 * 1. npm install express node-fetch
 * 2. node esp32-proxy-server.js
 * 3. Configura ESP32 para usar: http://192.168.100.X:3000
 */

const express = require('express');
const fetch = require('node-fetch');

const app = express();
const PORT = 3000;

const FIREBASE_BASE = 'https://us-central1-control-ph-82951.cloudfunctions.net';

app.use(express.json());
app.use(express.text());

// Proxy para todas las rutas
app.all('*', async (req, res) => {
  try {
    const targetUrl = FIREBASE_BASE + req.path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
    
    console.log(`[PROXY] ${req.method} ${targetUrl}`);
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    
    const data = await response.text();
    
    console.log(`[PROXY] Response: ${response.status}`);
    
    res.status(response.status).send(data);
    
  } catch (error) {
    console.error('[PROXY ERROR]', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  ESP32 → Firebase Proxy Server                             ║
║  Escuchando en: http://0.0.0.0:${PORT}                        ║
║                                                            ║
║  Configura tu ESP32 para usar:                            ║
║  http://TU_IP_LOCAL:${PORT}                                  ║
║                                                            ║
║  Ejemplo: http://192.168.100.134:${PORT}                     ║
╚════════════════════════════════════════════════════════════╝
  `);
});
