# Proxy HTTP → HTTPS para ESP32

Este proxy permite que el ESP32 se conecte a Firebase usando HTTP en lugar de HTTPS.

## Despliegue en Cloudflare Workers (GRATIS)

1. Instala Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login en Cloudflare:
```bash
wrangler login
```

3. Despliega el worker:
```bash
cd cloudflare-proxy
wrangler deploy
```

4. Obtendrás una URL como: `https://esp32-firebase-proxy.tu-usuario.workers.dev`

5. Actualiza el ESP32 para usar esa URL (sin HTTPS, solo HTTP)

## Uso desde ESP32

En lugar de:
```cpp
https://us-central1-control-ph-82951.cloudfunctions.net/receiveSensorData
```

Usa:
```cpp
http://esp32-firebase-proxy.tu-usuario.workers.dev/receiveSensorData
```

El proxy se encarga de convertir HTTP → HTTPS automáticamente.
