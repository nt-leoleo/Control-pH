# 🔥 Firebase Deployment Scripts & Tools

## 📋 Scripts Disponibles

Aquí están todos los scripts para manejar el deploy a Firebase de forma automática.

### 🚀 **deploy-firebase.bat** - MAIN SCRIPT
**Descripción:** Deploy COMPLETO y automático a Firebase
- ✅ Verifica Firebase CLI (instala si falta)
- ✅ Verifica autenticación (login si es necesario)
- ✅ Compila web (`npm run build`)
- ✅ Inicializa Firestore (`setup-app-versions.js`)
- ✅ Deploy reglas (`firestore:rules`)
- ✅ Deploy hosting (publica web)
- ✅ Deploy functions (si existen)

**Ejecución:**
```bash
deploy-firebase.bat
```
Doble-click desde explorador o terminal.

---

### 🔷 **deploy-firebase.ps1** - PowerShell Version
**Descripción:** Versión PowerShell del deploy script
- Mejor mensaje y errores detallados
- Recomendado para usuarios avanzados

**Requisitos:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Ejecución:**
```powershell
.\deploy-firebase.ps1
```

---

### 🔍 **check-firebase-status.bat**
**Descripción:** Verifica estado actual del deploy
- Lista proyectos Firebase activos
- Ve hosting sites deployados
- Links a console

**Ejecución:**
```bash
check-firebase-status.bat
```

**Útil para:** Debug, verificar que app esté viva

---

### 🌐 **open-firebase-console.bat**
**Descripción:** Abre Firebase Console en navegador
- Abre automáticamente:
  - Firestore Database
  - Hosting
  - Storage

**Ejecución:**
```bash
open-firebase-console.bat
```

**Útil para:** Verificar datos, crear documentos manualmente

---

### 📝 **INIT_FIRESTORE_MANUAL.bat**
**Descripción:** Guía para inicializar Firestore manual
- Paso-a-paso para crear estructura en Console
- Links automáticos
- Si `setup-app-versions.js` falla

**Ejecución:**
```bash
INIT_FIRESTORE_MANUAL.bat
```

**Útil para:** Troubleshooting, crear estructura manualmente

---

### 📚 **DEPLOY_FIREBASE_WINDOWS.md**
**Descripción:** Documentación completa del deploy
- Pre-requisitos
- Autenticación
- Troubleshooting
- Verificación

**Ver:** Abre en VS Code o navegador

---

## 🎯 Flujo Recomendado

### Primera vez:
```
1. deploy-firebase.bat          ← Hace TODO automático
2. open-firebase-console.bat    ← Verifica en console
3. LISTO ✅
```

### Cambios posteriores:
```
1. Edita código en src/
2. Actualiza versión en UpdatingService.js
3. npm run build                ← O deploy-firebase.bat entero
4. Verifica en console
```

### Troubleshooting:
```
1. check-firebase-status.bat
2. INIT_FIRESTORE_MANUAL.bat    ← Si Firestore falta estructura
3. open-firebase-console.bat    ← Verifica manualmente
```

---

## 🔑 Archivos .bat Disponibles

| Script | Función | Cuándo usar |
|--------|---------|-----------|
| `deploy-firebase.bat` | Deploy completo | Primera vez, después de cambios |
| `check-firebase-status.bat` | Ver estado | Verificar que todo esté OK |
| `open-firebase-console.bat` | Abrir Console | Editar datos, verificar |
| `INIT_FIRESTORE_MANUAL.bat` | Guía manual | Si setup falla |

---

## 📱 Estructura Firestore (después de deploy)

```
📦 control-ph-82951
│
├─ 🗂️️  app-versions/
│   ├─ 📄 latest
│   │   ├─ version: "5.0.0"
│   │   ├─ url: "URL_DEL_APK"
│   │   ├─ changelog: "..."
│   │   └─ mandatory: true
│   └─ 📄 v5.0.0
│       └─ [histórico]
│
├─ 🗂️️  app-config/
│   └─ 📄 settings
│       ├─ updateCheckInterval: 3600
│       ├─ forceUpdateVersion: "4.0.0"
│       └─ maintenanceMode: false
│
├─ 🗂️️  update-logs/
│   └─ [llenado automáticamente con descargas]
│
└─ 🗂️️  devices/ [EXISTENTE]
   └─ [Ya tienes estructura]
```

---

## 🚀 Después del Deploy

### App web se publica en:
```
https://control-ph-82951.web.app
https://control-ph-82951.firebaseapp.com
```

### Los usuarios Android verán:
```
✅ Notificación: "Actualización disponible v5.0.0"
✅ Descargan automáticamente
✅ Se instala en background
✅ App se reinicia con versión nueva
```

---

## 🆘 Problemas Comunes

### ❌ "firebase no se reconoce"
```bash
npm install -g firebase-tools
```

### ❌ "Firestore no tiene app-versions"
```bash
INIT_FIRESTORE_MANUAL.bat
```
O:
```bash
node scripts/setup-app-versions.js
```

### ❌ "Hosting no se actualiza"
```bash
firebase deploy --only hosting
```

### ❌ "Permission denied en PowerShell"
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📊 Monitoreo Después del Deploy

### Ver que está vivo:
```bash
check-firebase-status.bat
```

### Ver analytics de descargas:
1. `open-firebase-console.bat`
2. Firestore → `update-logs`
3. Verifica descargas registradas

### Ver próxima versión configurada:
1. `open-firebase-console.bat`
2. Firestore → `app-versions` → `latest`
3. Verifica `version` y `url`

---

## 🔄 Ciclo de Updates

**Versión 1.0:**
1. Deploy con `deploy-firebase.bat`
2. Usuarios descargan APK

**Versión 1.1:**
1. Edita código, aumenta versión en UpdatingService.js
2. Compila APK nuevo
3. Upload a URL (Firebase Storage, GitHub, etc.)
4. Actualiza `app-versions/latest` en Firestore (version + url)
5. Automático: Todos los usuarios ven notificación y descargan

**Sin recompilaciones:** Cambios web se parten automáticamente (Vite HMR en dev)

---

## 📞 Variables de Proyecto

| Variable | Valor |
|----------|-------|
| Firebase Project ID | `control-ph-82951` |
| App Name | Control pH |
| Framework | React 19 + Vite |
| OTA System | CapGo Capacitor Updater |
| Database | Firestore + Realtime DB |
| Hosting | Firebase Hosting |

---

## 💾 Respaldo Configuration

Antes de cambios mayores:
```bash
firebase dest-firebase.js > backup-rules.json
firebase firestore:indexes > backup-indexes.json
```

---

**Creado:** 2024  
**Última actualización:** 2024  
**Estado:** ✅ Producción Ready  
**Soporte:** Firebase Console + Documentación completa
