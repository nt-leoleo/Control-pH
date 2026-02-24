import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { PHContext } from './PHContext';
import './AppTutorial.css';

const STEP_LIST = [
  {
    number: 0,
    title: 'Bienvenida',
    description:
      'Este recorrido te muestra como usar el sistema de control de pH. Veras cada modulo clave en orden.',
    selector: '[data-tutorial="dashboard-root"]',
    scrollTop: true,
  },
  {
    number: 1,
    title: 'Medidor de pH',
    description:
      'Este medidor muestra el pH actual de tu pileta para que sepas si esta en rango o si necesita correccion.',
    selector: '[data-tutorial="ph-meter"]',
  },
  {
    number: 2,
    title: 'Cambio por deslizamiento',
    description:
      'En el medidor podes cambiar de vista deslizando a izquierda o derecha para ver lectura y aguja.',
    selector: '[data-tutorial="ph-swipe-hint"]',
  },
  {
    number: 3,
    title: 'Escala de pH',
    description:
      'La escala completa va de 0 a 14. Tambien marca el rango ideal configurado y la posicion actual de pH.',
    selector: '[data-tutorial="ph-scale"]',
  },
  {
    number: 4,
    title: 'Grafico de pH',
    description:
      'Este grafico muestra la evolucion del pH en el tiempo para detectar tendencias y variaciones.',
    selector: '[data-tutorial="ph-chart"]',
  },
  {
    number: 5,
    title: 'Modo automatico',
    description:
      'En automatico, el sistema evalua desvio de pH y aplica correcciones por si solo dentro de sus limites.',
    selector: '[data-tutorial="auto-module"]',
    requiredMode: 'automatic',
  },
  {
    number: 6,
    title: 'Modo manual',
    description: 'En manual controlas toda la dosificacion. Flujo recomendado:',
    bulletPoints: [
      'Elegir producto para subir o bajar pH.',
      'Definir tiempo (minutos/segundos).',
      'Indicar litros a dosificar.',
      'Revisar estimacion de pH final.',
      'Enviar con el boton DOSIFICAR.',
    ],
    selector: '[data-tutorial="manual-module"]',
    requiredMode: 'manual',
  },
  {
    number: 7,
    title: 'Parada de emergencia',
    description:
      'Este boton corta de inmediato la operacion. Usalo solo ante una situacion critica del sistema.',
    selector: '[data-tutorial="emergency-stop"]',
  },
  {
    number: 8,
    title: 'Configuracion de usuario',
    description:
      'Desde Ajustes podes configurar objetivo y tolerancia de pH, modo de dosificacion, ESP32, WiFi y gestion de piscinas.',
    selector: '[data-tutorial="open-settings"]',
    scrollTop: true,
  },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const AppTutorial = ({ isOpen, onClose }) => {
  const { dosingMode, setDosingMode } = useContext(PHContext);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [isPreparing, setIsPreparing] = useState(false);

  const step = STEP_LIST[stepIndex];

  const updateSpotlightForStep = useCallback(() => {
    if (!isOpen || !step?.selector) {
      setSpotlightRect(null);
      return;
    }

    const element = document.querySelector(step.selector);
    if (!element) {
      setSpotlightRect(null);
      return;
    }

    setSpotlightRect(getSpotlightRect(element));
  }, [isOpen, step?.selector]);

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !step) return undefined;

    let cancelled = false;

    const prepareStep = async () => {
      setIsPreparing(true);

      if (step.scrollTop) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        await wait(260);
      }

      if (step.requiredMode && dosingMode !== step.requiredMode) {
        try {
          await setDosingMode(step.requiredMode);
          await wait(260);
        } catch (error) {
          console.error('[Tutorial] No se pudo cambiar el modo:', error);
        }
      }

      let target = null;
      if (step.selector) {
        for (let attempt = 0; attempt < 25; attempt += 1) {
          if (cancelled) return;

          target = document.querySelector(step.selector);
          if (target) break;
          await wait(120);
        }
      }

      if (cancelled) return;

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        await wait(220);
      }

      updateSpotlightForStep();
      setIsPreparing(false);
    };

    prepareStep();

    return () => {
      cancelled = true;
    };
  }, [isOpen, step, dosingMode, setDosingMode, updateSpotlightForStep]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleUpdate = () => {
      window.requestAnimationFrame(() => {
        updateSpotlightForStep();
      });
    };

    window.addEventListener('resize', handleUpdate);
    window.addEventListener('scroll', handleUpdate, true);

    return () => {
      window.removeEventListener('resize', handleUpdate);
      window.removeEventListener('scroll', handleUpdate, true);
    };
  }, [isOpen, updateSpotlightForStep]);

  const isLastStep = useMemo(() => stepIndex === STEP_LIST.length - 1, [stepIndex]);

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

      <aside className="tutorial-card">
        <p className="tutorial-step-counter">Paso {step.number} de 8</p>
        <h3>{step.title}</h3>
        <p>{step.description}</p>

        {step.bulletPoints && (
          <ul>
            {step.bulletPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        )}

        <div className="tutorial-actions">
          <button type="button" className="tutorial-btn tutorial-btn--ghost" onClick={() => onClose('skipped')}>
            Omitir
          </button>

          <div className="tutorial-main-actions">
            <button
              type="button"
              className="tutorial-btn tutorial-btn--ghost"
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={stepIndex === 0 || isPreparing}
            >
              Anterior
            </button>
            <button
              type="button"
              className="tutorial-btn tutorial-btn--primary"
              onClick={() => {
                if (isLastStep) {
                  onClose('completed');
                  return;
                }
                setStepIndex((prev) => Math.min(STEP_LIST.length - 1, prev + 1));
              }}
              disabled={isPreparing}
            >
              {isLastStep ? 'Finalizar' : 'Siguiente'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default AppTutorial;
