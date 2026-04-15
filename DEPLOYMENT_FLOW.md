# 🚀 Flujo de Publicación - Control Pileta pH

Guía completa para desplegar cambios en web, APK, cloud functions y OTA updates.

---

## 📋 Índice

1. [Flujo Básico](#flujo-básico)
2. [Cambios Solo Web](#cambios-solo-web)
3. [Cambios Web + Cloud](#cambios-web--cloud)
4. [Nuevo APK + OTA](#nuevo-apk--ota)
5. [Flujo Completo (Todo)](#flujo-completo-todo)
6. [Verificación Post-Deploy](#verificación-post-deploy)

---

## Flujo Básico

```
┌─────────────────────────────────────────────────────────┐
│                   DESARROLLO LOCAL                      │
│  git add . → git commit → git push origin main          │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
    ┌───▼────────┐          ┌───────▼──────┐
    │    WEB     │          │    APK/MOBILE │
    │ Hosting +  │          │  + OTA Update  │
    │ Functions  │          │                │
    └────────────┘          └────────────────┘
```

---

## Cambios Solo Web

**Escenario:** Cambios en React, estilos, o lógica web.

### Comando Rápido
```bash
cd "c:\Users\PC\Desktop\Leonardo\WEB\control pileta\control-pileta"
npm run build
firebase deploy --only hosting
```

### Proceso Detallado
1. **Verificar cambios locales:**
   ```bash
   git status
   ```

2. **Compilar con Vite:**
   ```bash
   npm run build
   ```
   📁 Output: `dist/` (completa)

3. **Deploy a Firebase Hosting:**
   ```bash
   firebase deploy --only hosting
   ```
   ⏱️ Tiempo: ~30-60s
   
4. **URL publicada:**
   - https://control-ph-82951.web.app
   - Acceso inmediato sin caché

---

## Cambios Web + Cloud

**Escenario:** Cambios en funciones cloud (`control-ph/index.js`) o reglas Firestore.

### Comando Rápido
```bash
npm run build
firebase deploy --only hosting,functions,firestore
```

### Proceso Detallado

1. **Compilar web:**
   ```bash
   npm run build
   ```

2. **Deploy completo:**
   ```bash
   firebase deploy --only hosting,functions,firestore
   ```
   
   Actualiza:
   - ✅ Firebase Hosting (web)
   - ✅ Cloud Functions (`sendManualDosingCommand`, etc.)
   - ✅ Firestore Rules (permisos lectura/escritura)

3. **Verificar funciones:**
   ```bash
   firebase functions:list
   ```

4. **Ver logs de Cloud Functions:**
   ```bash
   firebase functions:log
   ```

---

## Nuevo APK + OTA

**Escenario:** Nueva versión APK con nuevas features.

### Flujo Paso a Paso

#### **PASO 1: Preparar versión**
```bash
# Actualizar versión en UpdatingService.js
# Cambiar: const APP_VERSION = '5.0.X';
```

#### **PASO 2: Build APK**
```bash
npm run build
npx cap copy android
cd android
./gradlew.bat assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk
```

#### **PASO 3: Publicar APK**

**Opción A: GitHub Releases**
```bash
# Crear release automática
gh release create v5.0.X \
  --title "Control pH v5.0.X" \
  --notes "Changelog: ... " \
  "android/app/build/outputs/apk/release/app-release.apk"
```

**Opción B: Firebase Storage**
```bash
firebase storage:upload android/app/build/outputs/apk/release/app-release.apk gs://control-ph-82951.appspot.com/apk/app-v5.0.X.apk
```

#### **PASO 4: Actualizar Firestore (OTA Delivery)**

En [Firebase Console](https://console.firebase.google.com):

1. Ve a **Firestore Database**
2. Colección: `app-versions`
3. Documento: `latest`
4. Actualiza campos:

```json
{
  "version": "5.0.X",
  "url": "https://github.com/.../releases/download/v5.0.X/app-release.apk",
  "changelog": "✨ Nuevas features:\n- Mejora X\n- Corrección Y",
  "mandatory": false,
  "releaseDate": "2026-04-15T14:30:00Z",
  "isActive": true,
  "minVersion": "5.0.0",
  "supportedPlatforms": ["android"]
}
```

#### **PASO 5: Verificar OTA**

- ✅ Abrir app en APK
- ✅ Debe mostrar notificación de actualización
- ✅ Permitir descarga e instalación
- ✅ App se reinicia con nueva versión

---

## Flujo Completo (Todo)

**Escenario:** Cambios en todo (web, funciones, nuevo APK).

### Comando Master
```bash
# 1. Actualizar versión en UpdatingService.js
# 2. Compilar todo
npm run build
npx cap copy android

# 3. Build APK
cd android
./gradlew.bat assembleRelease
cd ..

# 4. Deploy web + cloud
firebase deploy --only hosting,functions,firestore

# 5. Publicar APK
gh release create v5.0.X --notes "Nueva versión" \
  "android/app/build/outputs/apk/release/app-release.apk"

# 6. Actualizar OTA en Firestore (manual en console)
```

### Checklist Completo

- [ ] Commit cambios locales: `git push`
- [ ] Compilar web: `npm run build`
- [ ] Verificar build sin errores: `npm run lint`
- [ ] Update UpdatingService.js version
- [ ] Build APK: `./gradlew.bat assembleRelease`
- [ ] Test APK en emulador/dispositivo
- [ ] Deploy: `firebase deploy`
- [ ] Publicar APK en GitHub Releases
- [ ] Actualizar `app-versions/latest` en Firestore
- [ ] Verificar OTA notification en app
- [ ] Monitorear logs: `firebase functions:log`

---

## Verificación Post-Deploy

### Web
```bash
# Limpiar caché y recargar
# En navegador: Ctrl+Shift+R (hard refresh)
# Verificar: https://control-ph-82951.web.app
```

### Cloud Functions
```bash
firebase functions:describe sendManualDosingCommand
firebase functions:log --limit 50
```

### APK + OTA
1. Abrir app en dispositivo
2. Check: App muestra notificación de actualización
3. Descargar e instalar
4. Verificar versión en Settings
5. Verificar que funciona correctamente

### Firestore Status
```bash
firebase firestore:indexes
firebase firestore:describe app-versions/latest
```

---

## 🚨 Troubleshooting

### "Firebase deploy falló"
```bash
firebase logout
firebase login
firebase deploy
```

### "APK no muestra notificación OTA"
- [ ] ¿Documento `app-versions/latest` existe?
- [ ] ¿Campo `version` es mayor que versión app?
- [ ] ¿URL del APK es válida?
- [ ] ¿Chequeó: `useAppUpdater.js` CURRENT_VERSION?

### "Cloud Function error"
```bash
firebase functions:log --follow  # Ver logs en tiempo real
firebase emulators:start          # Emular localmente
```

---

## 📊 Timeline Estimado

| Paso | Tiempo |
|------|--------|
| Build web | 2-3 min |
| Deploy web | 30-60 seg |
| Build APK | 5-10 min |
| Publicar GitHub | 1-2 min |
| Update Firestore | 1 min |
| **Total** | **10-20 min** |

---

## 🔄 Ambiente por Ambiente

### Development (dev)
```bash
# Local testing
npm run dev
# Capacitor emulator
npx cap open android
```

### Production (prod)
```bash
# Build optimizado
npm run build

# Deploy
firebase deploy

# Verificar
firebase hosting:channel:list
```

---

## 📎 Recursos Útiles

- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Cloud Functions](https://firebase.google.com/docs/functions)
- [Capacitor Deploy](https://capacitorjs.com/docs/guides/deploying-to-google-play)
- [GitHub Releases API](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)

---

**Última actualización:** 15 Abril 2026  
**Versión app actual:** 5.0.5  
**Proyecto Firebase:** control-ph-82951
