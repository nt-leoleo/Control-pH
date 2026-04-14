@echo off
REM Menu interactivo para comandos Firebase utiles
REM Uso: firebase-menu.bat

:menu
cls
echo.
echo ======================================================================
echo.
echo          MENU FIREBASE - CONTROL PH
echo          Proyecto: control-ph-82951
echo.
echo ======================================================================
echo.
echo [1] Deploy COMPLETO (build + rules + hosting + functions)
echo [2] Deploy solo Hosting (publica cambios web)
echo [3] Deploy solo Firestore Rules
echo [4] Deploy solo Cloud Functions
echo [5] Verificar estado del deploy
echo [6] Abrir Firebase Console en navegador
echo [7] Inicializar Firestore (setup-app-versions.js)
echo [8] Inicializar Firestore MANUAL (paso a paso)
echo [9] Respaldar configuracion actual
echo [10] Ver version de Firebase CLI
echo [11] Salir
echo.
echo ======================================================================
echo.

set /p choice="Selecciona opcion [1-11]: "

if "%choice%"=="1" goto deploy_full
if "%choice%"=="2" goto deploy_hosting
if "%choice%"=="3" goto deploy_rules
if "%choice%"=="4" goto deploy_functions
if "%choice%"=="5" goto check_status
if "%choice%"=="6" goto open_console
if "%choice%"=="7" goto setup_firestore
if "%choice%"=="8" goto setup_firestore_manual
if "%choice%"=="9" goto backup
if "%choice%"=="10" goto version
if "%choice%"=="11" goto end

goto invalid

:deploy_full
echo.
echo [INFO] Iniciando deploy completo...
echo.
call deploy-firebase.bat
goto menu

:deploy_hosting
echo.
echo [INFO] Deployando solo Hosting...
echo.
firebase deploy --only hosting
echo.
pause
goto menu

:deploy_rules
echo.
echo [INFO] Deployando solo Firestore Rules...
echo.
firebase deploy --only firestore:rules
echo.
pause
goto menu

:deploy_functions
echo.
echo [INFO] Deployando solo Cloud Functions...
echo.
firebase deploy --only functions
echo.
pause
goto menu

:check_status
echo.
echo [INFO] Verificando estado...
echo.
call check-firebase-status.bat
goto menu

:open_console
echo.
echo [INFO] Abriendo Firebase Console...
echo.
start https://console.firebase.google.com/project/control-ph-82951
echo.
echo [OK] Se abre en navegador
pause
goto menu

:setup_firestore
echo.
echo [INFO] Inicializando Firestore...
echo.
node scripts/setup-app-versions.js
echo.
pause
goto menu

:setup_firestore_manual
echo.
echo [INFO] Guia manual de inicializacion...
echo.
call INIT_FIRESTORE_MANUAL.bat
goto menu

:backup
echo.
echo [INFO] Respaldando configuracion...
echo.
call backup-firebase-config.bat
goto menu

:version
echo.
echo [INFO] Version de Firebase CLI:
echo.
firebase --version
echo.
pause
goto menu

:invalid
echo.
echo [ERROR] Opcion invalida. Intenta de nuevo.
echo.
pause
goto menu

:end
echo.
echo [INFO] Saliendo...
echo.
