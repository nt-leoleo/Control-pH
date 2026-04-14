@echo off
REM Script para verificar estado del deploy en Firebase
REM Uso: check-firebase-status.bat

setlocal enabledelayedexpansion

echo.
echo ======================================================================
echo.
echo          VERIFICAR ESTADO DEL DEPLOY EN FIREBASE
echo.
echo ======================================================================
echo.

REM Verificar Firebase CLI
firebase --version
echo.

REM Ver proyectos firebase
echo [INFO] Proyectos Firebase activos:
echo.
firebase projects:list
echo.

REM Ver hosting deployments
echo [INFO] Deployments de Hosting:
echo.
firebase hosting:sites
echo.

REM Ver resumen
echo [INFO] Resumen de deployment:
echo Did you know you can list hosting sites using 'firebase hosting:sites'?
echo.

echo ======================================================================
echo.
echo [INFO] URLs del proyecto:
echo.
echo   App Web:
echo   https://control-ph-82951.web.app
echo.
echo   Firestore Database:
echo   https://console.firebase.google.com/project/control-ph-82951/firestore
echo.
echo   Hosting Settings:
echo   https://console.firebase.google.com/project/control-ph-82951/hosting
echo.
echo ======================================================================

pause
