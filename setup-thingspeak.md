# 🌐 Setup con ThingSpeak (Alternativa más simple)

## 🎯 **Por qué ThingSpeak**
- Gratuito y confiable
- Específicamente diseñado para IoT
- No requiere API keys complicadas
- Fácil de configurar

## 🔧 **Pasos para configurar ThingSpeak**

### **1. Crear cuenta en ThingSpeak**
1. Ve a https://thingspeak.com
2. Haz clic en **"Get Started For Free"**
3. Crea una cuenta gratuita

### **2. Crear un canal**
1. Una vez logueado, haz clic en **"Channels"** → **"My Channels"**
2. Haz clic en **"New Channel"**
3. Configura así:
   - **Name**: Control Pileta pH
   - **Description**: Sensor de pH para piscina
   - **Field 1**: pH
   - **Field 2**: Voltage
   - **Field 3**: WiFi_RSSI
   - **Field 4**: Uptime
4. Haz clic en **"Save Channel"**

### **3. Obtener las claves**
Después de crear el canal, verás:
- **Channel ID**: Un número (ej: 123456)
- **Write API Key**: Una clave para escribir datos
- **Read API Key**: Una clave para leer datos (opcional)

### **4. URLs que necesitarás**
- **Para escribir**: `https://api.thingspeak.com/update?api_key=TU_WRITE_KEY&field1=7.2&field2=1.5&field3=-45&field4=3600`
- **Para leer**: `https://api.thingspeak.com/channels/TU_CHANNEL_ID/feeds/last.json`

## 📝 **Ventajas de ThingSpeak**
✅ Gratuito hasta 3 millones de mensajes/año  
✅ Gráficos automáticos  
✅ API REST simple  
✅ No requiere autenticación compleja para leer  
✅ Diseñado específicamente para sensores IoT  

¿Prefieres usar ThingSpeak en lugar de JSONBin?