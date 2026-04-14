# 🚀 Firebase Deployment Guide (Windows)

## Overview

Tienes **dos opciones** para hacer deploy automático a Firebase:

### 📝 Opción 1: Batch Script (Más simple, recomendado)
```bash
deploy-firebase.bat
```
- Funciona en **cualquier Windows** sin requisitos adicionales
- Interfaz clara con colores
- Espera confirmación al final
- Puedes hacerle doble-click desde el explorador de archivos

### 🔷 Opción 2: PowerShell Script (Más moderno)
```powershell
.\deploy-firebase.ps1
```
- Requiere PowerShell 5.0+ (ya incluido en Windows 10+)
- Posiblemente necesites permitir scripts:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
- Mejor salida de errores y mensajes

---

## 📋 Pre-requisitos

✅ Node.js y npm instalados
✅ Firebase CLI instalado globalmente (se instala automático si falta)
```bash
npm install -g firebase-tools
```

✅ Estar en la carpeta `control-pileta/`

---

## 🔑 Autenticación Firebase

**Primera vez:**
1. Ejecuta `deploy-firebase.bat`
2. Se abrirá navegador automáticamente
3. Inicia sesión con tu cuenta Google
4. Autoriza el acceso a Firebase
5. El script continuará automáticamente

**Próximas veces:**
- Ya tendrás sesión guardada
- Solo ejecuta el script

---

## 🚀 Ejecución

### Desde Windows Explorer
1. Abre la carpeta `control-pileta`
2. Doble-click en `deploy-firebase.bat`
3. Se abrirá terminal negra
4. Sigue los prompts

### Desde Terminal (PowerShell, CMD, Terminal de Windows)
```PowerShell
.\deploy-firebase.bat
```

o con PowerShell:
```PowerShell
.\deploy-firebase.ps1
```

---

## ✅ Qué hace el script

| Paso | Acción |
|------|--------|
| 1️⃣ | Verifica que Firebase CLI esté instalado |
| 2️⃣ | Verifica autenticación (login si es necesario) |
| 3️⃣ | Ejecuta `npm run build` (compila web para distribución) |
| 4️⃣ | Ejecuta `node scripts/setup-app-versions.js` (crea estructura en Firestore) |
| 5️⃣ | Ejecuta `firebase deploy --only firestore:rules` (sube reglas de seguridad) |
| 6️⃣ | Ejecuta `firebase deploy --only hosting` (publica web) |
| 7️⃣ | Ejecuta `firebase deploy --only functions` (sube Cloud Functions si existen) |

---

## 📊 Verificación del Deploy

Después de completarse, verifica en **Firebase Console**:

```
https://console.firebase.google.com/project/control-ph-82951
```

### Firestore
1. Ve a **Firestore Database**
2. Verifica que exista la colección `app-versions`:
   ```
   app-versions/
   ├── latest        ← AQUÍ: versión actual para descargar
   └── v5.0.0        ← histórico
   ```
3. Verifica que exista `app-config/settings`

### Hosting
1. Ve a **Hosting**
2. Verifica que tu app esté desplegada:
   ```
   🟢 Deployed
   https://control-ph-82951.web.app
   ```

---

## 🔧 Solución de Problemas

### ❌ "firebase no se reconoce"
```powershell
npm install -g firebase-tools
```

### ❌ "setup-app-versions.js falló"
- Necesita `firebase-admin-key.json` en `scripts/`
- Alternativa: Crea manualmente en Firestore Console:
  - Colección: `app-versions`
  - Documento: `latest`
  - Campo `version`: `"5.0.0"`
  - Campo `url`: URL del APK

### ❌ "Permission denied"
Si ejecutas `.ps1` y da error de permisos:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### ❌ "npm run build falló"
Verifica que los archivos tienen sintaxis correcta:
```bash
npm install
npm run build
```

---

## 📱 Próximo: Compilar APK con nuevas versiones

Cuando hagas cambios y quieras una nueva versión:

1. **Actualiza versión en UpdatingService.js:**
   ```javascript
   const APP_VERSION = '5.0.1';  // Cambiar de 5.0.0 a 5.0.1
   ```

2. **Compila APK:**
   ```bash
   npm run build
   npx cap copy android
   cd android
   ./gradlew.bat assembleRelease
   ```

3. **Deploy a Firebase:**
   ```bash
   .\deploy-firebase.bat
   ```

4. **Actualiza documento en Firestore:**
   ```
   app-versions/latest
      version: "5.0.1"
      url: "[URL_DEL_NUEVO_APK]"
   ```

5. **Los usuarios recibirán actualización automáticamente**

---

## 📞 Contacto & Debug

Si algo no funciona:

1. Mira el **terminal output** completo
2. Verifica Firebase Console para errores
3. Confirma que el `.bat` se ejecuta con permisos de administrador si falla

---

**Creado:** 2024  
**Proyecto:** control-ph-82951  
**Framework:** React + Vite + Firebase  
**OTA Updates:** CapGo Capacitor Updater
