/**
 * Utilidades para Optimización de Performance y Core Web Vitals
 * LCP, INP, CLS optimization
 */

/**
 * Debounce function para optimizar eventos frecuentes
 * @param {Function} func - Función a ejecutar
 * @param {number} wait - Tiempo de espera en ms
 * @returns {Function}
 */
export const debounce = (func, wait = 300) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function para limitar ejecuciones
 * @param {Function} func - Función a ejecutar
 * @param {number} limit - Límite de tiempo en ms
 * @returns {Function}
 */
export const throttle = (func, limit = 300) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Request Idle Callback polyfill
 * @param {Function} callback
 * @param {Object} options
 */
export const requestIdleCallback = window.requestIdleCallback || function(callback, options) {
  const start = Date.now();
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
    });
  }, 1);
};

/**
 * Cancel Idle Callback polyfill
 * @param {number} id
 */
export const cancelIdleCallback = window.cancelIdleCallback || function(id) {
  clearTimeout(id);
};

/**
 * Ejecuta tareas en idle time
 * @param {Function} task - Tarea a ejecutar
 * @param {Object} options - Opciones
 */
export const runInIdleTime = (task, options = {}) => {
  return requestIdleCallback(task, options);
};

/**
 * Memoización simple para funciones costosas
 * @param {Function} fn - Función a memoizar
 * @returns {Function}
 */
export const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

/**
 * Prefetch de recursos
 * @param {string} url - URL del recurso
 * @param {string} as - Tipo de recurso
 */
export const prefetchResource = (url, as = 'fetch') => {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.as = as;
  link.href = url;
  document.head.appendChild(link);
};

/**
 * Preconnect a dominios externos
 * @param {string} url - URL del dominio
 */
export const preconnect = (url) => {
  const link = document.createElement('link');
  link.rel = 'preconnect';
  link.href = url;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
};

/**
 * Optimización de scroll con passive listeners
 * @param {Element} element - Elemento
 * @param {Function} handler - Handler del evento
 */
export const addPassiveScrollListener = (element, handler) => {
  element.addEventListener('scroll', handler, { passive: true });
};

/**
 * Detecta si el usuario prefiere reduced motion
 * @returns {boolean}
 */
export const prefersReducedMotion = () => {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Optimiza animaciones según preferencias del usuario
 * @param {Function} animationFn - Función de animación
 * @param {Function} fallbackFn - Función fallback sin animación
 */
export const optimizeAnimation = (animationFn, fallbackFn) => {
  if (prefersReducedMotion()) {
    fallbackFn();
  } else {
    animationFn();
  }
};

/**
 * Monitoreo de Core Web Vitals
 */
export const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    import('web-vitals').then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
      onCLS(onPerfEntry);
      onINP(onPerfEntry);
      onLCP(onPerfEntry);
      onFCP(onPerfEntry);
      onTTFB(onPerfEntry);
    }).catch(() => {
      // Fallback si web-vitals no está disponible
      console.log('Web Vitals library not available');
    });
  }
};

/**
 * Optimización de re-renders con shallow comparison
 * @param {Object} prevProps
 * @param {Object} nextProps
 * @returns {boolean}
 */
export const shallowEqual = (prevProps, nextProps) => {
  const keys1 = Object.keys(prevProps);
  const keys2 = Object.keys(nextProps);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (let key of keys1) {
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }

  return true;
};

/**
 * Batch de actualizaciones de estado
 * @param {Function[]} updates - Array de funciones de actualización
 */
export const batchUpdates = (updates) => {
  // React 18+ automáticamente hace batch de updates
  // Esta función es para compatibilidad
  updates.forEach(update => update());
};

/**
 * Detecta conexión lenta
 * @returns {boolean}
 */
export const isSlowConnection = () => {
  if ('connection' in navigator) {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection.effectiveType === 'slow-2g' || 
           connection.effectiveType === '2g' ||
           connection.saveData === true;
  }
  return false;
};

/**
 * Carga condicional basada en conexión
 * @param {Function} heavyTask - Tarea pesada
 * @param {Function} lightTask - Tarea ligera
 */
export const conditionalLoad = (heavyTask, lightTask) => {
  if (isSlowConnection()) {
    lightTask();
  } else {
    heavyTask();
  }
};

/**
 * Optimización de localStorage con compresión
 * @param {string} key
 * @param {any} value
 */
export const setCompressedItem = (key, value) => {
  try {
    const jsonString = JSON.stringify(value);
    // Simple compression: remove whitespace
    const compressed = jsonString.replace(/\s+/g, '');
    localStorage.setItem(key, compressed);
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }
};

/**
 * Obtiene item comprimido de localStorage
 * @param {string} key
 * @returns {any}
 */
export const getCompressedItem = (key) => {
  try {
    const compressed = localStorage.getItem(key);
    if (!compressed) return null;
    return JSON.parse(compressed);
  } catch (e) {
    console.error('Error reading from localStorage:', e);
    return null;
  }
};

/**
 * Limpia cache antiguo
 * @param {number} maxAge - Edad máxima en ms
 */
export const cleanOldCache = (maxAge = 7 * 24 * 60 * 60 * 1000) => {
  const now = Date.now();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('cache_')) {
      try {
        const item = JSON.parse(localStorage.getItem(key));
        if (item.timestamp && (now - item.timestamp) > maxAge) {
          localStorage.removeItem(key);
        }
      } catch (e) {
        // Ignorar errores de parsing
      }
    }
  }
};

/**
 * Inicializa optimizaciones de performance
 */
export const initPerformanceOptimizations = () => {
  // Preconnect a dominios críticos
  preconnect('https://firebasestorage.googleapis.com');
  preconnect('https://fonts.googleapis.com');
  
  // Limpia cache antiguo
  runInIdleTime(() => cleanOldCache());
  
  // Reporta Web Vitals
  reportWebVitals((metric) => {
    console.log(`[Web Vitals] ${metric.name}:`, metric.value);
    
    // Enviar a analytics si está configurado
    if (window.gtag) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
        event_category: 'Web Vitals',
        event_label: metric.id,
        non_interaction: true,
      });
    }
  });
};
