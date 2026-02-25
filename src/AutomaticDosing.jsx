import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PHContext } from './PHContext';
import { useAuth } from './useAuth';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import { getChemicalName, getConfiguredProducts } from './chemicalLabels';
import InfoHint from './InfoHint';
import './AutomaticDosing.css';

const toNumberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatDuration = (totalSeconds) => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0s';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

const formatWaitInterval = (hoursValue) => {
  if (!Number.isFinite(hoursValue) || hoursValue <= 0) return 'Sin espera';
  if (hoursValue < 1) {
    return `${Math.round(hoursValue * 60)} min`;
  }
  const rounded = Number(hoursValue.toFixed(2));
  return `${rounded} h`;
};

const AutomaticDosing = () => {
  const { ph, phTolerance, phToleranceRange, dosingMode, userConfig, chlorineType, acidType } =
    useContext(PHContext);
  const { user } = useAuth();

  const [lastDosingEvent, setLastDosingEvent] = useState(null);
  const [dosingState, setDosingState] = useState(null);
  const [activeAutoCommand, setActiveAutoCommand] = useState(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const lastForceCheckRef = useRef(0);

  const adminConfig = userConfig?.adminConfig || {
    minWaitTimeBetweenDoses: 0.5,
    maxDailyDoses: 10,
    checkInterval: 1,
    minPH: 0.0,
    maxPH: 14.0,
  };

  useEffect(() => {
    if (dosingMode !== 'automatic') return undefined;
    const intervalId = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, [dosingMode]);

  useEffect(() => {
    if (!user || dosingMode !== 'automatic') return undefined;

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
      const lastEvent = events.reduce((latest, current) => {
        if (!latest) return current;
        return (current?.timestamp || 0) > (latest?.timestamp || 0) ? current : latest;
      }, null);
      setLastDosingEvent(lastEvent);
    });

    const commandsRef = ref(database, `users/${user.uid}/commands`);
    const unsubscribeCommands = onValue(commandsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setActiveAutoCommand(null);
        return;
      }

      const commands = snapshot.val() || {};
      const activeCommands = Object.entries(commands)
        .map(([id, command]) => ({ id, ...(command || {}) }))
        .filter(
          (command) =>
            command.source === 'automatic' &&
            (command.status === 'pending' || command.status === 'processing')
        )
        .sort((a, b) => {
          const aCreated = toNumberOr(a.createdAt || a.timestamp, 0);
          const bCreated = toNumberOr(b.createdAt || b.timestamp, 0);
          return bCreated - aCreated;
        });

      setActiveAutoCommand(activeCommands[0] || null);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribeState();
      unsubscribeHistory();
      unsubscribeCommands();
    };
  }, [dosingMode, user]);

  useEffect(() => {
    if (!user || dosingMode !== 'automatic') return;
    if (!dosingState?.initialized) return;

    const minWaitHours = toNumberOr(adminConfig.minWaitTimeBetweenDoses, 0.5);
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
    adminConfig.minWaitTimeBetweenDoses,
    dosingMode,
    dosingState?.initialized,
    ph,
    phTolerance,
    phToleranceRange,
    user,
  ]);

  if (dosingMode !== 'automatic') return null;

  const deviation = ph - phTolerance;
  const isOutOfRange = Math.abs(deviation) > phToleranceRange;
  const minWaitHours = toNumberOr(adminConfig.minWaitTimeBetweenDoses, 0.5);
  const waitTimeMs = Math.max(0, minWaitHours) * 60 * 60 * 1000;
  const timeSinceLastDosing = dosingState?.lastDosingTime
    ? Math.max(0, nowTs - toNumberOr(dosingState.lastDosingTime, nowTs))
    : null;
  const remainingWaitSeconds =
    waitTimeMs > 0 && timeSinceLastDosing !== null
      ? Math.max(0, Math.ceil((waitTimeMs - timeSinceLastDosing) / 1000))
      : 0;

  const minIdeal = (phTolerance - phToleranceRange).toFixed(1);
  const maxIdeal = (phTolerance + phToleranceRange).toFixed(1);
  const { raiseName, lowerName } = getConfiguredProducts(chlorineType, acidType);

  const getProductLabel = (product) => {
    if (!product) return '-';
    if (product === 'ph_plus') return `Subio pH (${raiseName})`;
    if (product === 'ph_minus') return `Bajo pH (${lowerName})`;
    return getChemicalName(product);
  };

  const activeCommandInfo = useMemo(() => {
    if (activeAutoCommand) {
      const durationSeconds = toNumberOr(activeAutoCommand.duration, 0);
      const commandStartTs = toNumberOr(
        activeAutoCommand.processedAt || activeAutoCommand.lastDispatchAt || activeAutoCommand.createdAt,
        0
      );
      const elapsedSeconds =
        commandStartTs > 0 ? Math.max(0, Math.floor((nowTs - commandStartTs) / 1000)) : 0;
      const remainingSeconds =
        durationSeconds > 0 ? Math.max(0, durationSeconds - elapsedSeconds) : null;

      return {
        id: activeAutoCommand.id,
        status: activeAutoCommand.status,
        product: activeAutoCommand.product,
        durationSeconds,
        remainingSeconds,
        label: getProductLabel(activeAutoCommand.product),
      };
    }

    const stateStatus = String(dosingState?.autoCommandStatus || '').toLowerCase();
    const activeByState =
      Boolean(dosingState?.autoDosingActive) || stateStatus === 'pending' || stateStatus === 'processing';

    if (!activeByState) {
      return null;
    }

    const product = dosingState?.autoCommandProduct || dosingState?.lastProduct || null;
    const durationSeconds = toNumberOr(
      dosingState?.autoCommandDuration ?? dosingState?.lastDuration,
      0
    );
    const commandStartTs = toNumberOr(
      dosingState?.autoCommandStartedAt ||
        dosingState?.autoCommandCreatedAt ||
        dosingState?.lastDosingTime,
      0
    );
    const elapsedSeconds =
      commandStartTs > 0 ? Math.max(0, Math.floor((nowTs - commandStartTs) / 1000)) : 0;
    const remainingSeconds =
      durationSeconds > 0 ? Math.max(0, durationSeconds - elapsedSeconds) : null;

    return {
      id: dosingState?.autoCommandId || dosingState?.lastCommandId || 'auto-state',
      status: stateStatus || 'processing',
      product,
      durationSeconds,
      remainingSeconds,
      label: getProductLabel(product),
    };
  }, [activeAutoCommand, dosingState, nowTs, raiseName, lowerName]);

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
    if (activeCommandInfo) {
      let commandText =
        activeCommandInfo.status === 'pending'
          ? 'Comando enviado. Esperando que el Arduino inicie.'
          : `Arduino dosificando ${activeCommandInfo.label}.`;
      
      // Agregar información de bloques si existe
      if (dosingState?.currentBlock && dosingState?.totalBlocks) {
        commandText += ` (${dosingState.currentBlock}/${dosingState.totalBlocks})`;
      }

      return {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        ),
        title: activeCommandInfo.status === 'pending' ? 'Preparando dosificacion' : 'Dosificando ahora',
        text: commandText,
        status: 'dosing',
      };
    }

    if (!dosingState) {
      return {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
        ),
        title: 'Conectando',
        text: 'Estamos preparando el modo automatico.',
        status: 'connecting',
      };
    }

    if (!dosingState.initialized) {
      return {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          </svg>
        ),
        title: 'Conectando',
        text: dosingState.message || 'Estamos preparando el modo automatico.',
        status: 'connecting',
      };
    }

    if (dosingState.error) {
      return {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ),
        title: 'No pudimos conectar',
        text: 'Vamos a reintentar automaticamente.',
        status: 'error',
      };
    }

    const autoCommandStatus = String(dosingState.autoCommandStatus || '').toLowerCase();
    const autoCommandMessage = String(dosingState.autoCommandMessage || '').trim();

    if (autoCommandStatus.startsWith('blocked')) {
      return {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ),
        title: 'Correccion automatica bloqueada',
        text:
          autoCommandMessage ||
          'El sistema detecto una condicion de seguridad y no envio dosificacion.',
        status: 'alert',
      };
    }

    if (autoCommandStatus === 'sensor_missing' || autoCommandStatus === 'sensor_stale') {
      return {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4" />
            <path d="M12 18v4" />
            <path d="M4.93 4.93l2.83 2.83" />
            <path d="M16.24 16.24l2.83 2.83" />
            <path d="M2 12h4" />
            <path d="M18 12h4" />
            <path d="M4.93 19.07l2.83-2.83" />
            <path d="M16.24 7.76l2.83-2.83" />
          </svg>
        ),
        title: 'Esperando datos del sensor',
        text: autoCommandMessage || 'Todavia no hay datos validos para dosificar.',
        status: 'connecting',
      };
    }

    if (minWaitHours > 0 && remainingWaitSeconds > 0) {
      return {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
        title: 'Esperando mezcla',
        text: `Faltan ${formatDuration(remainingWaitSeconds)} antes de volver a corregir.`,
        status: 'waiting',
      };
    }

    if (isOutOfRange) {
      const level = getPHDeviationLevel();
      return {
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
        title: level.title,
        text: level.actionText,
        status: 'alert',
      };
    }

    return {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
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
      <h3 className="auto-title-with-info">
        <span>Modo automatico</span>
        <InfoHint
          size="sm"
          title="Modo automatico"
          text="El sistema evalua el desvio del pH y decide correcciones sin que tengas que dosificar manualmente."
        />
      </h3>

      <div className={`auto-status ${systemStatus.status}`} data-tutorial="auto-status">
        <div className="status-head" data-tutorial="auto-status-head">
          <span className={`status-icon ${systemStatus.status === 'dosing' ? 'status-icon--pulse' : ''}`}>
            {systemStatus.icon}
          </span>
          <div>
            <p className="status-title">{systemStatus.title}</p>
            <p className="status-text">{systemStatus.text}</p>
          </div>
        </div>

        {systemStatus.status === 'dosing' && (
          <div className="dosing-live">
            <span className="dosing-live-dot" aria-hidden="true"></span>
            <span className="dosing-live-text">
              {activeCommandInfo?.remainingSeconds !== null && activeCommandInfo?.remainingSeconds !== undefined
                ? `Dosificando... restante estimado ${formatDuration(activeCommandInfo.remainingSeconds)}`
                : 'Dosificando... esperando confirmacion del Arduino'}
            </span>
          </div>
        )}

        <div className="status-details" data-tutorial="auto-status-details">
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

          <div className="detail-row">
            <span>Espera entre dosificados</span>
            <span className="value">{formatWaitInterval(minWaitHours)}</span>
          </div>

          <div className="detail-row">
            <span>Siguiente correccion</span>
            <span className="value">
              {systemStatus.status === 'dosing'
                ? 'En dosificacion'
                : waitTimeMs <= 0
                  ? 'Inmediata'
                  : remainingWaitSeconds > 0
                    ? formatDuration(remainingWaitSeconds)
                    : 'Disponible'}
            </span>
          </div>
        </div>
      </div>

      <div className="simple-summary" data-tutorial="auto-summary">
        <h4 className="auto-subtitle-with-info">
          <span>Ultima correccion</span>
          <InfoHint
            size="sm"
            title="Ultima correccion"
            text="Resume la accion mas reciente del sistema automatico: cuando fue, que producto aplico y por cuanto tiempo."
          />
        </h4>
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

      <p className="auto-help" data-tutorial="auto-help">
        No hace falta dejar la app abierta: el sistema sigue funcionando solo.
      </p>
    </div>
  );
};

export default AutomaticDosing;
