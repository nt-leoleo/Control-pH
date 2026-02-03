# 🔗 Conectar ESP32 con la App Web

## 📋 Checklist de Conexión

### 1. ✅ Verificar IP del ESP32
- [ ] Abrir Monitor Serie (115200 baudios)
- [ ] Reiniciar ESP32 (botón RESET)
- [ ] Anotar la IP que aparece: `ESP32 IP: _______________`

### 2. ✅ Probar Conexión Directa
- [ ] Abrir navegador
- [ ] Ir a: `http://TU_IP_ESP32/status`
- [ ] Debería mostrar JSON: `{"status":"ok","device":"esp32"...}`

### 3. ✅ Actualizar IP en la App (Si es Diferente)
Si tu IP NO es `192.168.100.134`:

**Editar archivo:** `control-pileta/src/esp32Communication.js`
```javascript
export const ESP32_CONFIG = {
    BASE_URL: 'http://TU_IP_REAL_AQUI', // ← Cambiar esta línea
    // ...
};
```

### 4. ✅ Reiniciar App Web
Después de cambiar la IP:
- [ ] Parar el servidor web (Ctrl+C)
- [ ] Ejecutar: `npm run dev`
- [ ] El indicador debería ponerse verde

## 🚨 Problemas Comunes

### ESP32 Conectado pero App Desconectada:
- ✅ **IP incorrecta**: La más común
- ✅ **Diferentes redes WiFi**: ESP32 y computadora en redes distintas
- ✅ **Firewall**: Bloqueando la conexión
- ✅ **Puerto 80 ocupado**: Otro servicio usando el puerto

### Verificaciones:
1. **Misma red**: ESP32 y computadora en la misma WiFi
2. **Ping funciona**: `ping TU_IP_ESP32` desde CMD
3. **Puerto abierto**: Navegador puede acceder a `http://TU_IP_ESP32/status`

## 🎯 Pasos Siguientes

**Una vez que tengas la IP del ESP32:**
1. **Dímela** para que actualice el código
2. **O actualízala tú** en `esp32Communication.js`
3. **Reinicia la app web**
4. **El indicador debería ponerse verde** 🟢

## 📞 Información Necesaria

**Para ayudarte mejor, necesito:**
- ✅ **IP del ESP32**: La que aparece en Monitor Serie
- ✅ **Resultado del navegador**: ¿Qué pasa al ir a `http://IP/status`?
- ✅ **Red WiFi**: ¿ESP32 y computadora en la misma red?