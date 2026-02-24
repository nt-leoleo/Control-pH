import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PHContext } from './PHContext';
import './AppTutorial.css';

const STEP_LIST = [
  {
    number: 0,
    title: 'Bienvenida',
    description:
      'Este recorrido te muestra como usar el sistema de control de pH. Vas a ver cada modulo clave en orden.',
    selector: '[data-tutorial="dashboard-root"]',
    scrollTop: true,
  },
  {
    number: 1,
    title: 'Medidor de pH',
    description: 'Primero vemos el medidor principal y cada parte importante.',
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
    description: 'Mira la demo: el medidor cambia de vista con un deslizamiento horizontal suave.',
    selector: '[data-tutorial="ph-carousel"]',
    demo: 'swipe',
  },
  {
    number: 3,
    title: 'Escala de pH',
    description: 'Ahora vemos cada parte de la escala lineal.',
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
        title: 'Rango objetivo',
        description: 'Esta zona remarcada muestra el rango ideal configurado para mantener el agua estable.',
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
    selector: '[data-tutorial="ph-chart"]',
    parts: [
      {
        title: 'Titulo y alerta',
        description: 'Arriba ves el titulo del grafico y el icono de alerta cuando hay desvio.',
        selector: '[data-tutorial="chart-header"]',
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
        title: '3. Definir litros',
        description: 'Indica cuantos litros queres dosificar en esta accion.',
        selector: '[data-tutorial="manual-liters"]',
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
      },
    ],
  },
  {
    number: 7,
    title: 'Parada de emergencia',
    description:
      'Este boton detiene el sistema de inmediato. Usalo solo en una situacion critica o de seguridad.',
    selector: '[data-tutorial="emergency-stop"]',
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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

const getCardPlacement = (targetRect, cardWidth, cardHeight) => {
  const margin = 10;
  const gap = 16;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  if (!targetRect) {
    return {
      top: clamp(viewportHeight - cardHeight - margin, margin, viewportHeight - cardHeight - margin),
      left: clamp((viewportWidth - cardWidth) / 2, margin, viewportWidth - cardWidth - margin),
    };
  }

  const candidates = [
    {
      top: targetRect.top + targetRect.height + gap,
      left: targetRect.left + targetRect.width / 2 - cardWidth / 2,
    },
    {
      top: targetRect.top - cardHeight - gap,
      left: targetRect.left + targetRect.width / 2 - cardWidth / 2,
    },
    {
      top: targetRect.top + targetRect.height / 2 - cardHeight / 2,
      left: targetRect.left + targetRect.width + gap,
    },
    {
      top: targetRect.top + targetRect.height / 2 - cardHeight / 2,
      left: targetRect.left - cardWidth - gap,
    },
  ];

  const fits = (candidate) =>
    candidate.top >= margin &&
    candidate.left >= margin &&
    candidate.top + cardHeight <= viewportHeight - margin &&
    candidate.left + cardWidth <= viewportWidth - margin;

  const exact = candidates.find((candidate) => fits(candidate));
  if (exact) {
    return exact;
  }

  const fallback = candidates[0] || {
    top: viewportHeight - cardHeight - margin,
    left: (viewportWidth - cardWidth) / 2,
  };

  return {
    top: clamp(fallback.top, margin, viewportHeight - cardHeight - margin),
    left: clamp(fallback.left, margin, viewportWidth - cardWidth - margin),
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

const AppTutorial = ({ isOpen, onClose }) => {
  const { dosingMode, setDosingMode } = useContext(PHContext);
  const cardRef = useRef(null);

  const [stepIndex, setStepIndex] = useState(0);
  const [partIndex, setPartIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [cardPosition, setCardPosition] = useState(null);
  const [connectorPoints, setConnectorPoints] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const step = STEP_LIST[stepIndex];
  const parts = step?.parts || [];
  const hasParts = parts.length > 0;
  const activePart = hasParts ? parts[Math.min(partIndex, parts.length - 1)] : null;
  const activeSelector = activePart?.selector || step?.selector;
  const activeSlide = activePart?.showMeterSlide ?? step?.showMeterSlide;

  const panelTitle = activePart?.title || step?.title;
  const panelDescription = activePart?.description || step?.description;

  const findTargetElement = useCallback(() => {
    if (activeSelector) {
      const primary = document.querySelector(activeSelector);
      if (primary) return primary;
    }

    if (step?.selector && step.selector !== activeSelector) {
      return document.querySelector(step.selector);
    }

    return null;
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
    const nextPosition = getCardPlacement(spotlightRect, cardRect.width, cardRect.height);

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
    if (!isOpen) return;
    setStepIndex(0);
    setPartIndex(0);
    setCardPosition(null);
    setConnectorPoints(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !step) return undefined;

    let cancelled = false;

    const prepareStep = async () => {
      setIsPreparing(true);

      if (step.scrollTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await wait(280);
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
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        await wait(230);
      }

      updateSpotlightForCurrentPart();
      setIsPreparing(false);
    };

    prepareStep();

    return () => {
      cancelled = true;
    };
  }, [
    activeSlide,
    dosingMode,
    findTargetElement,
    isOpen,
    partIndex,
    setDosingMode,
    step,
    stepIndex,
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
  const canGoBack = !(stepIndex === 0 && (!hasParts || partIndex === 0));

  if (!isOpen || !step) {
    return null;
  }

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true" aria-label="Tutorial de uso">
      {!spotlightRect && <div className="tutorial-full-shade" />}

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
        <p className="tutorial-step-counter">Paso {step.number} de 8</p>
        {hasParts && <p className="tutorial-part-counter">Parte {partIndex + 1} de {parts.length}</p>}

        <h3>{panelTitle}</h3>
        <p>{panelDescription}</p>

        <div className="tutorial-actions">
          <button type="button" className="tutorial-btn tutorial-btn--ghost" onClick={() => onClose('skipped')}>
            Omitir
          </button>

          <div className="tutorial-main-actions">
            <button
              type="button"
              className="tutorial-btn tutorial-btn--ghost"
              onClick={() => {
                if (!canGoBack || isPreparing) {
                  return;
                }

                if (hasParts && partIndex > 0) {
                  setPartIndex((prev) => prev - 1);
                  return;
                }

                const previousStepIndex = Math.max(0, stepIndex - 1);
                const previousParts = STEP_LIST[previousStepIndex]?.parts || [];
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
                if (isPreparing) {
                  return;
                }

                if (hasNextPart) {
                  setPartIndex((prev) => prev + 1);
                  return;
                }

                if (isLastStep) {
                  onClose('completed');
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
