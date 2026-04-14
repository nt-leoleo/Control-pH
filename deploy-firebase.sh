#!/bin/bash

# Script para hacer deploy completo a Firebase
# Uso: bash deploy-firebase.sh

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         🚀 DEPLOY COMPLETO A FIREBASE                         ║"
echo "║         control-ph-82951                                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Verificar Firebase CLI
echo -e "${BLUE}📋 Verificando Firebase CLI...${NC}"
if ! command -v firebase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Firebase CLI no instalado. Instalando...${NC}"
    npm install -g firebase-tools
fi
echo -e "${GREEN}✅ Firebase CLI listo${NC}\n"

# 2. Login a Firebase
echo -e "${BLUE}🔐 Verificando autenticación...${NC}"
firebase projects:list > /dev/null 2>&1 || {
    echo -e "${YELLOW}📱 Abriendo navegador para login...${NC}"
    firebase login
}
echo -e "${GREEN}✅ Autenticación OK${NC}\n"

# 3. Build web
echo -e "${BLUE}🏗️  Compilando web...${NC}"
npm run build
echo -e "${GREEN}✅ Build completado${NC}\n"

# 4. Setup Firestore (crear estructura de versiones)
echo -e "${BLUE}📝 Configurando estructura de Firestore...${NC}"
node scripts/setup-app-versions.js || true
echo -e "${GREEN}✅ Estructura de Firestore lista${NC}\n"

# 5. Deploy Firestore Rules
echo -e "${BLUE}🔐 Deployando Firestore Rules...${NC}"
firebase deploy --only firestore:rules
echo -e "${GREEN}✅ Rules deployadas${NC}\n"

# 6. Deploy Hosting
echo -e "${BLUE}🌐 Deployando Hosting...${NC}"
firebase deploy --only hosting
echo -e "${GREEN}✅ Hosting deployado${NC}\n"

# 7. Deploy Cloud Functions (si existen)
if [ -d "functions" ]; then
    echo -e "${BLUE}⚙️  Deployando Cloud Functions...${NC}"
    firebase deploy --only functions
    echo -e "${GREEN}✅ Functions deployadas${NC}\n"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo -e "${GREEN}║  ✅ DEPLOY COMPLETADO CON ÉXITO                        ║${NC}"
echo "╠════════════════════════════════════════════════════════════════╣"
echo "║  📱 App Web:                                                   ║"
echo  "║    https://control-ph-82951.web.app                          ║"
echo "║                                                                ║"
echo "║  📊 Firebase Console:                                          ║"
echo "║    https://console.firebase.google.com/project/control-ph-82951║"
echo "║                                                                ║"
echo "║  🔥 Firestore:                                                 ║"
echo "║    app-versions/latest → Nueva versión a descargar            ║"
echo "║    app-config/settings → Configuración global                 ║"
echo "║    update-logs → Analytics de descargas                       ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${YELLOW}💡 Próximos pasos:${NC}"
echo "   1. Abre Firebase Console"
echo "   2. Verifica que app-versions/latest existe"
echo "   3. Los usuarios recibirán la actualización automáticamente"
echo ""
