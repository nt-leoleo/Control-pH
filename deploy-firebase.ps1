#!/usr/bin/env pwsh

# Script PowerShell para hacer deploy completo a Firebase
# Uso: .\deploy-firebase.ps1

$ErrorActionPreference = "Stop"

Write-Host @"
╔════════════════════════════════════════════════════════════════╗
║         🚀 DEPLOY COMPLETO A FIREBASE                         ║
║         control-ph-82951                                      ║
╚════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green

# Verificar Firebase CLI
Write-Host "📋 Verificando Firebase CLI..." -ForegroundColor Cyan
$firebase = Get-Command firebase -ErrorAction SilentlyContinue
if (!$firebase) {
    Write-Host "⚠️  Firebase CLI no encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g firebase-tools
}
Write-Host "✅ Firebase CLI listo" -ForegroundColor Green
Write-Host ""

# Verificar autenticación
Write-Host "🔐 Verificando autenticación..." -ForegroundColor Cyan
firebase projects:list 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "📱 Por favor, inicia sesión en Firebase..." -ForegroundColor Yellow
    firebase login
}
Write-Host "✅ Autenticación OK" -ForegroundColor Green
Write-Host ""

# Build web
Write-Host "🏗️  Compilando web..." -ForegroundColor Cyan
npm run build
Write-Host "✅ Build completado" -ForegroundColor Green
Write-Host ""

# Setup Firestore
Write-Host "📝 Configurando estructura de Firestore..." -ForegroundColor Cyan
try {
    node scripts/setup-app-versions.js
} catch {
    Write-Host "⚠️  Nota: setup-app-versions puede necesitar firebase-admin-key.json" -ForegroundColor Yellow
}
Write-Host "✅ Estructura de Firestore lista" -ForegroundColor Green
Write-Host ""

# Deploy Firestore Rules
Write-Host "🔐 Deployando Firestore Rules..." -ForegroundColor Cyan
firebase deploy --only firestore:rules
Write-Host "✅ Rules deployadas" -ForegroundColor Green
Write-Host ""

# Deploy Hosting
Write-Host "🌐 Deployando Hosting..." -ForegroundColor Cyan
firebase deploy --only hosting
Write-Host "✅ Hosting deployado" -ForegroundColor Green
Write-Host ""

# Deploy Cloud Functions (si existen)
if (Test-Path "functions") {
    Write-Host "⚙️  Deployando Cloud Functions..." -ForegroundColor Cyan
    firebase deploy --only functions
    Write-Host "✅ Functions deployadas" -ForegroundColor Green
    Write-Host ""
}

Write-Host @"
╔════════════════════════════════════════════════════════════════╗
║  ✅ DEPLOY COMPLETADO CON ÉXITO                        ║
╠════════════════════════════════════════════════════════════════╣
║  📱 App Web:                                                   ║
║    https://control-ph-82951.web.app                          ║
║                                                                ║
║  📊 Firebase Console:                                          ║
║    https://console.firebase.google.com/project/control-ph-82951║
║                                                                ║
║  🔥 Firestore:                                                 ║
║    app-versions/latest → Nueva versión a descargar            ║
║    app-config/settings → Configuración global                 ║
║    update-logs → Analytics de descargas                       ║
╚════════════════════════════════════════════════════════════════╝
"@ -ForegroundColor Green

Write-Host "💡 Próximos pasos:" -ForegroundColor Yellow
Write-Host "   1. Abre Firebase Console"
Write-Host "   2. Verifica que app-versions/latest existe"
Write-Host "   3. Los usuarios recibirán la actualización automáticamente"
Write-Host ""
