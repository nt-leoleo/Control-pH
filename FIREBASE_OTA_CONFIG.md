# 🔥 Configuración de Firebase para OTA Updates

## Información del Proyecto

- **Project ID**: `control-ph-82951`
- **Region**: `us-central1`
- **URL Hosting**: `https://control-ph-82951.web.app`
- **Firestore Database**: `https://control-ph-82951.firestore.app`

---

## 📁 Estructura de Firestore

### Colección: `app-versions`
Almacena todas las versiones disponibles de la app.

#### Documento: `latest`
**Descripción**: Versión actualmente disponible que descargan todos los usuarios.

**Estructura**:
```json
{
  "version": "5.0.0",
  "url": "https://control-ph-82951.web.app/dist/",
  "changelog": "Descripción de cambios...",
  "mandatory": false,
  "isActive": true,
  "releaseDate": "2026-04-13T...",
  "minVersion": "5.0.0",
  "supportedPlatforms": ["android", "ios", "web"]
}
```

#### Documentos: `v5.0.0`, `v5.0.1`, etc.
**Descripción**: Historial de versiones.

**Estructura**:
```json
{
  "version": "5.0.0",
  "url": "https://control-ph-82951.web.app/dist/",
  "changelog": "...",
  ...
  "createdAt": "2026-04-13T...",
  "downloads": 42,
  "rolloutPercentage": 100
}
```

### Colección: `app-config`

#### Documento: `settings`
**Descripción**: Configuración global de la aplicación.

**Estructura**:
```json
{
  "updateCheckInterval": 3600000,
  "forceUpdateVersion": null,
  "maintenanceMode": false,
  "maintenanceMessage": "...",
  "analyticsEnabled": true
}
```

### Colección: `update-logs`
**Descripción**: Registra cada descarga de actualización para analytics.

**Estructura** (auto-generada cuando se descarga):
```json
{
  "userId": "auth_uid",
  "type": "UPDATE_DOWNLOADED",
  "version": "5.0.0",
  "fromVersion": "5.0.0",
  "timestamp": "2026-04-13T...",
  "platform": "android"
}
```

---

## 🔐 Firebase Rules (Firestore)

Configuradas en `firestore.rules`:

- **app-versions**: Lectura pública, escritura solo admins
- **app-config**: Lectura pública, escritura solo admins
- **update-logs**: Lectura privada (cada usuario ve sus own logs), escritura pública autenticados

---

## 🚀 Archivos de Configuración

### `firebase.json`
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### `.firebaserc`
```json
{
  "projects": {
    "default": "control-ph-82951"
  }
}
```

---

## 📝 Cómo Escribir código para actualizar versiones

### Actualizar versión en Firestore manualmente:

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Project: `control-ph-82951`
3. Firestore Database
4. `app-versions` → `latest`
5. Editar campos:
   - `version`: Cambiar a nueva versión (ej: `5.0.1`)
   - `url`: URL de descarga
   - `changelog`: Descripción de cambios
   - `releaseDate`: Fecha actual

### Mediante código (Node.js):

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

await db.collection('app-versions').doc('latest').update({
  version: '5.0.1',
  url: 'https://control-ph-82951.web.app/dist/',
  changelog: 'Mejoras de seguridad y velocidad',
  releaseDate: new Date()
});
```

---

## 📲 Cómo funciona el flujo de actualización

1. **App inicia** → `UpdatingService.init()`
2. **Lee de Firestore** → `app-versions/latest`
3. **Compara versiones** → Si remota > local
4. **Muestra notificación** → `UpdateAvailableNotification`
5. **Usuario hace clic** → "Actualizar Ahora"
6. **Descarga de Hosting** → URL en `app-versions/latest.url`
7. **Capacitor Updater** → Instala automáticamente
8. **App recarga** → Con nueva versión
9. **Log registrado** → En `update-logs` (analytics)

---

## 🚀 Cómo publicar una actualización

### Paso 1: Hacer cambios en código
```bash
# Editar src/ como necesites
```

### Paso 2: Actualizar versión
```bash
# En src/UpdatingService.js
const APP_VERSION = '5.0.1'  # ← cambiar aquí
```

### Paso 3: Compilar
```bash
npm run build
```

### Paso 4: Deploy a Firebase Hosting
```bash
firebase deploy --only hosting
```

### Paso 5: Actualizar versión en Firestore
```bash
firebase firestore:set app-versions/latest \
  --data "version=5.0.1&url=https://control-ph-82951.web.app/dist/&changelog=Más velocidad y bugs fix"
```

O editar manualmente en Firebase Console.

---

## 📊 URLs Importantes

| Recurso | URL |
|---------|-----|
| **Web App** | https://control-ph-82951.web.app |
| **Firestore Docs** | https://console.firebase.google.com/u/0/project/control-ph-82951/firestore |
| **Hosting Files** | https://console.firebase.google.com/u/0/project/control-ph-82951/hosting/files |
| **Realttime DB** | https://console.firebase.google.com/u/0/project/control-ph-82951/database |

---

## 🔧 Troubleshooting

### Problema: "No se encuentra app-versions/latest"
**Solución**: Ejecutar `node scripts/setup-app-versions.js` para crear estructura

### Problema: "No puedo escribir en Firestore desde app"
**Solución**: Verificar que `firestore.rules` está deployada: `firebase deploy --only firestore:rules`

### Problema: "La app no se actualiza"
**Solución**:
1. Verificar versión en `app-versions/latest`
2. Mantén abierto: `adb logcat | grep -i "update\|version"`
3. Limpiar localStorage: `chrome DevTools → Application → Storage → Clear All`

### Problema: "Error 404 descargando actualización"
**Solución**: Verificar que URL en `app-versions/latest.url` es correcta y accesible

---

## 🎯 Seguridad

- ✅ Solo admins pueden escribir versiones (Firestore Rules)
- ✅ HTTPS obligatorio (Firebase Hosting)
- ✅ Firebase Auth requerida para algunos logs
- ✅ Validación de versiones en cliente

---

## 📈 Monitoreo

Puedes ver:
- **Descargas**: En colección `update-logs`
- **Errores**: En console del navegador + adb logcat
- **Hosting traffic**: En Firebase Console > Hosting
- **Firestore usage**: En Firebase Console > Firestore > Usage

---

**¡Sistema de updates completamente configurado! 🚀**
