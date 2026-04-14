# 🚀 Sistema de Actualizaciones OTA - Control Pileta pH

## Descripción
Sistema de actualizaciones **Over-The-Air (OTA)** que permite actualizar la app sin necesidad de recompilar el APK.

## Características
✅ Descarga automática de nuevas versiones  
✅ Notificación visual de actualización disponible  
✅ Instalación transparente para el usuario  
✅ Soporte para rollback si hay error  
✅ Sin necesidad de recompilar APK  
✅ Totalmente gratuito (Capacitor Updater)  

---

## 🎯 Cómo Funciona

### 1. **Desarrollo Local**
```bash
# Haz cambios en src/
# Compila normalmente
npm run build

# Prueba en el teléfono
npx cap run android --live-reload
```

### 2. **Publicar Actualización**
```bash
# Paso 1: Actualiza la versión en src/UpdatingService.js
# Ejemplo: "5.0.0" → "5.0.1"

# Paso 2: Recompila solo los assets web
npm run build

# Paso 3: Sube los archivos de dist/ a tu servidor
# Ver instrucciones en "Hosting Options" abajo
```

### 3. **Usuario Recibe Actualización**
- La app verifica cada hora si hay nuevas versiones
- Muestra notificación: "Actualización Disponible"
- Usuario hace clic en "Actualizar Ahora"
- Se descarga y instala automáticamente
- App se reinicia con nuevos cambios

---

## 📁 Archivos Nuevos Creados

### `src/UpdatingService.js`
Servicio que maneja toda la lógica de actualizaciones:
- `checkForUpdates()` - Verifica si hay nueva versión
- `downloadAndInstall(url)` - Descarga e instala
- `getCurrentVersion()` - Obtiene versión actual
- `rollback()` - Vuelve a versión anterior

### `src/UpdateAvailableNotification.jsx`
Componente React que muestra UI para actualizar:
- Modal bonito y responsive
- Barra de progreso de descarga
- Botones "Actualizar Ahora" y "Después"
- Soporte tema oscuro

### `src/UpdateAvailableNotification.css`
Estilos del componente de actualización

### `UPDATING_GUIDE.md` (este archivo)
Documentación completa

---

## 🌍 Opciones de Hosting

### Opción 1: Firebase Hosting (Recomendado)
**Ventajas**: Gratuito, HTTPS, CDN, integrado con tu proyecto

```bash
# 1. Instala Firebase CLI
npm install -g firebase-tools

# 2. Login
firebase login

# 3. Inicializa en tu proyecto
firebase init hosting

# 4. Copia los assets build a la carpeta de hosting
# (Por defecto public/)
cp -r dist/* public/

# 5. Deploy
firebase deploy --only hosting
```

Tu URL será: `https://tu-proyecto.firebaseapp.com/assets/bundle.zip`

### Opción 2: GitHub Releases
**Ventajas**: Super simple, versioning automático

```bash
# 1. Build la app
npm run build

# 2. Crea un ZIP con dist/
zip -r app-v5.0.1.zip dist/

# 3. Sube a GitHub Releases
# https://github.com/tu-repo/releases

# La URL será:
# https://github.com/tu-repo/releases/download/v5.0.1/app-v5.0.1.zip
```

### Opción 3: AWS S3
**Ventajas**: Escalable, bueno para múltiples versiones

```bash
# 1. Sube a S3
aws s3 cp dist/ s3://tu-bucket/app-v5.0.1/ --recursive

# 2. El URL es:
# https://tu-bucket.s3.amazonaws.com/app-v5.0.1/
```

### Opción 4: Servidor Propio
**Ventajas**: Control total

```bash
# Sube los archivos de dist/ a tu servidor
scp -r dist/* usuario@tu-servidor:/ruta/app/
```

---

## 📝 Cómo Registrar una Nueva Versión

### Firebase Firestore (Método Automático)

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Selecciona tu proyecto
3. Firestore Database
4. Crea collection: `app-versions`
5. Crea documento: `latest`
6. Contenido:
```json
{
  "version": "5.0.1",
  "url": "https://tu-app.firebase.hosting/assets/bundle-v5.0.1.zip",
  "changelog": "Mejoras en gráficos y corrección de bugs",
  "mandatory": false,
  "releaseDate": "2026-04-13"
}
```

### Actualizar `UpdatingService.js`
```javascript
// Actualiza APP_VERSION cuando lanzes nueva versión
const APP_VERSION = '5.0.1'; // ← CAMBIAR AQUÍ
```

---

## 🔄 Proceso Paso a Paso para Actualizar

```bash
# 1. Haz cambios en el código
# Ejemplo: editar src/ShowpH.jsx

# 2. Actualiza la versión
# src/UpdatingService.js: const APP_VERSION = '5.0.1'

# 3. Build
npm run build

# 4. Sube a tu hosting (elegir una opción):
firebase deploy --only hosting  # Firebase
# o
git tag v5.0.1 && git push origin v5.0.1  # GitHub Releases
# o
aws s3 cp dist/ s3://bucket/app-v5.0.1/  # AWS S3

# 5. Registra en Firestore (si no es automático)
# Dokumentación en "Firebase Firestore" arriba

# 6. ¡Listo! Usuarios de la app verán actualización en 1 hora
```

---

## 🧪 Testing de Actualizaciones

### Simular Actualización Disponible
En el navegador (DevTools):
```javascript
// Abre Console en la app web
localStorage.setItem('appVersion', '5.0.0')

// Luego recarga la página
// Capacitor Updater verificará y mostrará notificación
```

### Ver Logs
```bash
# En otra terminal, mira los logs del app
adb logcat | grep -i "capgo\|update"
```

### Probar Descarga
```javascript
// En Console:
import('./UpdatingService').then(service => {
  service.default.downloadAndInstall('https://tu-url/app.zip')
})
```

---

## ⚠️ Solución de Problemas

### Problema: "Actualización no aparece"
**Soluciones**:
1. Verifica que la versión en Firestore sea > a APP_VERSION
2. Revisa logs: `adb logcat | grep "update"`
3. Limpia localStorage: `localStorage.clear()`
4. Reinicia la app: `adb shell am force-stop com.controlpileta.ph`

### Problema: "Error descargando"
**Soluciones**:
1. Verifica que la URL es accesible: `curl <url>`
2. Chequea CORS en tu servidor
3. Verifica que el archivo zip es válido
4. Intenta con URL diferente

### Problema: "App se congela después de actualizar"
**Soluciones**:
1. Espera 2-3 minutos (se reinicia automáticamente)
2. Reinicia manual: `adb shell am start -n "com.controlpileta.ph/com.controlpileta.ph.MainActivity"`
3. Revisa logs de errores
4. En último caso, desinstala y reinstala

---

## 🔐 Seguridad

### Validación de ZIP
El servicio valida:
- ✓ Extensión .zip correcta
- ✓ Contenido no vacío
- ✓ Tamaño máximo 500MB
- ✓ Checksum (si se configura)

### HTTPS Requerido
Todas las URLs deben ser HTTPS:
```javascript
// ✅ Correcto
https://tu-app.firebase.hosting/app.zip

// ❌ No funciona
http://tu-servidor.com/app.zip
```

---

## 📊 Monitoreo

### Saber cuántos usuarios actualizaron
En Firebase Console:
```javascript
// Firestore rule para rastrear actualizaciones
db.collection('update-logs').add({
  userId: auth.uid,
  fromVersion: '5.0.0',
  toVersion: '5.0.1',
  timestamp: serverTimestamp(),
  deviceId: device.id
})
```

### Analytics
```javascript
// En UpdatingService.js, al descargar:
analytics.logEvent('app_update_started', {
  from_version: APP_VERSION,
  to_version: updateInfo.version
})
```

---

## 🎯 Best Practices

1. **Versionamiento Semántico**
   - `MAJOR.MINOR.PATCH` (5.0.1)
   - MAJOR: cambios grandes
   - MINOR: nuevas funciones
   - PATCH: bug fixes

2. **Changelog Descriptivo**
   - "Nueva: Gráficos de pH mejorados"
   - "Corregido: Error al escanear QR"
   - "Mejorado: Velocidad de sincronización"

3. **Testing Antes de Publicar**
   - Prueba en múltiples dispositivos
   - Verifica que el app ainda funciona
   - Revisa logs de errores

4. **Rollout Gradual**
   - Publica a 10% de usuarios primero
   - Luego 50%
   - Finalmente 100%
   - En caso de bugs, rollback rápido

5. **Comunicación**
   - Notifica sobre actualizaciones importantes
   - Push notifications si es crítico
   - Changelog en app

---

## 📞 Soporte

Si hay problemas con actualizaciones:

1. Revisa logs: `adb logcat | grep -i "update\|error"`
2. Consulta Firebase Console
3. Verifica URL de descarga
4. Reinicia app y teléfono
5. En último caso, desinstala y reinstala APK

---

## 🚀 Próximos Pasos

1. ✅ Instalar @capgo/capacitor-updater (ya hecho)
2. ✅ Crear UpdatingService y UI (ya hecho)  
3. ⏭️ Configurar Firestore para versiones
4. ⏭️ Elegir hosting (Firebase, GitHub, AWS, etc)
5. ⏭️ Recompilar APK con nueva versión
6. ⏭️ Realizar pruebas de actualización
7. ⏭️ Publicar primera actualización

**¡Todo listo para usar! 🎉**
