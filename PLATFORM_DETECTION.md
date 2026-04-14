# Platform Detection - Guía de Uso

La app ahora detecta automáticamente si está corriendo en la app nativa (Android/iOS) o en un navegador web. Esto permite comportamientos específicos para cada plataforma.

## Archivos creados

### `src/platformDetection.js`
Módulo base de detección de plataforma. Proporciona funciones utilitarias:

```javascript
// Funciones disponibles:
- getPlatform() → Promise<'android' | 'ios' | 'web'>
- isAndroid() → Promise<boolean>
- isIOS() → Promise<boolean>
- isNative() → Promise<boolean>
- isWeb() → Promise<boolean>
- initPlatformDetection() → Promise<void>  // Llámala al inicio
```

### `src/usePlatform.js`
Custom hook React para usar la detección en componentes:

```javascript
const { platform, isNativeApp, isAndroid, isIOS, isWeb, isLoading, error } = usePlatform();
```

## Cómo funciona ahora

### App.jsx
- Se inicializa la detección de plataforma automáticamente
- Si está en la app nativa (Android/iOS), **no muestra** la pantalla de "Descargar App"
- Si está en web, sí muestra la pantalla (como antes)

## Ejemplo: Usar en un componente

```javascript
import usePlatform from './usePlatform';

function MiComponente() {
  const { isNativeApp, isWeb, isLoading } = usePlatform();

  if (isLoading) return <div>Detectando plataforma...</div>;

  return (
    <div>
      {isNativeApp && (
        <p>Estamos en la app mobile!</p>
      )}
      {isWeb && (
        <p>Estamos en la web</p>
      )}
    </div>
  );
}
```

## Casos de uso comunes

### 1. Evitar ciertos features en web
```javascript
const { isWeb } = usePlatform();

if (isWeb) {
  // No mostrar opciones de biometría, notificaciones, etc.
}
```

### 2. Usar APIs diferentes según plataforma
```javascript
const { isAndroid } = usePlatform();

const handleShare = async () => {
  if (isAndroid) {
    // Usar Share API nativa de Capacitor
  } else {
    // Usar Web Share API
  }
};
```

### 3. Estilos condicionales
```javascript
const { isNativeApp } = usePlatform();

return (
  <div className={isNativeApp ? 'layout-mobile' : 'layout-web'}>
    {/* contenido */}
  </div>
);
```

## Testing

Para probar en diferentes plataformas:

- **App Android**: La app nativa detectará `platform = 'android'`
- **App iOS**: La app nativa detectará `platform = 'ios'`
- **Navegador**: Detectará `platform = 'web'` automáticamente

No hay cambios necesarios en el código de prueba, todo es automático.
