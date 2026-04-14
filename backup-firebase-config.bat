@echo off
REM Script para hacer respaldo de configuracion Firebase
REM Crea carpeta backups/ con fecha y hora

setlocal enabledelayedexpansion

REM Obtener fecha y hora
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a-%%b)

set BACKUP_FOLDER=backups\firebase-backup-%mydate%-%mytime%

echo.
echo ======================================================================
echo.
echo     RESPALDO DE CONFIGURACION FIREBASE
echo.
echo ======================================================================
echo.
echo [INFO] Creando carpeta de respaldo: %BACKUP_FOLDER%
mkdir "%BACKUP_FOLDER%" 2>nul

echo [INFO] Descargando reglas Firestore...
firebase firestore:rules:get > "%BACKUP_FOLDER%\firestore.rules.backup"

echo [INFO] Descargando configuracion de Hosting...
firebase hosting:channels:list > "%BACKUP_FOLDER%\hosting.channels.backup"

echo [INFO] Descargando informacion de proyecto...
firebase projects:describe > "%BACKUP_FOLDER%\project.info.backup"

echo [INFO] Copiando archivos locales de config...
copy "firebase.json" "%BACKUP_FOLDER%\firebase.json.backup" >nul
copy ".firebaserc" "%BACKUP_FOLDER%\.firebaserc.backup" >nul
copy "firestore.rules" "%BACKUP_FOLDER%\firestore.rules.local.backup" >nul
copy "database.rules.json" "%BACKUP_FOLDER%\database.rules.json.backup" >nul

echo [INFO] Descargando indexes...
firebase firestore:indexes --export "%BACKUP_FOLDER%\firestore-indexes.json" 2>nul

echo.
echo ======================================================================
echo.
echo  ✅ RESPALDO COMPLETADO
echo.
echo ======================================================================
echo.
echo Ubicacion: %BACKUP_FOLDER%
echo.
echo Archivos respaldados:
echo   - firestore.rules.backup
echo   - hosting.channels.backup
echo   - project.info.backup
echo   - firebase.json.backup
echo   - .firebaserc.backup
echo   - firestore.rules.local.backup
echo   - database.rules.json.backup
echo   - firestore-indexes.json
echo.

pause
