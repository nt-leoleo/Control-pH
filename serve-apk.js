#!/usr/bin/env node

/**
 * Servidor HTTP simple para servir APK con descarga
 * Ejecutar: node serve-apk.js
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APK_PATH = path.join(__dirname, '..', 'app-release-v5.1.7.apk');
const PORT = process.env.PORT || 3000;

if (!fs.existsSync(APK_PATH)) {
  console.error(`❌ APK no encontrado en: ${APK_PATH}`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (req.url === '/apk/app-release-v5.1.7.apk' || req.url === '/' || req.url === '/apk') {
    const stats = fs.statSync(APK_PATH);
    const fileSize = stats.size;
    
    // Manejar Range requests para descargas resumibles
    const range = req.headers.range;
    
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const file = fs.createReadStream(APK_PATH, { start: start, end: end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="app-release-v5.1.7.apk"',
        'Cache-Control': 'public, max-age=3600'
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="app-release-v5.1.7.apk"',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });
      fs.createReadStream(APK_PATH).pipe(res);
    }
  } else if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Use /apk or /apk/app-release-v5.1.7.apk' }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 Servidor APK ejecutándose en:
  http://localhost:${PORT}/apk/app-release-v5.1.7.apk
  
📱 URL pública (si está expuesto):
  http://<tu-ip-publica>:${PORT}/apk/app-release-v5.1.7.apk
  
📋 Usar esta URL en Firestore: apkUrl
  
💾 Archivo: ${APK_PATH}
  Tamaño: ${(fs.statSync(APK_PATH).size / 1024 / 1024).toFixed(2)} MB
  
⚠️  Presiona Ctrl+C para detener el servidor
  `);
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});
