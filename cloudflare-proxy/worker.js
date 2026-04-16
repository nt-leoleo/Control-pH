/**
 * Cloudflare Worker - Proxy HTTP → HTTPS para ESP32
 * Recibe peticiones HTTP del ESP32 y las reenvía como HTTPS a Firebase
 */

const FIREBASE_FUNCTIONS_BASE = 'https://us-central1-control-ph-82951.cloudfunctions.net';
const FIREBASE_DB_BASE = 'https://control-ph-82951-default-rtdb.firebaseio.com';

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle OPTIONS
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const path = url.pathname;

    // Determinar si es para Cloud Functions o Realtime Database
    let targetUrl;
    if (path.startsWith('/db/')) {
      // Realtime Database directo
      targetUrl = FIREBASE_DB_BASE + path.replace('/db', '') + '.json';
    } else {
      // Cloud Functions
      targetUrl = FIREBASE_FUNCTIONS_BASE + path;
    }

    // Copiar query params
    url.searchParams.forEach((value, key) => {
      const targetUrlObj = new URL(targetUrl);
      targetUrlObj.searchParams.append(key, value);
      targetUrl = targetUrlObj.toString();
    });

    // Reenviar la petición
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    // Copiar respuesta
    const responseBody = await response.text();
    
    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
}
