@echo off
REM Script para inicializar Firestore manualmente
REM Si setup-app-versions.js falla, usa este script

setlocal enabledelayedexpansion

echo.
echo ======================================================================
echo.
echo     INICIALIZAR FIRESTORE MANUALMENTE
echo     (Si automatic setup-app-versions.js fallo)
echo.
echo ======================================================================
echo.

echo [INFO] Este script te guia a crear la estructura en Firestore manual
echo.
echo [PASOS]:
echo.
echo 1. Abre Firebase Console:
echo    https://console.firebase.google.com/project/control-ph-82951/firestore
echo.
echo 2. Click en "[+ Crear Coleccion]"
echo.
echo 3. Nombre: app-versions
echo    Click "Crear"
echo.
echo 4. Documento ID: latest
echo    Click "Auto ID" O escribe "latest"
echo    Campos:
echo      - Nombre campo: "version"
echo        Tipo: String
echo        Valor: "5.0.0"
echo.
echo      - Siguiente campo: "url"
echo        Tipo: String
echo        Valor: "https://tu-url.com/app-release.apk"
echo.
echo      - Siguiente campo: "changelog"
echo        Tipo: String
echo        Valor: "Primera version - OTA updates incluido"
echo.
echo      - Siguiente campo: "mandatory"
echo        Tipo: Boolean
echo        Valor: true
echo.
echo      - Siguiente campo: "releaseDate"
echo        Tipo: Timestamp
echo        Valor: Hoy
echo.
echo Click [Guardar]
echo.
echo 5. DE VUELTA en app-versions, crear OTRO documento:
echo    Documento ID: v5.0.0
echo    Campos IGUALES al anterior
echo    Click [Guardar]
echo.
echo 6. NUEVA colección: app-config
echo    Documento ID: settings
echo    Campos:
echo      - "updateCheckInterval"
echo        Tipo: Number
echo        Valor: 3600 (1 hora en segundos)
echo.
echo      - "forceUpdateVersion"
echo        Tipo: String
echo        Valor: "4.0.0" (versiones menores a esta DEBEN actualizar)
echo.
echo      - "maintenanceMode"
echo        Tipo: Boolean
echo        Valor: false
echo.
echo Click [Guardar]
echo.
echo 7. NUEVA colección: update-logs
echo    (Dejar vacia, el app llenara con logs de descargas)
echo.
echo ✅ LISTO! Firestore esta inicializado
echo.

echo [RESULTADO] Estructura final:
echo.
echo   📦 app-versions/
echo      ├─ latest
echo      │   ├─ version: "5.0.0"
echo      │   ├─ url: "..."
echo      │   ├─ changelog: "..."
echo      │   └─ mandatory: true
echo      └─ v5.0.0
echo          └─ [mismo contenido]
echo.
echo   📦 app-config/
echo      └─ settings
echo          ├─ updateCheckInterval: 3600
echo          ├─ forceUpdateVersion: "4.0.0"
echo          └─ maintenanceMode: false
echo.
echo   📦 update-logs/
echo      └─ [vacia - se llenara con logs]
echo.

echo ======================================================================

start https://console.firebase.google.com/project/control-ph-82951/firestore

pause
