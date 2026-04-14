@echo off
REM Script batch para deploy a Firebase en Windows
REM Uso: deploy-firebase.bat

setlocal enabledelayedexpansion
set PROJECT_ID=control-ph-82951

echo.
echo ======================================================================
echo.
echo          ^>*^> DEPLOY COMPLETO A FIREBASE
echo          ^>*^> %PROJECT_ID%
echo.
echo ======================================================================
echo.

REM Verificar Firebase CLI
echo [INFO] Verificando Firebase CLI...
firebase --version >nul 2>&1
if errorlevel 1 (
    echo [ADVERTENCIA] Firebase CLI no encontrado. Instalando...
    call npm install -g firebase-tools
)
echo [OK] Firebase CLI listo
echo.

REM Verificar autenticacion
echo [INFO] Verificando autenticacion...
firebase projects:list >nul 2>&1
if errorlevel 1 (
    echo [ACCION REQUERIDA] Abre la ventana que aparecera para autenticarte en Firebase
    call firebase login
)
echo [OK] Autenticacion OK
echo.

REM Build web
echo [INFO] Compilando web...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build fallo
    exit /b 1
)
echo [OK] Build completado
echo.

REM Setup Firestore
echo [INFO] Configurando estructura de Firestore...
node scripts/setup-app-versions.js
if errorlevel 1 (
    echo [ADVERTENCIA] setup-app-versions necesita firebase-admin-key.json
)
echo [OK] Estructura de Firestore lista
echo.

REM Deploy Firestore Rules
echo [INFO] Deployando Firestore Rules...
call firebase deploy --only firestore:rules
if errorlevel 1 (
    echo [ERROR] Fallo deployment de rules
    exit /b 1
)
echo [OK] Rules deployadas
echo.

REM Deploy Hosting
echo [INFO] Deployando Hosting...
call firebase deploy --only hosting
if errorlevel 1 (
    echo [ERROR] Fallo deployment de hosting
    exit /b 1
)
echo [OK] Hosting deployado
echo.

REM Deploy Cloud Functions (si existen)
if exist "functions\" (
    echo [INFO] Deployando Cloud Functions...
    call firebase deploy --only functions
    if errorlevel 1 (
        echo [ADVERTENCIA] Fallo deployment de functions
    ) else (
        echo [OK] Functions deployadas
    )
    echo.
)

echo ======================================================================
echo.
echo  ^>*^> DEPLOY COMPLETADO CON EXITO
echo.
echo ======================================================================
echo.
echo [INFO] URLs de acceso:
echo.
echo   App Web:
echo   https://control-ph-82951.web.app
echo.
echo   Firebase Console:
echo   https://console.firebase.google.com/project/control-ph-82951
echo.
echo   Firestore:
echo   - app-versions/latest      = Nueva version a descargar
echo   - app-config/settings       = Configuracion global
echo   - update-logs               = Analytics de descargas
echo.
echo ======================================================================
echo.
echo [SIGUIENTE] Proximos pasos:
echo   1. Abre Firebase Console
echo   2. Verifica que app-versions/latest existe
echo   3. Los usuarios recibiran la actualizacion automaticamente
echo.

endlocal
pause
