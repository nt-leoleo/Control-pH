import { useContext, useEffect, useState, useRef } from 'react';
import { PHContext } from './PHContext';
import { useAuth } from './useAuth';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import { getChemicalName, getConfiguredProducts } from './chemicalLabels';
import './AutomaticDosing.css';

const AutomaticDosing = () => {
  const { ph, phTolerance, phToleranceRange, dosingMode, userConfig, chlorineType, acidType } =
    useContext(PHContext);
  const { user } = useAuth();

  const [lastDosingEvent, setLastDosingEvent] = useState(null);
  const [dosingState, setDosingState] = useState(null);
  const lastForceCheckRef = useRef(0);

  const adminConfig = userConfig?.adminConfig || {
    minWaitTimeBetweenDoses: 0.5,
    maxDailyDoses: 10,
    checkInterval: 1,
    minPH: 6.0,
    maxPH: 8.5,
  };

  useEffect(() => {
    if (!user || dosingMode !== 'automatic') return;

    const timeoutId = setTimeout(() => {
      if (!dosingState) {
        setDosingState({
          initialized: false,
          message: 'Conectando...',
        });
      }
    }, 2000);

    const dosingStateRef = ref(database, `users/${user.uid}/dosingState`);
    const unsubscribeState = onValue(
      dosingStateRef,
      (snapshot) => {
        clearTimeout(timeoutId);
        if (snapshot.exists()) {
          setDosingState({ ...snapshot.val(), initialized: true });
        } else {
          setDosingState({
            initialized: true,
            message: 'Sin correcciones previas',
          });
        }
      },
      (error) => {
        clearTimeout(timeoutId);
        setDosingState({
          initialized: true,
          error: error.message,
        });
      }
    );

    const historyRef = ref(database, `users/${user.uid}/dosingHistory`);
    const unsubscribeHistory = onValue(historyRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const history = snapshot.val();
      const events = Object.values(history);
      const lastEvent = events.sort((a, b) => b.timestamp - a.timestamp)[0];
      setLastDosingEvent(lastEvent);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribeState();
      unsubscribeHistory();
    };
  }, [user, dosingMode]);

  useEffect(() => {
    if (!user || dosingMode !== 'automatic') return;
    if (!dosingState?.initialized) return;

    const minWaitHours =
      adminConfig.minWaitTimeBetweenDoses !== undefined ? adminConfig.minWaitTimeBetweenDoses : 0.5;

    if (minWaitHours !== 0) return;

    const deviation = ph - phTolerance;
    const isOutOfRange = Math.abs(deviation) > phToleranceRange;
    if (!isOutOfRange) return;

    const now = Date.now();
    if (now - lastForceCheckRef.current < 10000) return;
    lastForceCheckRef.current = now;

    const forceCheck = async () => {
      try {
        await fetch('https://us-central1-control-ph-82951.cloudfunctions.net/forceCheck', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.uid }),
        });
      } catch (error) {
        console.error('Error llamando forceCheck:', error);
      }
    };

    forceCheck();
  }, [
    user,
    dosingMode,
    ph,
    phTolerance,
    phToleranceRange,
    adminConfig.minWaitTimeBetweenDoses,
    dosingState?.initialized,
  ]);

  if (dosingMode !== 'automatic') return null;

  const deviation = ph - phTolerance;
  const isOutOfRange = Math.abs(deviation) > phToleranceRange;
  const minIdeal = (phTolerance - phToleranceRange).toFixed(1);
  const maxIdeal = (phTolerance + phToleranceRange).toFixed(1);
  const { raiseName, lowerName } = getConfiguredProducts(chlorineType, acidType);

  const getProductLabel = (product) => {
    if (!product) return '-';
    if (product === 'ph_plus') return `Subio pH (${raiseName})`;
    if (product === 'ph_minus') return `Bajo pH (${lowerName})`;
    return getChemicalName(product);
  };

  const getPHDeviationLevel = () => {
    const absDeviation = Math.abs(deviation);
    const veryThreshold = Math.max(phToleranceRange * 2, 0.8);

    if (deviation < 0) {
      return {
        title: absDeviation >= veryThreshold ? 'pH muy bajo' : 'pH bajo',
        actionText: 'El sistema va a subir el pH automaticamente.',
      };
    }

    return {
      title: absDeviation >= veryThreshold ? 'pH muy alto' : 'pH alto',
      actionText: 'El sistema va a bajar el pH automaticamente.',
    };
  };

  const getSystemStatus = () => {
    if (!dosingState) {
      return {
        icon: '⏳',
        title: 'Conectando',
        text: 'Estamos preparando el modo automatico.',
        status: 'connecting',
      };
    }

    if (!dosingState.initialized) {
      return {
        icon: '⏳',
        title: 'Conectando',
        text: dosingState.message || 'Estamos preparando el modo automatico.',
        status: 'connecting',
      };
    }

    if (dosingState.error) {
      return {
        icon: '⚠️',
        title: 'No pudimos conectar',
        text: 'Vamos a reintentar automaticamente.',
        status: 'error',
      };
    }

    const timeSinceLastDosing = dosingState.lastDosingTime
      ? Date.now() - dosingState.lastDosingTime
      : null;
    const minWaitHours =
      adminConfig.minWaitTimeBetweenDoses !== undefined ? adminConfig.minWaitTimeBetweenDoses : 0.5;
    const waitTimeMs = minWaitHours * 60 * 60 * 1000;

    if (minWaitHours > 0 && timeSinceLastDosing && timeSinceLastDosing < waitTimeMs) {
      const remainingMinutes = Math.ceil((waitTimeMs - timeSinceLastDosing) / 60000);
      return {
        icon: '🕒',
        title: 'Esperando mezcla',
        text: `Faltan ${remainingMinutes} min antes de volver a corregir.`,
        status: 'waiting',
      };
    }

    if (isOutOfRange) {
      const level = getPHDeviationLevel();
      return {
        icon: '!',
        title: level.title,
        text: level.actionText,
        status: 'alert',
      };
    }

    return {
      icon: '✅',
      title: 'Todo en orden',
      text: 'El pH esta en rango y el sistema sigue monitoreando.',
      status: 'ok',
    };
  };

  const systemStatus = getSystemStatus();

  const lastActionTime =
    dosingState?.lastDosingTime || lastDosingEvent?.timestamp
      ? new Date(dosingState?.lastDosingTime || lastDosingEvent?.timestamp).toLocaleString()
      : 'Sin correcciones aun';

  const lastActionProduct = dosingState?.lastProduct || lastDosingEvent?.product;
  const lastActionDuration = dosingState?.lastDuration || lastDosingEvent?.duration;
  const dailyCount =
    dosingState?.dosingCountToday !== undefined ? dosingState.dosingCountToday : lastDosingEvent ? 1 : 0;

  return (
    <div className="automatic-dosing-container" data-tutorial="auto-module">
      <h3>Modo automatico</h3>

      <div className={`auto-status ${systemStatus.status}`}>
        <div className="status-head">
          <span className="status-icon">{systemStatus.icon}</span>
          <div>
            <p className="status-title">{systemStatus.title}</p>
            <p className="status-text">{systemStatus.text}</p>
          </div>
        </div>

        <div className="status-details">
          <div className="detail-row">
            <span>Objetivo</span>
            <span className="value">
              {phTolerance.toFixed(1)} (ideal {minIdeal} - {maxIdeal})
            </span>
          </div>

          <div className="detail-row">
            <span>pH ahora</span>
            <span className={`value ${isOutOfRange ? 'out-of-range' : 'in-range'}`}>{ph.toFixed(2)}</span>
          </div>

          <div className="detail-row">
            <span>Diferencia</span>
            <span className={`value ${isOutOfRange ? 'warning' : 'ok'}`}>
              {deviation >= 0 ? '+' : ''}
              {deviation.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="simple-summary">
        <h4>Ultima correccion</h4>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="label">Cuando</span>
            <span className="value">{lastActionTime}</span>
          </div>
          <div className="summary-item">
            <span className="label">Que hizo</span>
            <span className="value">{getProductLabel(lastActionProduct)}</span>
          </div>
          <div className="summary-item">
            <span className="label">Tiempo</span>
            <span className="value">{lastActionDuration ? `${lastActionDuration}s` : '-'}</span>
          </div>
          <div className="summary-item">
            <span className="label">Hoy</span>
            <span className="value">
              {dailyCount} de {adminConfig.maxDailyDoses || 10}
            </span>
          </div>
        </div>
      </div>

      <p className="auto-help">No hace falta dejar la app abierta: el sistema sigue funcionando solo.</p>
    </div>
  );
};

export default AutomaticDosing;

