import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PHContext } from './PHContext';
import './AppTutorial.css';

const STEP_LIST = [
  {
    number: 0,
    title: 'Bienvenid@ al tutorial de Control de pH',
    description:
      'Este recorrido te muestra como usar el sistema de control de pH. Vas a ver cada modulo clave en orden.',
    selector: '[data-tutorial="dashboard-root"]',
    scrollTop: true,
  },
  {
    number: 1,
    title: 'Medidor de pH',
    description: 'Primero vemos el medidor principal y cada parte importante.',
    overviewDescription: 'Este es el medidor principal. Desde aca ves estado actual, objetivo y el dial visual del pH.',
    overviewDemoPhCycle: true,
    selector: '[data-tutorial="ph-meter"]',
    parts: [
      {
        title: 'Valor actual',
        description: 'Este numero grande muestra el pH medido en tiempo real.',
        selector: '[data-tutorial="ph-meter-value"]',
        showMeterSlide: 0,
      },
      {
        title: 'Estado del agua',
        description: 'Este estado te indica si el pH esta bajo, alto o dentro del rango ideal.',
        selector: '[data-tutorial="ph-meter-status"]',
        showMeterSlide: 0,
      },
      {
        title: 'Objetivo y rango ideal',
        description: 'Aca se muestran el objetivo de pH y el rango ideal configurado para controlar.',
        selector: '[data-tutorial="ph-meter-target"]',
        showMeterSlide: 0,
      },
      {
        title: 'Aguja del medidor',
        description: 'La aguja indica visualmente donde cae el pH actual dentro del dial.',
        selector: '[data-tutorial="ph-meter-gauge"]',
        showMeterSlide: 1,
      },
      {
        title: 'Indicadores de vista',
        description: 'Estos puntos te permiten cambiar entre vista de lectura y vista de medidor.',
        selector: '[data-tutorial="ph-meter-dots"]',
        showMeterSlide: 0,
      },
    ],
  },
  {
    number: 2,
    title: 'Cambio por deslizamiento',
    description: 'Observa: el medidor cambia de vista deslizando por pantalla a la izquierda o derecha.',
    selector: '[data-tutorial="ph-carousel"]',
    demo: 'swipe',
    demoPhCycle: true,
  },
  {
    number: 3,
    title: 'Escala de pH',
    description: 'Ahora vemos cada parte de la escala lineal.',
    overviewDescription:
      'Esta escala te ayuda a ubicar rapidamente el valor del pH dentro del rango total de 0 a 14.',
    overviewDemoPhCycle: true,
    selector: '[data-tutorial="ph-scale"]',
    parts: [
      {
        title: 'Cabecera de escala',
        description: 'Muestra el nombre de la escala y el valor actual del pH.',
        selector: '[data-tutorial="ph-scale-header"]',
      },
      {
        title: 'Barra completa',
        description: 'Esta barra representa todo el rango posible de pH, de 0 a 14.',
        selector: '[data-tutorial="ph-scale-track"]',
      },
      {
        title: 'Rango objetivo (zona verde)',
        description: 'Esta zona remarcada en verde muestra el rango ideal configurado para mantener el agua estable.',
        selector: '[data-tutorial="ph-scale-target"]',
      },
      {
        title: 'Marcador actual',
        description: 'El marcador vertical indica la posicion exacta del pH actual.',
        selector: '[data-tutorial="ph-scale-marker"]',
      },
      {
        title: 'Referencias 0-7-14',
        description: 'Estas referencias ayudan a interpretar si el agua esta acida, neutra o basica.',
        selector: '[data-tutorial="ph-scale-labels"]',
      },
    ],
  },
  {
    number: 4,
    title: 'Grafico de pH',
    description: 'Vamos parte por parte del grafico historico.',
    overviewDescription:
      'Este grafico te da contexto historico. Sirve para detectar tendencias y validar si el sistema corrige bien.',
    selector: '[data-tutorial="ph-chart"]',
    parts: [
      {
        title: 'Titulo y alerta',
        description: 'Arriba ves el titulo y una demo del icono de alerta alternando entre pH alto y pH bajo.',
        selector: '[data-tutorial="chart-header"]',
        demoPhCycle: true,
      },
      {
        title: 'Area del grafico',
        description: 'Aca se dibuja la curva del pH en el tiempo para seguir tendencias.',
        selector: '[data-tutorial="chart-plot"]',
      },
      {
        title: 'Lectura temporal',
        description: 'El eje horizontal representa horas y el vertical los valores de pH.',
        selector: '[data-tutorial="chart-plot"]',
      },
    ],
  },
  {
    number: 5,
    title: 'Modo automatico',
    description: 'En automatico, el sistema corrige solo. Veamos los bloques mas importantes.',
    overviewDescription:
      'Este modulo resume como esta actuando el control automatico y que decisiones esta tomando el sistema.',
    selector: '[data-tutorial="auto-module"]',
    requiredMode: 'automatic',
    parts: [
      {
        title: 'Estado general',
        description: 'Este panel te dice si el sistema esta bien, esperando o corrigiendo.',
        selector: '[data-tutorial="auto-status-head"]',
      },
      {
        title: 'Detalles de control',
        description: 'Aqui ves objetivo, pH actual y diferencia respecto del objetivo.',
        selector: '[data-tutorial="auto-status-details"]',
      },
      {
        title: 'Ultima correccion',
        description: 'Este resumen muestra que hizo el sistema y cuantas correcciones lleva hoy.',
        selector: '[data-tutorial="auto-summary"]',
      },
      {
        title: 'Funcionamiento continuo',
        description: 'Este mensaje recuerda que el sistema sigue funcionando aunque cierres la app.',
        selector: '[data-tutorial="auto-help"]',
      },
    ],
  },
  {
    number: 6,
    title: 'Modo manual',
    description: 'En manual manejas toda la dosificacion paso a paso.',
    overviewDescription:
      'En este panel vos controlas la dosificacion. Elegis producto y tiempo; el volumen se calcula automaticamente por caudal.',
    selector: '[data-tutorial="manual-module"]',
    requiredMode: 'manual',
    parts: [
      {
        title: '1. Elegir producto',
        description: 'Selecciona el producto para subir o bajar el pH.',
        selector: '[data-tutorial="manual-product"]',
      },
      {
        title: '2. Definir tiempo',
        description: 'Configura minutos y segundos de dosificado.',
        selector: '[data-tutorial="manual-time"]',
      },
      {
        title: '3. Revisar volumen automatico',
        description: 'El sistema calcula los litros segun el tiempo y el caudal de bomba configurado.',
        selector: '[data-tutorial="manual-volume"]',
      },
      {
        title: '4. Revisar estimacion',
        description: 'Si hay estimacion disponible, aca ves el pH final esperado antes de ejecutar.',
        selector: '[data-tutorial="manual-estimate"]',
      },
      {
        title: '5. Revisar conexion',
        description: 'Verifica el estado del ESP32 antes de enviar el comando.',
        selector: '[data-tutorial="manual-connection"]',
      },
      {
        title: '6. Ejecutar dosificacion',
        description: 'Presiona este boton para enviar la dosificacion manual.',
        selector: '[data-tutorial="manual-submit"]',
        scrollBlock: 'end',
      },
    ],
  },
  {
    number: 7,
    title: 'Parada de emergencia',
    description:
      'Este boton detiene el sistema de inmediato. Usalo solo en una situacion critica o de seguridad.',
    selector: '[data-tutorial="emergency-stop"]',
    scrollBlock: 'end',
  },
  {
    number: 8,
    title: 'Configuracion de usuario',
    description:
      'Desde Ajustes podes configurar objetivo y tolerancia de pH, modos, ESP32, WiFi y gestion de piscinas.',
    selector: '[data-tutorial="open-settings"]',
    scrollTop: true,
  },
];

const TUTORIAL_START_INDEX = 1;
const TOTAL_SECTIONS = STEP_LIST.filter((entry) => entry.number >= 1).length;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Patrones armónicos en SI MAYOR (octava 6)
// Cada patrón es una secuencia de notas que suenan bien juntas
const B_MAJOR_HARMONIC_PATTERNS = [
  // Patrón 1: Tríada de B mayor (B, D#, F#)
  [987.77, 1244.51, 1479.98],  // B5, D#6, F#6
  
  // Patrón 2: Pentatónica ascendente (B, C#, D#, F#, G#)
  [987.77, 1108.73, 1244.51, 1479.98, 1661.22],  // B5, C#6, D#6, F#6, G#6
  
  // Patrón 3: Quinta y octava (B, F#, B)
  [987.77, 1479.98, 1975.53],  // B5, F#6, B6
  
  // Patrón 4: Acorde de B mayor con séptima mayor (B, D#, F#, A#)
  [987.77, 1244.51, 1479.98, 1864.66],  // B5, D#6, F#6, A#6
  
  // Patrón 5: Secuencia melódica (F#, G#, B, D#)
  [1479.98, 1661.22, 1975.53, 1244.51],  // F#6, G#6, B6, D#6
];

// Índices para seguir la secuencia de notas
let currentPatternIndex = 0;
let currentNoteIndex = 0;
let isChimesMuted = false;

const playCelestialChime = () => {
  try {
    // No reproducir si el audio está muteado
    if (isChimesMuted) {
      return;
    }
    
    // Crear un nuevo contexto cada vez para permitir superposición
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Obtener el patrón actual
    const pattern = B_MAJOR_HARMONIC_PATTERNS[currentPatternIndex];
    // Obtener la nota actual del patrón
    const randomFrequency = pattern[currentNoteIndex];
    
    // Avanzar al siguiente índice
    currentNoteIndex++;
    if (currentNoteIndex >= pattern.length) {
      currentNoteIndex = 0;
      currentPatternIndex = (currentPatternIndex + 1) % B_MAJOR_HARMONIC_PATTERNS.length;
    }
    
    // Oscilador principal
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(randomFrequency, audioContext.currentTime);
    
    // Ganancia para envelope - volumen aumentado para que se escuche
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 3.5);
    
    // Reverb profundo con múltiples delays
    const delayNode1 = audioContext.createDelay();
    delayNode1.delayTime.setValueAtTime(0.08, audioContext.currentTime);
    
    const delayNode2 = audioContext.createDelay();
    delayNode2.delayTime.setValueAtTime(0.15, audioContext.currentTime);
    
    const delayNode3 = audioContext.createDelay();
    delayNode3.delayTime.setValueAtTime(0.28, audioContext.currentTime);
    
    const delayNode4 = audioContext.createDelay();
    delayNode4.delayTime.setValueAtTime(0.42, audioContext.currentTime);
    
    const feedbackGain1 = audioContext.createGain();
    feedbackGain1.gain.setValueAtTime(0.6, audioContext.currentTime);
    
    const feedbackGain2 = audioContext.createGain();
    feedbackGain2.gain.setValueAtTime(0.5, audioContext.currentTime);
    
    const feedbackGain3 = audioContext.createGain();
    feedbackGain3.gain.setValueAtTime(0.4, audioContext.currentTime);
    
    const feedbackGain4 = audioContext.createGain();
    feedbackGain4.gain.setValueAtTime(0.3, audioContext.currentTime);
    
    const reverbGain = audioContext.createGain();
    reverbGain.gain.setValueAtTime(0.85, audioContext.currentTime);
    
    // Filtro pasa-bajos para sonido opaco
    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, audioContext.currentTime);
    filter.Q.setValueAtTime(0.5, audioContext.currentTime);
    
    // Conexiones
    oscillator.connect(gainNode);
    gainNode.connect(filter);
    filter.connect(audioContext.destination);
    
    // Cadena de reverb múltiple
    filter.connect(delayNode1);
    delayNode1.connect(feedbackGain1);
    feedbackGain1.connect(delayNode1);
    
    delayNode1.connect(delayNode2);
    delayNode2.connect(feedbackGain2);
    feedbackGain2.connect(delayNode2);
    
    delayNode2.connect(delayNode3);
    delayNode3.connect(feedbackGain3);
    feedbackGain3.connect(delayNode3);
    
    delayNode3.connect(delayNode4);
    delayNode4.connect(feedbackGain4);
    feedbackGain4.connect(delayNode4);
    
    delayNode1.connect(reverbGain);
    delayNode2.connect(reverbGain);
    delayNode3.connect(reverbGain);
    delayNode4.connect(reverbGain);
    reverbGain.connect(audioContext.destination);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 3.5);
    
    // Limpiar después - no bloquea la creación de nuevos sonidos
    setTimeout(() => {
      try {
        audioContext.close();
      } catch (e) {
        // Ignorar errores al cerrar
      }
    }, 4500);
  } catch (error) {
    console.warn('[Tutorial] No se pudo reproducir sonido:', error);
  }
};

const AUDIO_FILE_PATH = '/tutorial-ambient.mp3';
const AUDIO_TARGET_VOLUME = 0.02; // 2% del volumen máximo (reducido de 3%)
const AUDIO_FADE_IN_MS = 2200;
const AUDIO_FADE_OUT_MS = 7000;
const YOUTUBE_VIDEO_LINK = 'https://youtu.be/PQjgO6SIOas?si=3HKK1hR8LkM6cYEl';
const TUTORIAL_CLOSE_FADE_MS = 320;
const SMALL_TARGET_MAX_HEIGHT = 190;
const SMALL_TARGET_MAX_VIEWPORT_RATIO = 0.28;
const SMALL_TARGET_VIEWPORT_ANCHOR = 0.42;
const TOP_TARGET_MIN_VIEWPORT_OFFSET = 74;
const SCROLL_BLOCK_KEYS = new Set([
  ' ',
  'Spacebar',
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
]);

const buildStepParts = (step) => {
  if (!step?.parts?.length) return [];

  return [
    {
      title: `Vista general: ${step.title}`,
      description: step.overviewDescription || step.description,
      selector: step.selector,
      showMeterSlide: step.showMeterSlide,
      demoPhCycle: step.overviewDemoPhCycle,
      isOverview: true,
    },
    ...step.parts,
  ];
};

const getSpotlightRect = (element) => {
  if (!element) return null;

  const padding = 10;
  const rect = element.getBoundingClientRect();
  const top = Math.max(8, rect.top - padding);
  const left = Math.max(8, rect.left - padding);
  const maxWidth = Math.max(0, window.innerWidth - left - 8);
  const maxHeight = Math.max(0, window.innerHeight - top - 8);

  return {
    top,
    left,
    width: Math.min(rect.width + padding * 2, maxWidth),
    height: Math.min(rect.height + padding * 2, maxHeight),
  };
};

const resolveCardAnchor = (targetRect, cardHeight, margin = 10) => {
  if (!targetRect) {
    return 'bottom';
  }

  const viewportHeight = window.innerHeight;
  const availableTop = Math.max(0, targetRect.top - margin);
  const availableBottom = Math.max(0, viewportHeight - (targetRect.top + targetRect.height) - margin);
  const requiredSpace = cardHeight + 14;

  if (availableBottom >= requiredSpace) {
    return 'bottom';
  }
  if (availableTop >= requiredSpace) {
    return 'top';
  }

  return availableBottom >= availableTop ? 'bottom' : 'top';
};

const getCardPlacement = (targetRect, cardWidth, cardHeight, anchorOverride = null) => {
  const margin = 10;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const centeredLeft = clamp((viewportWidth - cardWidth) / 2, margin, viewportWidth - cardWidth - margin);

  if (!targetRect) {
    return {
      anchor: 'bottom',
      top: clamp(viewportHeight - cardHeight - margin, margin, viewportHeight - cardHeight - margin),
      left: centeredLeft,
    };
  }

  const resolvedAnchor = anchorOverride || resolveCardAnchor(targetRect, cardHeight, margin);
  const shouldPinToTop = resolvedAnchor === 'top';

  return {
    anchor: resolvedAnchor,
    top: shouldPinToTop ? margin : clamp(viewportHeight - cardHeight - margin, margin, viewportHeight - cardHeight - margin),
    left: centeredLeft,
  };
};

const getConnectorPoints = (cardPosition, cardWidth, cardHeight, targetRect) => {
  if (!cardPosition || !targetRect) return null;

  const cardCenterX = cardPosition.left + cardWidth / 2;
  const cardCenterY = cardPosition.top + cardHeight / 2;
  const targetCenterX = targetRect.left + targetRect.width / 2;
  const targetCenterY = targetRect.top + targetRect.height / 2;

  const toTargetX = targetCenterX - cardCenterX;
  const toTargetY = targetCenterY - cardCenterY;

  let fromX = cardCenterX;
  let fromY = cardCenterY;

  if (Math.abs(toTargetX) > Math.abs(toTargetY)) {
    fromX = toTargetX > 0 ? cardPosition.left + cardWidth : cardPosition.left;
    fromY = clamp(targetCenterY, cardPosition.top + 12, cardPosition.top + cardHeight - 12);
  } else {
    fromY = toTargetY > 0 ? cardPosition.top + cardHeight : cardPosition.top;
    fromX = clamp(targetCenterX, cardPosition.left + 12, cardPosition.left + cardWidth - 12);
  }

  const toCardX = cardCenterX - targetCenterX;
  const toCardY = cardCenterY - targetCenterY;

  let toX = targetCenterX;
  let toY = targetCenterY;

  if (Math.abs(toCardX) > Math.abs(toCardY)) {
    toX = toCardX > 0 ? targetRect.left + targetRect.width : targetRect.left;
    toY = clamp(fromY, targetRect.top + 10, targetRect.top + targetRect.height - 10);
  } else {
    toY = toCardY > 0 ? targetRect.top + targetRect.height : targetRect.top;
    toX = clamp(fromX, targetRect.left + 10, targetRect.left + targetRect.width - 10);
  }

  return { fromX, fromY, toX, toY };
};

const isElementScrollable = (element) => {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
  const canScrollX = /(auto|scroll|overlay)/.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
  return canScrollX || canScrollY;
};

const collectScrollableElements = () => {
  const all = Array.from(document.querySelectorAll('*'));
  return all.filter((node) => isElementScrollable(node));
};

const isInViewport = (element, margin = 12) => {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.top >= margin && rect.bottom <= window.innerHeight - margin;
};

const isSmallTutorialTarget = (element) => {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.height <= 0) {
    return false;
  }

  const ratio = rect.height / Math.max(window.innerHeight, 1);
  return rect.height <= SMALL_TARGET_MAX_HEIGHT || ratio <= SMALL_TARGET_MAX_VIEWPORT_RATIO;
};

const AppTutorial = ({ isOpen, onClose, onDemoPhChange, onHeaderVisibilityChange }) => {
  const { dosingMode, setDosingMode, phTolerance, phToleranceRange } = useContext(PHContext);
  const cardRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const youtubeVolumeIntervalRef = useRef(null);
  const trackBadgeTimeoutRef = useRef(null);
  const demoPhIntervalRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const isAudioMutedRef = useRef(false);
  const isProgrammaticScrollRef = useRef(false);
  const cardAnchorRef = useRef(null);
  const lockedWindowScrollRef = useRef({ x: 0, y: 0 });
  const lockedElementScrollRef = useRef(new WeakMap());
  const scrollableElementsRef = useRef([]);

  const [stepIndex, setStepIndex] = useState(TUTORIAL_START_INDEX);
  const [partIndex, setPartIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [cardPosition, setCardPosition] = useState(null);
  const [connectorPoints, setConnectorPoints] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [needsAudioInteraction, setNeedsAudioInteraction] = useState(false);
  const [showTrackBadge, setShowTrackBadge] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const step = STEP_LIST[stepIndex];
  const parts = useMemo(() => buildStepParts(step), [step]);
  const hasParts = parts.length > 0;
  const activePart = hasParts ? parts[Math.min(partIndex, parts.length - 1)] : null;
  const activeSelector = activePart?.selector || step?.selector;
  const activeSlide = activePart?.showMeterSlide ?? step?.showMeterSlide;
  const activeDemoPhCycle = Boolean(activePart?.demoPhCycle || (!hasParts && step?.demoPhCycle));
  const activeScrollPreference = activePart?.scrollBlock ?? step?.scrollBlock ?? null;
  const activeScrollBlock = activeScrollPreference || 'start';

  const panelTitle = activePart?.title || step?.title;
  const panelDescription = activePart?.description || step?.description;

  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
    isChimesMuted = isAudioMuted;
  }, [isAudioMuted]);

  const syncScrollLockSnapshot = useCallback(() => {
    lockedWindowScrollRef.current = {
      x: window.scrollX,
      y: window.scrollY,
    };

    const scrollables = collectScrollableElements();
    scrollableElementsRef.current = scrollables;
    const nextMap = new WeakMap();

    scrollables.forEach((element) => {
      nextMap.set(element, {
        top: element.scrollTop,
        left: element.scrollLeft,
      });
    });

    lockedElementScrollRef.current = nextMap;
  }, []);

  const runProgrammaticScroll = useCallback(
    async (scrollAction, waitMs = 280) => {
      isProgrammaticScrollRef.current = true;
      try {
        scrollAction();
        await wait(waitMs);
        syncScrollLockSnapshot();
      } finally {
        isProgrammaticScrollRef.current = false;
      }
    },
    [syncScrollLockSnapshot]
  );

  const clearDemoPhCycle = useCallback(() => {
    if (demoPhIntervalRef.current) {
      window.clearInterval(demoPhIntervalRef.current);
      demoPhIntervalRef.current = null;
    }
    if (onDemoPhChange) {
      onDemoPhChange(null);
    }
  }, [onDemoPhChange]);

  const clearAudioFadeInterval = useCallback(() => {
    if (youtubeVolumeIntervalRef.current) {
      window.clearInterval(youtubeVolumeIntervalRef.current);
      youtubeVolumeIntervalRef.current = null;
    }
  }, []);

  const ensureAudioPlayer = useCallback(() => {
    if (youtubePlayerRef.current) {
      return youtubePlayerRef.current;
    }

    const audio = new Audio(AUDIO_FILE_PATH);
    audio.loop = true;
    audio.volume = 0;
    youtubePlayerRef.current = audio;
    return audio;
  }, []);

  const fadeAudioTo = useCallback(
    (targetVolume, durationMs, onComplete) => {
      const audio = youtubePlayerRef.current;
      if (!audio) {
        if (onComplete) onComplete();
        return;
      }

      clearAudioFadeInterval();

      const startVolume = audio.volume;
      const delta = targetVolume - startVolume;

      if (Math.abs(delta) < 0.01 || durationMs <= 0) {
        audio.volume = clamp(targetVolume, 0, 1);
        if (onComplete) onComplete();
        return;
      }

      const stepMs = 60;
      const totalSteps = Math.max(1, Math.round(durationMs / stepMs));
      let currentStep = 0;

      youtubeVolumeIntervalRef.current = window.setInterval(() => {
        currentStep += 1;
        const progress = currentStep / totalSteps;
        const nextVolume = clamp(startVolume + delta * progress, 0, 1);
        audio.volume = nextVolume;

        if (currentStep >= totalSteps) {
          clearAudioFadeInterval();
          audio.volume = clamp(targetVolume, 0, 1);
          if (onComplete) onComplete();
        }
      }, stepMs);
    },
    [clearAudioFadeInterval]
  );

  const startAudioAmbient = useCallback(async () => {
    try {
      const audio = ensureAudioPlayer();
      clearAudioFadeInterval();

      audio.volume = 0;
      if (!isAudioMutedRef.current) {
        audio.muted = false;
      }

      const playPromise = audio.play();
      
      if (playPromise !== undefined) {
        await playPromise;
      }

      await wait(200);

      setNeedsAudioInteraction(false);
      if (isAudioMutedRef.current) {
        audio.muted = true;
        audio.volume = 0;
      } else {
        audio.muted = false;
        fadeAudioTo(AUDIO_TARGET_VOLUME, AUDIO_FADE_IN_MS);
      }
      return true;
    } catch (error) {
      console.warn('[Tutorial] No se pudo iniciar audio:', error);
      setNeedsAudioInteraction(true);
      return false;
    }
  }, [clearAudioFadeInterval, ensureAudioPlayer, fadeAudioTo]);

  const stopAudioAmbient = useCallback(
    (withFade) => {
      const audio = youtubePlayerRef.current;
      if (!audio) return;

      setNeedsAudioInteraction(false);

      if (withFade) {
        fadeAudioTo(0, AUDIO_FADE_OUT_MS, () => {
          audio.pause();
        });
        return;
      }

      clearAudioFadeInterval();
      audio.volume = 0;
      audio.pause();
    },
    [clearAudioFadeInterval, fadeAudioTo]
  );

  const toggleAudioMute = useCallback(() => {
    setIsAudioMuted((previous) => {
      const next = !previous;
      const audio = youtubePlayerRef.current;

      if (!audio) {
        return next;
      }

      clearAudioFadeInterval();

      if (next) {
        audio.muted = true;
        audio.volume = 0;
      } else {
        audio.muted = false;
        audio.play().catch(() => {});
        fadeAudioTo(AUDIO_TARGET_VOLUME, 380);
      }

      return next;
    });
  }, [clearAudioFadeInterval, fadeAudioTo]);

  const handleCloseWithFade = useCallback(
    (reason) => {
      if (isClosing) {
        return;
      }

      setIsClosing(true);
      setShowTrackBadge(false);
      stopAudioAmbient(true);

      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }

      closeTimeoutRef.current = window.setTimeout(() => {
        onClose(reason);
      }, TUTORIAL_CLOSE_FADE_MS);
    },
    [isClosing, onClose, stopAudioAmbient]
  );

  const findTargetElement = useCallback(() => {
    if (activeSelector) {
      const primary = document.querySelector(activeSelector);
      if (primary) return primary;
    }

    if (step?.selector && step.selector !== activeSelector) {
      const stepTarget = document.querySelector(step.selector);
      if (stepTarget) return stepTarget;
    }

    return document.querySelector('[data-tutorial="dashboard-root"]');
  }, [activeSelector, step?.selector]);

  const syncMeterSlide = useCallback(async (slideIndexToShow) => {
    if (slideIndexToShow !== 0 && slideIndexToShow !== 1) {
      return;
    }

    const meter = document.querySelector('[data-tutorial="ph-meter"]');
    if (!meter) {
      return;
    }

    const dots = Array.from(meter.querySelectorAll('.ph-dot'));
    const button = dots[slideIndexToShow];

    if (!button) {
      return;
    }

    button.click();
    await wait(340);
  }, []);

  const updateSpotlightForCurrentPart = useCallback(() => {
    if (!isOpen) {
      setSpotlightRect(null);
      return;
    }

    const element = findTargetElement();
    if (!element) {
      setSpotlightRect(null);
      return;
    }

    setSpotlightRect(getSpotlightRect(element));
  }, [findTargetElement, isOpen]);

  const updateCardPlacement = useCallback(() => {
    if (!isOpen || !cardRef.current) {
      return;
    }

    const cardRect = cardRef.current.getBoundingClientRect();
    const nextPosition = getCardPlacement(
      spotlightRect,
      cardRect.width,
      cardRect.height,
      cardAnchorRef.current
    );

    if (!cardAnchorRef.current) {
      cardAnchorRef.current = nextPosition.anchor;
    }

    setCardPosition((previous) => {
      if (
        previous &&
        Math.abs(previous.top - nextPosition.top) < 1 &&
        Math.abs(previous.left - nextPosition.left) < 1
      ) {
        return previous;
      }
      return nextPosition;
    });

    setConnectorPoints(getConnectorPoints(nextPosition, cardRect.width, cardRect.height, spotlightRect));
  }, [isOpen, spotlightRect]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    cardAnchorRef.current = null;
  }, [isOpen, stepIndex, partIndex]);

  useEffect(() => {
    if (!isOpen) return;
    setIsClosing(false);
    setIsAudioMuted(false);
    cardAnchorRef.current = null;
    setStepIndex(TUTORIAL_START_INDEX);
    setPartIndex(0);
    setCardPosition(null);
    setConnectorPoints(null);
  }, [isOpen]);

  useEffect(() => {
    if (!onHeaderVisibilityChange) {
      return undefined;
    }

    if (!isOpen) {
      onHeaderVisibilityChange(false);
      return undefined;
    }

    onHeaderVisibilityChange(step?.number === 8);

    return () => {
      onHeaderVisibilityChange(false);
    };
  }, [isOpen, onHeaderVisibilityChange, step?.number]);

  useEffect(() => {
    const preventPointerScroll = (event) => {
      if (isProgrammaticScrollRef.current) {
        return;
      }
      event.preventDefault();
    };

    const preventScrollKeys = (event) => {
      if (isProgrammaticScrollRef.current || !SCROLL_BLOCK_KEYS.has(event.key)) {
        return;
      }
      event.preventDefault();
    };

    const lockUnexpectedScroll = (event) => {
      if (isProgrammaticScrollRef.current) {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const savedPosition = lockedElementScrollRef.current.get(target);
        if (savedPosition) {
          if (target.scrollTop !== savedPosition.top) {
            target.scrollTop = savedPosition.top;
          }
          if (target.scrollLeft !== savedPosition.left) {
            target.scrollLeft = savedPosition.left;
          }
          return;
        }
      }

      const { x, y } = lockedWindowScrollRef.current;
      if (window.scrollX !== x || window.scrollY !== y) {
        window.scrollTo({ left: x, top: y, behavior: 'auto' });
      }
    };

    if (!isOpen) {
      return undefined;
    }

    syncScrollLockSnapshot();
    document.addEventListener('wheel', preventPointerScroll, { passive: false, capture: true });
    document.addEventListener('touchmove', preventPointerScroll, { passive: false, capture: true });
    window.addEventListener('keydown', preventScrollKeys, { capture: true });
    window.addEventListener('scroll', lockUnexpectedScroll, true);

    return () => {
      document.removeEventListener('wheel', preventPointerScroll, true);
      document.removeEventListener('touchmove', preventPointerScroll, true);
      window.removeEventListener('keydown', preventScrollKeys, true);
      window.removeEventListener('scroll', lockUnexpectedScroll, true);
    };
  }, [isOpen, syncScrollLockSnapshot]);

  useEffect(() => {
    if (trackBadgeTimeoutRef.current) {
      window.clearTimeout(trackBadgeTimeoutRef.current);
      trackBadgeTimeoutRef.current = null;
    }

    if (!isOpen) {
      setShowTrackBadge(false);
      return;
    }

    setShowTrackBadge(true);
    trackBadgeTimeoutRef.current = window.setTimeout(() => {
      setShowTrackBadge(false);
    }, 5000);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      startAudioAmbient();
      return undefined;
    }

    stopAudioAmbient(true);
    return undefined;
  }, [isOpen, startAudioAmbient, stopAudioAmbient]);

  useEffect(() => {
    if (!isOpen || !needsAudioInteraction) return undefined;

    const unlockAudio = () => {
      startAudioAmbient();
    };

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [isOpen, needsAudioInteraction, startAudioAmbient]);

  useEffect(
    () => () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
      clearDemoPhCycle();
      stopAudioAmbient(false);
      clearAudioFadeInterval();
      if (trackBadgeTimeoutRef.current) {
        window.clearTimeout(trackBadgeTimeoutRef.current);
      }
      if (youtubePlayerRef.current) {
        youtubePlayerRef.current.pause();
        youtubePlayerRef.current = null;
      }
    },
    [clearDemoPhCycle, clearAudioFadeInterval, stopAudioAmbient]
  );

  useEffect(() => {
    clearDemoPhCycle();

    if (!isOpen || !activeDemoPhCycle || !onDemoPhChange) {
      return undefined;
    }

    const highPh = clamp(phTolerance + phToleranceRange + 0.45, 0, 14);
    const lowPh = clamp(phTolerance - phToleranceRange - 0.45, 0, 14);
    let showHigh = true;

    onDemoPhChange(highPh);

    demoPhIntervalRef.current = window.setInterval(() => {
      showHigh = !showHigh;
      onDemoPhChange(showHigh ? highPh : lowPh);
    }, 1600);

    return () => {
      clearDemoPhCycle();
    };
  }, [activeDemoPhCycle, clearDemoPhCycle, isOpen, onDemoPhChange, phTolerance, phToleranceRange]);

  useEffect(() => {
    if (!isOpen || !step) return undefined;

    let cancelled = false;

    const prepareStep = async () => {
      setIsPreparing(true);
      try {
        if (step.scrollTop) {
          await runProgrammaticScroll(() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }, 560);
        }

        if (step.requiredMode && dosingMode !== step.requiredMode) {
          try {
            await setDosingMode(step.requiredMode);
            await wait(320);
          } catch (error) {
            console.error('[Tutorial] No se pudo cambiar el modo:', error);
          }
        }

        if (activeSlide === 0 || activeSlide === 1) {
          await syncMeterSlide(activeSlide);
        }

        let targetElement = null;
        for (let attempt = 0; attempt < 25; attempt += 1) {
          if (cancelled) return;

          targetElement = findTargetElement();
          if (targetElement) break;
          await wait(120);
        }

        if (cancelled) return;

        if (targetElement) {
          const alignTarget = async (behavior) => {
            const useSmallTargetAnchor = !activeScrollPreference && isSmallTutorialTarget(targetElement);

            await runProgrammaticScroll(() => {
              if (useSmallTargetAnchor) {
                const rect = targetElement.getBoundingClientRect();
                const targetCenter = rect.top + rect.height / 2;
                const desiredCenter = window.innerHeight * SMALL_TARGET_VIEWPORT_ANCHOR;
                const delta = targetCenter - desiredCenter;

                window.scrollTo({
                  top: Math.max(0, window.scrollY + delta),
                  behavior,
                });
                return;
              }

              targetElement.scrollIntoView({
                behavior,
                block: activeScrollBlock,
                inline: 'nearest',
              });
            }, behavior === 'smooth' ? 560 : 140);
          };

          const nudgeTargetDownIfTooHigh = async () => {
            const rect = targetElement.getBoundingClientRect();
            const delta = TOP_TARGET_MIN_VIEWPORT_OFFSET - rect.top;

            if (delta <= 6) {
              return;
            }

            await runProgrammaticScroll(() => {
              window.scrollTo({
                top: Math.max(0, window.scrollY - delta),
                behavior: 'auto',
              });
            }, 140);
          };

          await alignTarget('smooth');
          await nudgeTargetDownIfTooHigh();

          if (!isInViewport(targetElement, 12)) {
            await alignTarget('auto');
            await nudgeTargetDownIfTooHigh();
          }
        }

        updateSpotlightForCurrentPart();
      } catch (error) {
        console.error('[Tutorial] Error preparando paso:', error);
      } finally {
        if (!cancelled) {
          setIsPreparing(false);
        }
      }
    };

    prepareStep();

    return () => {
      cancelled = true;
    };
  }, [
    activeScrollPreference,
    activeSlide,
    activeScrollBlock,
    dosingMode,
    findTargetElement,
    isOpen,
    partIndex,
    setDosingMode,
    step,
    stepIndex,
    runProgrammaticScroll,
    syncMeterSlide,
    updateSpotlightForCurrentPart,
  ]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleViewportUpdate = () => {
      window.requestAnimationFrame(() => {
        updateSpotlightForCurrentPart();
      });
    };

    window.addEventListener('resize', handleViewportUpdate);
    window.addEventListener('scroll', handleViewportUpdate, true);

    return () => {
      window.removeEventListener('resize', handleViewportUpdate);
      window.removeEventListener('scroll', handleViewportUpdate, true);
    };
  }, [isOpen, updateSpotlightForCurrentPart]);

  useEffect(() => {
    if (!isOpen) return;

    const raf = window.requestAnimationFrame(() => {
      updateCardPlacement();
    });

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [isOpen, spotlightRect, stepIndex, partIndex, panelDescription, updateCardPlacement]);

  useEffect(() => {
    if (!isOpen || step?.demo !== 'swipe') {
      return undefined;
    }

    let cancelled = false;
    let nextSlide = 1;

    const runDemo = async () => {
      await wait(400);

      while (!cancelled) {
        await syncMeterSlide(nextSlide);
        nextSlide = nextSlide === 1 ? 0 : 1;
        await wait(1300);
      }
    };

    runDemo();

    return () => {
      cancelled = true;
      syncMeterSlide(0);
    };
  }, [isOpen, step?.demo, syncMeterSlide]);

  const isLastStep = useMemo(() => stepIndex === STEP_LIST.length - 1, [stepIndex]);
  const hasNextPart = hasParts && partIndex < parts.length - 1;
  const canGoBack = !(stepIndex === TUTORIAL_START_INDEX && (!hasParts || partIndex === 0));

  if (!isOpen || !step) {
    return null;
  }

  return (
    <div
      className={`tutorial-overlay ${isClosing ? 'is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial de uso"
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
    >
      {!spotlightRect && <div className="tutorial-full-shade" />}

      {showTrackBadge && (
        <a
          className="tutorial-track-badge"
          href={YOUTUBE_VIDEO_LINK}
          target="_blank"
          rel="noopener noreferrer"
          title="Abrir video en YouTube"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M23.498 6.186a2.99 2.99 0 0 0-2.103-2.115C19.544 3.6 12 3.6 12 3.6s-7.544 0-9.395.471A2.99 2.99 0 0 0 .502 6.186 31.44 31.44 0 0 0 0 12a31.44 31.44 0 0 0 .502 5.814 2.99 2.99 0 0 0 2.103 2.115C4.456 20.4 12 20.4 12 20.4s7.544 0 9.395-.471a2.99 2.99 0 0 0 2.103-2.115A31.44 31.44 0 0 0 24 12a31.44 31.44 0 0 0-.502-5.814zM9.6 15.6V8.4l6.4 3.6-6.4 3.6z"
            />
          </svg>
          <span>Ambient PAD B | Worship Drone Pads</span>
        </a>
      )}

      {spotlightRect && (
        <div
          className="tutorial-spotlight"
          style={{
            top: `${spotlightRect.top}px`,
            left: `${spotlightRect.left}px`,
            width: `${spotlightRect.width}px`,
            height: `${spotlightRect.height}px`,
          }}
        />
      )}

      {connectorPoints && (
        <svg className="tutorial-connector" viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}>
          <defs>
            <marker id="tutorial-arrow-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="rgba(103, 232, 249, 0.95)" />
            </marker>
          </defs>
          <line
            x1={connectorPoints.fromX}
            y1={connectorPoints.fromY}
            x2={connectorPoints.toX}
            y2={connectorPoints.toY}
            markerEnd="url(#tutorial-arrow-head)"
          />
        </svg>
      )}

      {step.demo === 'swipe' && spotlightRect && (
        <div
          className="tutorial-swipe-demo"
          style={{
            top: `${spotlightRect.top + spotlightRect.height - 34}px`,
            left: `${spotlightRect.left + 18}px`,
            width: `${Math.max(110, spotlightRect.width - 36)}px`,
          }}
        >
          <div className="tutorial-swipe-track">
            <span className="tutorial-swipe-finger" />
          </div>
        </div>
      )}

      <aside
        ref={cardRef}
        className={`tutorial-card ${cardPosition ? 'is-positioned' : ''}`}
        style={
          cardPosition
            ? {
                top: `${cardPosition.top}px`,
                left: `${cardPosition.left}px`,
              }
            : undefined
        }
      >
        <button
          type="button"
          className="tutorial-audio-toggle"
          onClick={toggleAudioMute}
          aria-label={isAudioMuted ? 'Activar sonido ambiental' : 'Silenciar sonido ambiental'}
          title={isAudioMuted ? 'Activar sonido' : 'Silenciar sonido'}
        >
          {isAudioMuted ? (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M16.5 12L21 16.5 19.5 18 15 13.5 10.5 18H9v-3.5L6.5 12H3v-2h3.5L9 7.5V4h1.5L15 8.5 19.5 4 21 5.5z"
              />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.06A4.49 4.49 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71 0 3.17-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77 0-4.28-2.99-7.86-7-8.77z"
              />
            </svg>
          )}
        </button>

        <p className="tutorial-step-counter">Sección {step.number} de {TOTAL_SECTIONS}</p>

        <h3>{panelTitle}</h3>
        <p>{panelDescription}</p>

        <div className="tutorial-actions">
          <button
            type="button"
            className="tutorial-btn tutorial-btn--ghost"
            onClick={() => {
              playCelestialChime();
              handleCloseWithFade('skipped');
            }}
          >
            Omitir
          </button>

          <div className="tutorial-main-actions">
            <button
              type="button"
              className="tutorial-btn tutorial-btn--ghost"
              onClick={() => {
                playCelestialChime();
                if (!canGoBack || isPreparing) {
                  return;
                }

                if (hasParts && partIndex > 0) {
                  setPartIndex((prev) => prev - 1);
                  return;
                }

                const previousStepIndex = Math.max(TUTORIAL_START_INDEX, stepIndex - 1);
                const previousParts = buildStepParts(STEP_LIST[previousStepIndex]);
                setStepIndex(previousStepIndex);
                setPartIndex(previousParts.length > 0 ? previousParts.length - 1 : 0);
              }}
              disabled={!canGoBack || isPreparing}
            >
              Anterior
            </button>

            <button
              type="button"
              className="tutorial-btn tutorial-btn--primary"
              onClick={() => {
                playCelestialChime();
                if (isPreparing) {
                  return;
                }

                if (hasNextPart) {
                  setPartIndex((prev) => prev + 1);
                  return;
                }

                if (isLastStep) {
                  handleCloseWithFade('completed');
                  return;
                }

                setStepIndex((prev) => Math.min(STEP_LIST.length - 1, prev + 1));
                setPartIndex(0);
              }}
              disabled={isPreparing}
            >
              {isLastStep && !hasNextPart ? 'Finalizar' : hasNextPart ? 'Siguiente parte' : 'Siguiente'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default AppTutorial;
