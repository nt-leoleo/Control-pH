# 📡 Instrucciones de Configuración ESP32

## 🔧 Hardware Necesario

- **ESP32** (cualquier modelo)
- **Sensor pH analógico** (conectado a GPIO34)
- **LCD 20x4 I2C** (dirección 0x27)
- **4 Botones** (GPIO 2, 4, 5, 18)
- **2 Relés** (GPIO 19 y 21)
- **Fuente de alimentación** 5V

## 📌 Conexiones

### Sensor pH
- **VCC** → 3.3V
- **GND** → GND
- **OUT** → GPIO34 (ADC1_CH6)

### LCD 20x4 I2C
- **VCC** → 5V
- **GND** → GND
- **SDA** → GPIO21
- **SCL** → GPIO22

### Botones (con pull-up interno)
- **Botón 1** (Calibrar) → GPIO2 → GND
- **Botón 2** (Modo) → GPIO4 → GND
- **Botón 3** (pH+) → GPIO5 → GND
- **Botón 4** (pH-) → GPIO18 → GND

### Relés
- **Relé pH+** (Base/Cloro) → GPIO19
- **Relé pH-** (Ácido) → GPIO21

## 📚 Librerías Necesarias

Instalar en Arduino IDE:

1. **LiquidCrystal_I2C** by Frank de Brabander
   - Sketch → Include Library → Manage Libraries
   - Buscar "LiquidCrystal I2C"
   - Instalar versión más reciente

2. **WiFi** (incluida con ESP32)
3. **HTTPClient** (incluida con ESP32)
4. **EEPROM** (incluida con ESP32)

## ⚙️ Configuración del Código

### 1. WiFi
```cpp
const char* ssid = "TU_WIFI_SSID";           // Tu red WiFi
const char* password = "TU_WIFI_PASSWORD";   // Tu contraseña
```

### 2. ThingSpeak (Ya configurado)
```cpp
const String writeAPIKey = "GQXD1DTF1D6DPUSG";
const String readAPIKey = "S7Q7FWREGP96KX04";
const String channelID = "3249157";
```

### 3. Calibración del Sensor pH

El sensor necesita calibración. Hay dos métodos:

#### Método 1: Calibración con Solución Buffer pH 7.0
1. Sumergir sensor en solución buffer pH 7.0
2. Mantener presionado **Botón 1** por 3 segundos
3. El LCD mostrará "CALIBRANDO..."
4. Esperar a que muestre "CALIBRADO OK"

#### Método 2: Ajuste Manual en el Código
```cpp
float phOffset = 0.0;    // Ajustar según tu sensor
float phSlope = 3.5;     // Ajustar según tu sensor
```

## 🚀 Carga del Código

1. Abrir Arduino IDE
2. Seleccionar placa: **Tools → Board → ESP32 Dev Module**
3. Seleccionar puerto: **Tools → Port → COMx** (Windows) o **/dev/ttyUSBx** (Linux)
4. Configurar:
   - Upload Speed: 921600
   - Flash Frequency: 80MHz
   - Flash Mode: QIO
   - Flash Size: 4MB
   - Partition Scheme: Default 4MB
5. Hacer clic en **Upload** (→)

## 📊 Funcionamiento

### Modo Automático (Por defecto)
- El ESP32 lee comandos de ThingSpeak cada 5 segundos
- Cuando la app web envía un comando:
  - Lee Field5 (producto: 1=pH+, 2=pH-)
  - Lee Field6 (duración en segundos)
  - Lee Field7 (contador de comandos)
- Activa el relé correspondiente
- Mantiene activo por el tiempo especificado
- Desactiva automáticamente

### Modo Manual
- Presionar **Botón 2** para cambiar a modo manual
- **Botón 3**: Dosificar pH+ por 5 segundos
- **Botón 4**: Dosificar pH- por 5 segundos
- LCD muestra "MANUAL"

### Display LCD

```
Línea 1: pH Monitor v1.0
Línea 2: pH:7.25  WiFi:OK
Línea 3: V:2.50V  12:34
Línea 4: AUTO   OK
```

Durante dosificación:
```
Línea 4: DOSIF:pH+ 15s
```

## 🔍 Monitor Serial

Abrir Serial Monitor (115200 baud) para ver:
- Estado de conexión WiFi
- Lecturas de pH
- Comandos recibidos
- Estado de dosificación
- Errores y advertencias

### Ejemplo de salida:
```
=================================
Sistema Control pH v1.0
=================================

📡 Conectando a WiFi...
✅ WiFi conectado!
📍 IP: 192.168.1.100
📶 RSSI: -45

📊 pH: 7.25 | Voltaje: 2.500V
📤 Datos enviados a ThingSpeak (Entry: 12345)

🆕 NUEVO COMANDO RECIBIDO!
   Product Code: 2
   Duration: 30 segundos
   Counter: 5

💊 INICIANDO DOSIFICACIÓN
   Producto: pH-
   Duración: 30 segundos
🔌 Relé pH- ACTIVADO

⏳ Dosificando... 25s restantes
⏳ Dosificando... 20s restantes
⏳ Dosificando... 15s restantes
⏳ Dosificando... 10s restantes
⏳ Dosificando... 5s restantes

✅ DOSIFICACIÓN COMPLETADA
   Producto: pH-
   Duración: 30 segundos
```

## 🎛️ Botones

| Botón | Función | Modo |
|-------|---------|------|
| 1 | Calibrar (mantener 3s) | Ambos |
| 2 | Cambiar Modo Auto/Manual | Ambos |
| 3 | Dosificar pH+ (5s) | Manual |
| 4 | Dosificar pH- (5s) | Manual |

## 🔧 Solución de Problemas

### WiFi no conecta
- Verificar SSID y contraseña
- Verificar que el router esté encendido
- Verificar señal WiFi (debe ser 2.4GHz, no 5GHz)

### LCD no muestra nada
- Verificar conexiones I2C (SDA/SCL)
- Verificar dirección I2C (puede ser 0x27 o 0x3F)
- Ajustar contraste del LCD (potenciómetro en la parte trasera)

### Sensor pH da valores incorrectos
- Calibrar con solución buffer pH 7.0
- Verificar conexión del sensor
- Limpiar electrodo del sensor
- Ajustar phSlope y phOffset en el código

### Relés no activan
- Verificar conexiones GPIO19 y GPIO21
- Verificar alimentación de los relés (5V)
- Verificar que los relés sean de 3.3V o 5V trigger
- Medir voltaje en los pines GPIO con multímetro

### No recibe comandos de ThingSpeak
- Verificar conexión WiFi
- Verificar API Keys en el código
- Verificar que el modo sea AUTOMÁTICO (no manual)
- Revisar Serial Monitor para ver errores

## 📈 Datos Enviados a ThingSpeak

Cada 20 segundos el ESP32 envía:
- **Field1**: pH (0-14)
- **Field2**: Voltaje del sensor (0-3.3V)
- **Field3**: WiFi RSSI (señal)
- **Field4**: Uptime (segundos)

## 📥 Comandos Recibidos de ThingSpeak

La app web envía:
- **Field5**: Código de producto (1=pH+, 2=pH-)
- **Field6**: Duración en segundos
- **Field7**: Contador de comandos (incrementa con cada nuevo comando)

## 🔒 Seguridad

- Los relés se apagan automáticamente después del tiempo especificado
- Máximo tiempo de dosificación: limitado por la app web
- En caso de pérdida de WiFi, el sistema continúa funcionando localmente
- Modo manual permite control de emergencia sin conexión

## 📝 Notas Importantes

1. **Calibración**: Calibrar el sensor al menos una vez al mes
2. **Mantenimiento**: Limpiar el electrodo del sensor semanalmente
3. **Seguridad**: Nunca tocar los relés mientras están activos
4. **Químicos**: Usar productos químicos apropiados para piscinas
5. **Supervisión**: Verificar el pH manualmente periódicamente

## 🆘 Soporte

Si tienes problemas:
1. Revisar el Serial Monitor (115200 baud)
2. Verificar todas las conexiones
3. Verificar que las librerías estén instaladas
4. Verificar la configuración WiFi
5. Verificar los API Keys de ThingSpeak
