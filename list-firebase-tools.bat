@echo off
REM Script para listar todos los scripts y herramientas disponibles
REM Uso: list-firebase-tools.bat

cls
echo.
echo ======================================================================
echo.
echo          HERRAMIENTAS FIREBASE DISPONIBLES
echo          Proyecto: control-ph-82951
echo.
echo ======================================================================
echo.

echo.
echo 1. SCRIPTS DE DEPLOYMENT (.BAT)
echo ════════════════════════════════════════════════════════════════════
echo.
if exist "deploy-firebase.bat" (
    echo   ✅ deploy-firebase.bat
    echo      Descripcion: Deploy COMPLETO (build + setup + rules + hosting)
    echo      Ejecutar: deploy-firebase.bat
) else (
    echo   ❌ deploy-firebase.bat (NO ENCONTRADO)
)

if exist "firebase-menu.bat" (
    echo.
    echo   ✅ firebase-menu.bat
    echo      Descripcion: Menu interactivo de opciones
    echo      Ejecutar: firebase-menu.bat
) else (
    echo.
    echo   ❌ firebase-menu.bat (NO ENCONTRADO)
)

if exist "check-firebase-status.bat" (
    echo.
    echo   ✅ check-firebase-status.bat
    echo      Descripcion: Verifica estado del deploy actual
    echo      Ejecutar: check-firebase-status.bat
) else (
    echo.
    echo   ❌ check-firebase-status.bat (NO ENCONTRADO)
)

if exist "open-firebase-console.bat" (
    echo.
    echo   ✅ open-firebase-console.bat
    echo      Descripcion: Abre Firebase Console en navegador
    echo      Ejecutar: open-firebase-console.bat
) else (
    echo.
    echo   ❌ open-firebase-console.bat (NO ENCONTRADO)
)

if exist "INIT_FIRESTORE_MANUAL.bat" (
    echo.
    echo   ✅ INIT_FIRESTORE_MANUAL.bat
    echo      Descripcion: Guia para crear Firestore manualmente
    echo      Ejecutar: INIT_FIRESTORE_MANUAL.bat
) else (
    echo.
    echo   ❌ INIT_FIRESTORE_MANUAL.bat (NO ENCONTRADO)
)

if exist "backup-firebase-config.bat" (
    echo.
    echo   ✅ backup-firebase-config.bat
    echo      Descripcion: Respaldo de configuracion actual
    echo      Ejecutar: backup-firebase-config.bat
) else (
    echo.
    echo   ❌ backup-firebase-config.bat (NO ENCONTRADO)
)

echo.
echo.
echo 2. SCRIPTS POWERSHELL (.PS1)
echo ════════════════════════════════════════════════════════════════════
echo.
if exist "deploy-firebase.ps1" (
    echo   ✅ deploy-firebase.ps1
    echo      Descripcion: Deploy completo (version PowerShell)
    echo      Ejecutar: .\deploy-firebase.ps1
) else (
    echo   ❌ deploy-firebase.ps1 (NO ENCONTRADO)
)

echo.
echo.
echo 3. ARCHIVOS DE CONFIGURACION
echo ════════════════════════════════════════════════════════════════════
echo.
if exist "firebase.json" (
    echo   ✅ firebase.json (EXISTÍA)
    echo      Descripcion: Configuracion de hosting y deployments
) else (
    echo   ❌ firebase.json (NO ENCONTRADO)
)

if exist ".firebaserc" (
    echo.
    echo   ✅ .firebaserc (EXISTÍA)
    echo      Descripcion: Project ID y aliases
) else (
    echo.
    echo   ❌ .firebaserc (NO ENCONTRADO)
)

if exist "firestore.rules" (
    echo.
    echo   ✅ firestore.rules (ACTUALIZADO)
    echo      Descripcion: Reglas de seguridad Firestore
    echo      Cambios: Agregadas colecciones app-versions, app-config, update-logs
) else (
    echo.
    echo   ❌ firestore.rules (NO ENCONTRADO)
)

if exist "database.rules.json" (
    echo.
    echo   ✅ database.rules.json (EXISTÍA)
    echo      Descripcion: Reglas de Realtime Database
) else (
    echo.
    echo   ❌ database.rules.json (NO ENCONTRADO)
)

echo.
echo.
echo 4. DOCUMENTACION
echo ════════════════════════════════════════════════════════════════════
echo.
if exist "QUICK_START_FIREBASE.md" (
    echo   ✅ QUICK_START_FIREBASE.md (NUEVO)
    echo      Descripcion: Inicio rapido - LEER PRIMERO
) else (
    echo   ❌ QUICK_START_FIREBASE.md (NO ENCONTRADO)
)

if exist "DEPLOY_FIREBASE_WINDOWS.md" (
    echo.
    echo   ✅ DEPLOY_FIREBASE_WINDOWS.md (NUEVO)
    echo      Descripcion: Guia completa para Windows
) else (
    echo.
    echo   ❌ DEPLOY_FIREBASE_WINDOWS.md (NO ENCONTRADO)
)

if exist "FIREBASE_SCRIPTS_README.md" (
    echo.
    echo   ✅ FIREBASE_SCRIPTS_README.md (NUEVO)
    echo      Descripcion: Referencia de todos los scripts
) else (
    echo.
    echo   ❌ FIREBASE_SCRIPTS_README.md (NO ENCONTRADO)
)

if exist "FIREBASE_OTA_CONFIG.md" (
    echo.
    echo   ✅ FIREBASE_OTA_CONFIG.md (EXISTÍA)
    echo      Descripcion: Estructura completa de Firestore
) else (
    echo.
    echo   ❌ FIREBASE_OTA_CONFIG.md (NO ENCONTRADO)
)

if exist "UPDATING_GUIDE.md" (
    echo.
    echo   ✅ UPDATING_GUIDE.md (EXISTÍA)
    echo      Descripcion: Guia completa de actualización
) else (
    echo.
    echo   ❌ UPDATING_GUIDE.md (NO ENCONTRADO)
)

echo.
echo.
echo 5. SCRIPTS JAVASCRIPT
echo ════════════════════════════════════════════════════════════════════
echo.
if exist "scripts\setup-app-versions.js" (
    echo   ✅ scripts\setup-app-versions.js (EXISTÍA)
    echo      Descripcion: Inicializa estructura Firestore
) else (
    echo   ❌ scripts\setup-app-versions.js (NO ENCONTRADO)
)

echo.
echo.
echo 6. COMPONENTES REACT ACTUALIZADOS
echo ════════════════════════════════════════════════════════════════════
echo.
if exist "src\UpdatingService.js" (
    echo   ✅ src\UpdatingService.js (ACTUALIZADO)
    echo      Cambios: Integrado Firebase Firestore para versiones
) else (
    echo   ❌ src\UpdatingService.js (NO ENCONTRADO)
)

if exist "src\UpdateAvailableNotification.jsx" (
    echo.
    echo   ✅ src\UpdateAvailableNotification.jsx (EXISTÍA)
    echo      Descripcion: UI para notificaciones de actualización
) else (
    echo.
    echo   ❌ src\UpdateAvailableNotification.jsx (NO ENCONTRADO)
)

if exist "src\MobileAppDownloadScreen.jsx" (
    echo.
    echo   ✅ src\MobileAppDownloadScreen.jsx (EXISTÍA)
    echo      Descripcion: Gate-keep para descargar app mobile
) else (
    echo.
    echo   ❌ src\MobileAppDownloadScreen.jsx (NO ENCONTRADO)
)

echo.
echo.
echo ======================================================================
echo.
echo  RECOMENDACION: Lee QUICK_START_FIREBASE.md para empezar
echo.
echo  PROXIMO PASO: Ejecuta deploy-firebase.bat
echo.
echo ======================================================================
echo.

pause
