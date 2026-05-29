import http from 'node:http';
import { URL } from 'node:url';

const ESP32_HOST = process.env.ESP32_HOST || '192.168.100.134';
const ESP32_PORT = process.env.ESP32_PORT || '80';
const PORT = Number(process.env.PORT || 3000);
const TARGET_BASE = `http://${ESP32_HOST}`;

const readRequestBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const createProxyResponse = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  const targetUrl = new URL(req.url, TARGET_BASE);
  const headers = {};

  for (const [key, value] of Object.entries(req.headers)) {
    if (key === 'host') continue;
    headers[key] = value;
  }

  try {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readRequestBody(req);
    const response = await fetch(targetUrl.href, {
      method: req.method,
      headers,
      body,
      redirect: 'manual'
    });

    const responseBuffer = Buffer.from(await response.arrayBuffer());
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-cache'
    };

    if (response.headers.get('content-type')) {
      responseHeaders['Content-Type'] = response.headers.get('content-type');
    }

    res.writeHead(response.status, responseHeaders);
    res.end(responseBuffer);
  } catch (error) {
    console.error('[LOCAL ESP32 PROXY] Error forwarding request:', error.message);
    res.writeHead(500, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json'
    });
    res.end(JSON.stringify({ error: 'No se pudo conectar al ESP32', message: error.message }));
  }
};

const server = http.createServer(createProxyResponse);

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local ESP32 proxy escuchando en http://localhost:${PORT}`);
  console.log(`Reenvía peticiones a http://${ESP32_HOST}`);
  console.log('Ejecuta la app en HTTPS y usa este proxy para evitar bloqueo de contenido mixto.');
});
