# 📊 Crear tu propio Canal ThingSpeak

## 🎯 **Por qué crear tu propio canal**
- Control total sobre los datos
- API Key personal
- Sin límites de otros usuarios
- Configuración personalizada

## 🔧 **Pasos para crear el canal**

### **1. Crear cuenta en ThingSpeak**
1. Ve a https://thingspeak.com
2. Haz clic en **"Get Started For Free"**
3. Crea una cuenta con tu email

### **2. Crear un nuevo canal**
1. Una vez logueado, haz clic en **"Channels"** → **"My Channels"**
2. Haz clic en **"New Channel"**
3. Configura así:
   - **Name**: Control Pileta pH
   - **Description**: Sensor de pH para piscina remoto
   - **Field 1**: pH
   - **Field 2**: Voltage
   - **Field 3**: WiFi_RSSI
   - **Field 4**: Uptime
   - **Tags**: ph, sensor, esp32, piscina
4. Haz clic en **"Save Channel"**

### **3. Obtener las claves**
Después de crear el canal, ve a la pestaña **"API Keys"**:
- **Channel ID**: Un número (ej: 1234567)
- **Write API Key**: Una clave como "ABCD1234EFGH5678"
- **Read API Key**: Otra clave (opcional para canales públicos)

### **4. Actualizar el código ESP32**
Reemplaza en `sensorPH_ThingSpeak.ino`:
```cpp
const String writeAPIKey = "TU_WRITE_API_KEY_AQUI";
const String channelID = "TU_CHANNEL_ID_AQUI";
```

### **5. Actualizar la app web**
Reemplaza en `esp32Communication.js`:
```javascript
CHANNEL_ID: 'TU_CHANNEL_ID_AQUI',
THINGSPEAK_API: 'https://api.thingspeak.com/channels/TU_CHANNEL_ID_AQUI/feeds/last.json',
```

## 🎉 **Ventajas de tu propio canal**
✅ **Control total** - Es tuyo  
✅ **Sin interferencias** - Solo tus datos  
✅ **Configuración personalizada** - Nombres de campos, etc.  
✅ **Privacidad** - Puedes hacerlo privado si quieres  
✅ **Límites más altos** - 3 millones de mensajes/año  

## 📱 **URLs de tu canal**
Una vez creado, tendrás:
- **Canal**: https://thingspeak.com/channels/TU_CHANNEL_ID
- **API**: https://api.thingspeak.com/channels/TU_CHANNEL_ID/feeds/last.json
- **Gráficos**: https://thingspeak.com/channels/TU_CHANNEL_ID/charts/1

¿Quieres crear tu propio canal o prefieres que diagnostiquemos el problema actual?