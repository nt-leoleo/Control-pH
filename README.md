# 🏊 Control Pileta pH

Sistema IoT completo para monitoreo y control automático del pH de piscinas.

![Version](https://img.shields.io/badge/version-4.12.0-blue)
![Firmware](https://img.shields.io/badge/firmware-5.1-green)
![License](https://img.shields.io/badge/license-MIT-orange)
![Platform](https://img.shields.io/badge/platform-Web%20%7C%20Android-lightgrey)

## 📋 Descripción

**Control Pileta pH** es una solución completa que combina hardware (ESP32), backend en la nube (Firebase) y aplicaciones web/móvil para automatizar el control del pH de piscinas. El sistema permite monitoreo en tiempo real, dosificación automática de productos químicos y gestión multiusuario.

## ✨ Características Principales

### 🎯 Monitoreo en Tiempo Real
- Lectura continua del pH del agua
- Visualización en tiempo real en app web y móvil
- Gráficos históricos de tendencias
- Alertas cuando el pH está fuera de rango

### 💊 Dosificación Inteligente
- **Automática**: Dosifica según pH objetivo configurado
- **Manual**: Control directo desde la app
- **En bloques**: División automática de cambios grandes
- **Ventanas horarias**: Restricción de horarios de dosificación

### 📱 Aplicaciones
- **Web**: PWA responsive accesible desde cualquier navegador
- **Android**: APK nativo con actualizaciones OTA
- **Multiusuario**: Múltiples usuarios pueden gestionar el mismo dispositivo

### 🔧 Gestión Avanzada
- Panel de administrador para gestión de usuarios
- Configuración de caudal de bomba dosificadora
- Lector QR para configuración rápida de dispositivos
- Tutorial interactivo para nuevos usuarios

## 🏗️ Arquitectura

```
┌─────────────────┐
│   ESP32 + pH    │
│   Sensor        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cloud Functions │
│   (Firebase)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Firebase      │
│ Firestore + RT  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  App Web/Móvil  │
│  React + PWA    │
└─────────────────┘
```

### Componentes

#### Hardware
- **ESP32**: Microcontrolador dual-core
- **Sensor pH**: Analógico con calibración
- **LCD 20x4**: Pantalla I2C para visualización local
- **Relés**: 2 canales para dosificación (pH+ y pH-)
- **Botones**: 4 botones para control manual

#### Backend
- **Firebase Firestore**: Base de datos de configuración
- **Firebase Realtime Database**: Datos en tiempo real
- **Cloud Functions**: Lógica de negocio serverless
- **Firebase Auth**: Autenticación de usuarios

#### Frontend
- **React**: Framework de UI
- **Vite**: Build tool
- **Capacitor**: Wrapper para Android
- **Recharts**: Gráficos interactivos

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js 18+
- Firebase CLI
- Arduino IDE (para firmware ESP32)
- Android Studio (opcional, para APK)

### Instalación

#### 1. Clonar el Repositorio
```bash
git clone https://github.com/nt-leoleo/Control-pH.git
cd Control-pH
```

#### 2. Configurar Frontend
```bash
cd control-pileta
npm install
cp .env.example .env
# Editar .env con tus credenciales de Firebase
npm run dev
```

#### 3. Configurar Backend
```bash
cd control-pileta
firebase login
firebase use --add
# Seleccionar tu proyecto de Firebase
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only database
```

#### 4. Configurar Firmware ESP32
1. Abrir `Sensor Arduino/a_main/a_main.ino` en Arduino IDE
2. Configurar WiFi en `config.h`:
   ```cpp
   const char* ssid = "TU_WIFI_SSID";
   const char* password = "TU_WIFI_PASSWORD";
   ```
3. Instalar librerías necesarias:
   - LiquidCrystal_I2C
   - WiFi (incluida)
   - HTTPClient (incluida)
4. Seleccionar placa: ESP32 Dev Module
5. Subir código al ESP32

## 📱 Uso

### Primera Configuración

1. **Acceder a la app**: https://control-ph-82951.web.app
2. **Crear cuenta**: Registrarse con email o Google
3. **Seguir onboarding**:
   - Configurar pH objetivo y tolerancia
   - Seleccionar productos químicos
   - Configurar caudal de bomba
   - Escanear QR del dispositivo o ingresar Device ID manualmente

### Configurar Primer Administrador

```bash
cd control-pileta
node set-admin.js tu-email@example.com
```

O manualmente en Firebase Console:
1. Ir a Firestore → `users` → tu usuario
2. Agregar campo: `role` = `admin`

### Operación Diaria

- **Monitoreo**: Ver pH actual en dashboard
- **Dosificación manual**: Botones pH+ / pH- en la app
- **Configuración**: Ajustar parámetros en Configuración
- **Historial**: Ver registro de dosificaciones

## 📚 Documentación

### Para Usuarios
- [Acceso a la App Web](ACCESO_APP_WEB.md)
- [Configuración de Tiempos](CONFIGURACION_TIEMPOS.md)
- [Configurar Primer Admin](CONFIGURAR_PRIMER_ADMIN.md)
- [Inicio Rápido Admin](INICIO_RAPIDO_ADMIN.md)

### Para Desarrolladores
- [Línea de Tiempo del Proyecto](LINEA_TIEMPO_PROYECTO.md)
- [Gestión de Usuarios Admin](GESTION_USUARIOS_ADMIN.md)
- [Optimización de Tiempos](OPTIMIZACION_TIEMPOS.md)
- [Solución Backend](SOLUCION_BACKEND.md)
- [Arquitectura Arduino](Sensor%20Arduino/a_main/CORE_MAPPING_V2.md)

### Resúmenes
- [Registro de Cambios](REGISTRO.md)
- [Seguimiento del Proyecto](SEGUIMIENTO_ACTUALIZADO.md)

## 🔧 Desarrollo

### Estructura del Proyecto

```
Control-pH/
├── control-pileta/          # Frontend React + Backend Firebase
│   ├── src/                 # Código fuente React
│   ├── control-ph/          # Cloud Functions
│   ├── android/             # Proyecto Android (Capacitor)
│   └── scripts/             # Scripts de utilidad
├── Sensor Arduino/          # Firmware ESP32
│   └── a_main/              # Código modular Arduino
├── APK PRUEBA/              # APK de prueba
└── *.md                     # Documentación
```

### Scripts Disponibles

#### Frontend
```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run preview      # Preview del build
npm run update-version  # Actualizar versión en Firebase
```

#### Backend
```bash
firebase deploy --only functions      # Desplegar Cloud Functions
firebase deploy --only firestore:rules # Desplegar reglas Firestore
firebase deploy --only hosting        # Desplegar frontend
```

#### Android
```bash
npm run build
npx cap sync android
npx cap open android
# En Android Studio: Build → Build APK(s)
```

## 🧪 Testing

### Frontend
```bash
npm run test        # Tests unitarios (pendiente)
npm run test:e2e    # Tests e2e (pendiente)
```

### Firmware
- Usar Monitor Serial (115200 baud) para debugging
- Logs detallados de timing y operaciones

## 🚢 Despliegue

### Web (Vercel)
```bash
git push origin main
# Vercel despliega automáticamente
```

### Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

### Android APK
1. Generar APK en Android Studio
2. Crear release en GitHub
3. Subir APK a GitHub Releases

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📝 Changelog

Ver [LINEA_TIEMPO_PROYECTO.md](LINEA_TIEMPO_PROYECTO.md) para el historial completo de cambios.

### Versión Actual: v4.12.0 / v5.1

#### Frontend v4.12.0
- ✅ Sistema de actualizaciones OTA
- ✅ Gestión de usuarios para administradores
- ✅ Login nativo de Google en Android
- ✅ Ventanas de dosificación horaria
- ✅ Lector QR para Device ID

#### Firmware v5.1
- ✅ Código modularizado en 8 archivos
- ✅ Arquitectura dual-core optimizada
- ✅ Timer de alta precisión (±500ms)
- ✅ Protección contra tecla "pegada"

## 🐛 Problemas Conocidos

Ver [Issues en GitHub](https://github.com/nt-leoleo/Control-pH/issues)

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

## 👥 Autores

- **Desarrollador Principal**: [nt-leoleo](https://github.com/nt-leoleo)
- **Asistente de Desarrollo**: Kiro AI Assistant

## 🙏 Agradecimientos

- Firebase por la infraestructura cloud
- Capacitor por el wrapper Android
- Comunidad de Arduino por las librerías
- Todos los contribuidores del proyecto

## 📞 Soporte

- **Issues**: [GitHub Issues](https://github.com/nt-leoleo/Control-pH/issues)
- **Documentación**: Ver archivos .md en el repositorio
- **Email**: [Contacto del proyecto]

## 🔗 Enlaces

- **App Web**: https://control-ph-82951.web.app
- **APK Android**: https://github.com/nt-leoleo/Control-pH/releases/latest
- **Firebase Console**: https://console.firebase.google.com/project/control-ph-82951
- **GitHub Repo**: https://github.com/nt-leoleo/Control-pH

---

**Última actualización**: 4 de marzo de 2026  
**Estado**: Producción estable  
**Versión**: v4.12.0 (Frontend) / v5.1 (Firmware)

