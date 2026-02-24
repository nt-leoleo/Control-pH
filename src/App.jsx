import { useCallback, useContext, useState, useEffect, useRef } from 'react';
import Header from './Header';
import ShowpH from './ShowpH';
import HandleAdmin from './HandleAdmin';
import PHBar from './PHBar';
import PHChart from './PHChart';
import ManualDosing from './ManualDosing';
import AutomaticDosing from './AutomaticDosing';
import Onboarding from './Onboarding';
import SettingsPage from './SettingsPage';
import PoolManager from './PoolManager';
import ErrorNotification from './ErrorNotification';
import LoginScreen from './LoginScreen';
import SplashScreen from './SplashScreen';
import DeviceRegistration from './DeviceRegistration';
import AppTutorial from './AppTutorial';
import InfoHint from './InfoHint';
import ConfirmDialog from './ConfirmDialog';
import { PHContext } from './PHContext';
import { useAuth } from './useAuth';
import { sendEmergencyStopCommand } from './esp32Communication-firebase';
import './App.css';

export default function App() {
  const {
    ph,
    phTolerance,
    phToleranceRange,
    error,
    setError,
    dosingMode,
    setDosingMode,
    esp32Connected,
    lastDataReceived,
    hasConfiguredDevice,
    checkConnection,
    openDeviceRegistrationModal,
    isConfigured,
    ensureDeviceConfigured
  } = useContext(PHContext);
  const { user, loading, userConfig, updateUserConfig } = useAuth();
  const [currentView, setCurrentView] = useState('main');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [showSplash, setShowSplash] = useState(true);
  const [isSendingEmergencyStop, setIsSendingEmergencyStop] = useState(false);
  const [showDeviceRegistrationModal, setShowDeviceRegistrationModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialCheckedForUser, setTutorialCheckedForUser] = useState(false);
  const [tutorialDemoPh, setTutorialDemoPh] = useState(null);
  const [showEmergencyStopConfirm, setShowEmergencyStopConfirm] = useState(false);
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [diagnosticStep, setDiagnosticStep] = useState(0);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [systemEvents, setSystemEvents] = useState([]);
  const [isSystemStatusExpanded, setIsSystemStatusExpanded] = useState(false);
  const [isSystemEventsExpanded, setIsSystemEventsExpanded] = useState(false);

  const displayedPh = typeof tutorialDemoPh === 'number' ? tutorialDemoPh : ph;
  const phDeviation = displayedPh - phTolerance;
  const isOutOfRange = Math.abs(phDeviation) > phToleranceRange;
  const previousConnectionRef = useRef(esp32Connected);
  const previousOutOfRangeRef = useRef(isOutOfRange);
  const previousModeRef = useRef(dosingMode);
  const hasBootEventRef = useRef(false);
  const eventCounterRef = useRef(0);

  const addSystemEvent = useCallback((event) => {
    eventCounterRef.current += 1;
    const now = new Date();
    const nextEvent = {
      id: `${now.getTime()}-${eventCounterRef.current}`,
      createdAt: now.toISOString(),
      ...event
    };

    setSystemEvents((previous) => [nextEvent, ...previous].slice(0, 15));
  }, []);

  const getTutorialStorageKey = useCallback(
    () => (user?.uid ? `control-pileta:tutorial-completed:${user.uid}` : null),
    [user?.uid]
  );

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'pool-manager') {
        setCurrentView('pool-manager');
      } else if (hash === 'settings') {
        setCurrentView('settings');
      } else {
        setCurrentView('main');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const openDeviceModal = () => setShowDeviceRegistrationModal(true);
    const closeOnConfigured = (event) => {
      if (event?.detail?.hasDevice) {
        setShowDeviceRegistrationModal(false);
      }
    };
    window.addEventListener('device-registration:open', openDeviceModal);
    window.addEventListener('device-registration:updated', closeOnConfigured);
    return () => {
      window.removeEventListener('device-registration:open', openDeviceModal);
      window.removeEventListener('device-registration:updated', closeOnConfigured);
    };
  }, []);

  useEffect(() => {
    setTutorialCheckedForUser(false);
    setShowTutorial(false);
  }, [user?.uid]);

  useEffect(() => {
    hasBootEventRef.current = false;
    setSystemEvents([]);
  }, [user?.uid]);

  const openTutorial = useCallback(() => {
    setShowDeviceRegistrationModal(false);

    if (currentView !== 'main') {
      setCurrentView('main');
      window.location.hash = '';
      setTimeout(() => setShowTutorial(true), 180);
      return;
    }

    setShowTutorial(true);
  }, [currentView]);

  const markTutorialAsSeen = useCallback(async () => {
    const storageKey = getTutorialStorageKey();
    if (storageKey) {
      localStorage.setItem(storageKey, '1');
    }

    if (user && userConfig?.tutorialCompleted !== true) {
      try {
        await updateUserConfig({ tutorialCompleted: true });
      } catch (tutorialError) {
        console.error('No se pudo guardar el estado del tutorial:', tutorialError);
      }
    }
  }, [getTutorialStorageKey, updateUserConfig, user, userConfig?.tutorialCompleted]);

  useEffect(() => {
    window.startControlPiletaTutorial = () => {
      openTutorial();
    };

    return () => {
      delete window.startControlPiletaTutorial;
    };
  }, [openTutorial]);

  useEffect(() => {
    if (loading || !user?.uid || !isConfigured || tutorialCheckedForUser) {
      return;
    }

    const storageKey = getTutorialStorageKey();
    const seenInBrowser = storageKey ? localStorage.getItem(storageKey) === '1' : false;
    const seenInAccount = userConfig?.tutorialCompleted === true;

    if (!seenInBrowser && !seenInAccount) {
      openTutorial();
    }

    setTutorialCheckedForUser(true);
  }, [
    getTutorialStorageKey,
    isConfigured,
    loading,
    openTutorial,
    tutorialCheckedForUser,
    user?.uid,
    userConfig?.tutorialCompleted,
  ]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const requestEmergencyStop = () => {
    if (!user?.uid || isSendingEmergencyStop) {
      return;
    }

    if (!ensureDeviceConfigured('la parada de emergencia')) {
      return;
    }

    setShowEmergencyStopConfirm(true);
  };

  const handleEmergencyStop = async () => {
    setShowEmergencyStopConfirm(false);

    try {
      setIsSendingEmergencyStop(true);
      const result = await sendEmergencyStopCommand(user.uid);

      if (result.success) {
        setError({
          type: 'success',
          message: 'Parada de emergencia enviada. El ESP32 apagara todo en su siguiente lectura.'
        });
      } else {
        throw new Error(result.error || result.message || 'No se pudo enviar la parada de emergencia');
      }
    } catch (emergencyError) {
      setError({
        type: 'error',
        message: emergencyError.message || 'Error enviando parada de emergencia'
      });
    } finally {
      setIsSendingEmergencyStop(false);
    }
  };

  const startOfflineDiagnostic = () => {
    setIsDiagnosticOpen(true);
    setDiagnosticStep(0);
    setDiagnosticResult(null);
  };

  const closeOfflineDiagnostic = () => {
    setIsDiagnosticOpen(false);
    setDiagnosticStep(0);
    setDiagnosticResult(null);
  };

  const runConnectionCheck = async () => {
    try {
      setIsCheckingConnection(true);
      const connected = await checkConnection();
      if (connected) {
        setDiagnosticResult('online');
        setDiagnosticStep(4);
        return;
      }

      setDiagnosticResult('offline');
      setDiagnosticStep(4);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const getSystemSummary = () => {
    if (!esp32Connected) {
      return {
        status: 'needs-action',
        title: 'Necesita accion',
        text: 'No llegan lecturas recientes del sensor. Conviene ejecutar el diagnostico guiado.',
        nextAction: 'Iniciar diagnostico'
      };
    }

    if (isOutOfRange) {
      if (dosingMode === 'automatic') {
        return {
          status: 'correcting',
          title: 'Corrigiendo',
          text: 'El pH esta fuera de rango y el modo automatico va a corregirlo.',
          nextAction: 'Esperar y revisar en unos minutos'
        };
      }

      return {
        status: 'needs-action',
        title: 'Necesita accion',
        text: 'El pH esta fuera de rango. Cambia a automatico o realiza dosificacion manual.',
        nextAction: 'Aplicar correccion manual o pasar a automatico'
      };
    }

    return {
      status: 'ok',
      title: 'Todo bien',
      text: 'Sensor conectado y pH dentro del rango objetivo.',
      nextAction: 'No hace falta intervenir'
    };
  };

  const systemSummary = getSystemSummary();

  useEffect(() => {
    if (!isDiagnosticOpen) {
      return;
    }

    if (esp32Connected) {
      setDiagnosticResult('online');
      setDiagnosticStep(4);
    }
  }, [esp32Connected, isDiagnosticOpen]);

  useEffect(() => {
    if (!user?.uid || hasBootEventRef.current) {
      return;
    }

    hasBootEventRef.current = true;
    addSystemEvent({
      type: 'info',
      title: 'Sesion iniciada',
      detail: 'Sistema listo para monitoreo de pH.',
      action: 'Revisar estado general'
    });
  }, [addSystemEvent, user?.uid]);

  useEffect(() => {
    const previousConnection = previousConnectionRef.current;
    if (previousConnection !== esp32Connected) {
      if (esp32Connected) {
        addSystemEvent({
          type: 'ok',
          title: 'Sensor online',
          detail: 'Se restablecio la comunicacion con el ESP32.',
          action: 'Continuar monitoreo'
        });
      } else {
        addSystemEvent({
          type: 'warning',
          title: 'Sensor offline',
          detail: 'No llegan lecturas recientes del ESP32.',
          action: 'Iniciar diagnostico guiado'
        });
      }
    }

    previousConnectionRef.current = esp32Connected;
  }, [addSystemEvent, esp32Connected]);

  useEffect(() => {
    const previousOutOfRange = previousOutOfRangeRef.current;
    if (previousOutOfRange !== isOutOfRange) {
      if (isOutOfRange) {
        addSystemEvent({
          type: 'warning',
          title: 'pH fuera de rango',
          detail: `Lectura ${displayedPh.toFixed(2)} con objetivo ${phTolerance.toFixed(1)} +/- ${phToleranceRange.toFixed(1)}.`,
          action: dosingMode === 'automatic' ? 'Esperar correccion automatica' : 'Aplicar dosificacion manual'
        });
      } else {
        addSystemEvent({
          type: 'ok',
          title: 'pH en rango',
          detail: `Lectura ${displayedPh.toFixed(2)} dentro del objetivo configurado.`,
          action: 'Sin intervencion necesaria'
        });
      }
    }

    previousOutOfRangeRef.current = isOutOfRange;
  }, [addSystemEvent, displayedPh, dosingMode, isOutOfRange, phTolerance, phToleranceRange]);

  useEffect(() => {
    const previousMode = previousModeRef.current;
    if (previousMode !== dosingMode) {
      addSystemEvent({
        type: 'info',
        title: `Modo ${dosingMode === 'automatic' ? 'automatico' : 'manual'} activado`,
        detail:
          dosingMode === 'automatic'
            ? 'El sistema corregira desbalances automaticamente.'
            : 'Las correcciones se ejecutan solo cuando vos las envias.',
        action: dosingMode === 'automatic' ? 'Monitorear resultados' : 'Configurar dosificacion manual'
      });
    }

    previousModeRef.current = dosingMode;
  }, [addSystemEvent, dosingMode]);

  useEffect(() => {
    if (!error?.message) {
      return;
    }

    addSystemEvent({
      type: error.type === 'success' ? 'ok' : 'warning',
      title: error.type === 'success' ? 'Accion completada' : 'Aviso del sistema',
      detail: error.message,
      action: error.type === 'success' ? 'Continuar monitoreo' : 'Revisar detalle del aviso'
    });
  }, [addSystemEvent, error?.message, error?.type]);

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-container">
          <h1>Control Pileta pH</h1>
          <div className="loading-spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (!isConfigured) {
    return (
      <>
        <Onboarding />
        {error && (
          <ErrorNotification message={error.message} type={error.type || 'error'} duration={5000} />
        )}
      </>
    );
  }

  if (currentView === 'settings') {
    return (
      <SettingsPage
        onBack={() => {
          setCurrentView('main');
          window.location.hash = '';
        }}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  if (currentView === 'pool-manager') {
    return (
      <PoolManager
        onBack={() => {
          setCurrentView('settings');
          window.location.hash = 'settings';
        }}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    );
  }

  return (
    <>
      {!showTutorial && (
        <Header
          onConfigClick={() => {
            setCurrentView('settings');
            window.location.hash = 'settings';
          }}
        />
      )}

      <main className="fade-in app-main" data-tutorial="dashboard-root">
        <div className="dashboard-stack">
          <ShowpH phValue={displayedPh} />
          <HandleAdmin />
          <PHBar ph={displayedPh} />
          <PHChart phOverride={displayedPh} />
        </div>

        {dosingMode === 'manual' && (
          <div className="scale-in dashboard-module">
            <ManualDosing />
          </div>
        )}

        {dosingMode === 'automatic' && (
          <div className="scale-in dashboard-module">
            <AutomaticDosing />
          </div>
        )}

        <div className="mode-toggle-container">
          <div className="module-help-label">
            <span>Modo de dosificacion</span>
            <InfoHint
              size="sm"
              title="Cambio de modo"
              text="Automatico: el sistema corrige solo. Manual: vos decidis cada dosificacion."
            />
          </div>
          <button
            onClick={async () => {
              try {
                if (!ensureDeviceConfigured('cambiar el modo de dosificacion')) {
                  return;
                }
                const newMode = dosingMode === 'automatic' ? 'manual' : 'automatic';
                await setDosingMode(newMode);
              } catch (toggleError) {
                console.error('Error cambiando modo de dosificacion:', toggleError);
              }
            }}
            className={`mode-toggle-button ${
              dosingMode === 'automatic' ? 'mode-toggle-button--automatic' : 'mode-toggle-button--manual'
            }`}
          >
            <span>Modo {dosingMode === 'automatic' ? 'automatico' : 'manual'}</span>
            <small>Toca para cambiar a {dosingMode === 'automatic' ? 'manual' : 'automatico'}</small>
          </button>
        </div>

        <section className={`system-status-card system-status-card--${systemSummary.status}`}>
          <button
            type="button"
            className="system-card-toggle"
            aria-expanded={isSystemStatusExpanded}
            onClick={() => setIsSystemStatusExpanded((prev) => !prev)}
          >
            <div className="system-card-toggle-text">
              <div className="module-help-label module-help-label--tight">
                <span>Estado del sistema</span>
                <InfoHint
                  size="sm"
                  title="Estado rapido"
                  text="Resume en lenguaje simple si todo esta bien, si el sistema esta corrigiendo o si necesitas intervenir."
                />
              </div>
              <small>{systemSummary.title}</small>
            </div>
            <span className={`system-card-chevron ${isSystemStatusExpanded ? 'is-open' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>

          {isSystemStatusExpanded && (
            <>
              <div className="system-status-head">
                <strong>{systemSummary.title}</strong>
                <span>{systemSummary.text}</span>
              </div>

              <div className="system-status-meta">
                <div>
                  <small>pH actual</small>
                  <strong>{displayedPh.toFixed(2)}</strong>
                </div>
                <div>
                  <small>Objetivo</small>
                  <strong>
                    {phTolerance.toFixed(1)} +/- {phToleranceRange.toFixed(1)}
                  </strong>
                </div>
                <div>
                  <small>Siguiente accion</small>
                  <strong>{systemSummary.nextAction}</strong>
                </div>
                <div>
                  <small>Ultima lectura</small>
                  <strong>{lastDataReceived ? new Date(lastDataReceived).toLocaleTimeString() : 'Sin datos'}</strong>
                </div>
              </div>

              {!esp32Connected && !isDiagnosticOpen && (
                <button className="system-status-action" onClick={startOfflineDiagnostic}>
                  Iniciar diagnostico guiado
                </button>
              )}

              {isDiagnosticOpen && (
                <div className="offline-diagnostic">
                  <div className="offline-diagnostic-header">
                    <h4>Diagnostico guiado</h4>
                    <button onClick={closeOfflineDiagnostic}>Cerrar</button>
                  </div>

                  {diagnosticStep === 0 && (
                    <div className="offline-diagnostic-step">
                      <p>1. Revisa que el ESP32 tenga energia y este encendido.</p>
                      <button onClick={() => setDiagnosticStep(1)}>Ya lo revise</button>
                    </div>
                  )}

                  {diagnosticStep === 1 && (
                    <div className="offline-diagnostic-step">
                      <p>2. Verifica WiFi: el equipo debe estar en la misma red configurada.</p>
                      <button onClick={() => setDiagnosticStep(2)}>Continuar</button>
                    </div>
                  )}

                  {diagnosticStep === 2 && (
                    <div className="offline-diagnostic-step">
                      <p>
                        3. Registro del dispositivo: {hasConfiguredDevice ? 'dispositivo vinculado' : 'no hay dispositivo vinculado'}.
                      </p>
                      <div className="offline-diagnostic-actions">
                        {!hasConfiguredDevice && (
                          <button
                            onClick={() => {
                              openDeviceRegistrationModal();
                            }}
                          >
                            Abrir registro de dispositivo
                          </button>
                        )}
                        <button onClick={() => setDiagnosticStep(3)}>Continuar</button>
                      </div>
                    </div>
                  )}

                  {diagnosticStep === 3 && (
                    <div className="offline-diagnostic-step">
                      <p>4. Ejecuta una prueba de conexion ahora mismo.</p>
                      <button onClick={runConnectionCheck} disabled={isCheckingConnection}>
                        {isCheckingConnection ? 'Probando...' : 'Probar conexion'}
                      </button>
                    </div>
                  )}

                  {diagnosticStep >= 4 && (
                    <div className="offline-diagnostic-step">
                      <p>
                        {diagnosticResult === 'online'
                          ? 'Resultado: sensor online. Ya llegan lecturas de nuevo.'
                          : 'Resultado: sigue offline. Repite el diagnostico o vuelve a registrar el dispositivo.'}
                      </p>
                      <div className="offline-diagnostic-actions">
                        <button onClick={startOfflineDiagnostic}>Repetir diagnostico</button>
                        <button onClick={openDeviceRegistrationModal}>Ir a registro</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        <section className="system-events-card">
          <button
            type="button"
            className="system-card-toggle"
            aria-expanded={isSystemEventsExpanded}
            onClick={() => setIsSystemEventsExpanded((prev) => !prev)}
          >
            <div className="system-card-toggle-text">
              <div className="module-help-label module-help-label--tight">
                <span>Centro de eventos</span>
                <InfoHint
                  size="sm"
                  title="Eventos recientes"
                  text="Explica que paso, que hizo el sistema y que conviene hacer ahora."
                />
              </div>
              <small>
                {systemEvents.length > 0
                  ? `${Math.min(systemEvents.length, 8)} evento(s) recientes`
                  : 'Sin eventos recientes'}
              </small>
            </div>
            <span className={`system-card-chevron ${isSystemEventsExpanded ? 'is-open' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>

          {isSystemEventsExpanded && (
            <>
              <div className="system-events-header">
                <span className="system-events-title">Ultimos eventos</span>
                <button
                  className="system-events-clear"
                  onClick={() => setSystemEvents([])}
                  disabled={systemEvents.length === 0}
                >
                  Limpiar
                </button>
              </div>

              {systemEvents.length === 0 ? (
                <p className="system-events-empty">Todavia no hay eventos para mostrar.</p>
              ) : (
                <ul className="system-events-list">
                  {systemEvents.slice(0, 8).map((event) => (
                    <li key={event.id} className={`system-event-item system-event-item--${event.type}`}>
                      <div className="system-event-top">
                        <span>{event.title}</span>
                        <small>{new Date(event.createdAt).toLocaleTimeString()}</small>
                      </div>
                      <p>{event.detail}</p>
                      <strong>{event.action}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
        <div className="emergency-stop-container" data-tutorial="emergency-stop">
          <div className="module-help-label module-help-label--danger">
            <span>Parada de emergencia</span>
            <InfoHint
              size="sm"
              title="Parada de emergencia"
              text="Detiene bombas y acciones del sistema. Usalo solo ante riesgo o funcionamiento anormal."
            />
          </div>
          <button
            onClick={requestEmergencyStop}
            disabled={isSendingEmergencyStop}
            className="emergency-stop-button"
          >
            {isSendingEmergencyStop ? 'Enviando parada...' : 'PARADA DE EMERGENCIA'}
          </button>
          <small className="emergency-stop-hint">Apaga todo el sistema de inmediato.</small>
        </div>
      </main>

      {error && (
        <ErrorNotification message={error.message} type={error.type || 'error'} duration={5000} />
      )}

      {showDeviceRegistrationModal && (
        <div className="modal-overlay" onClick={() => setShowDeviceRegistrationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDeviceRegistrationModal(false)}>
              &times;
            </button>
            <DeviceRegistration />
          </div>
        </div>
      )}

      <AppTutorial
        isOpen={showTutorial}
        onDemoPhChange={setTutorialDemoPh}
        onClose={(reason) => {
          setTutorialDemoPh(null);
          setShowTutorial(false);
          if (reason === 'completed' || reason === 'skipped') {
            markTutorialAsSeen();
          }
        }}
      />

      <ConfirmDialog
        isOpen={showEmergencyStopConfirm}
        title="Confirmar parada de emergencia"
        message="Se enviara una orden inmediata para detener bombas, sensor y LCD del ESP32."
        details="Usa esta accion solo si notas una condicion insegura o comportamiento anormal."
        confirmLabel="Enviar parada"
        tone="danger"
        isLoading={isSendingEmergencyStop}
        onCancel={() => setShowEmergencyStopConfirm(false)}
        onConfirm={handleEmergencyStop}
      />
    </>
  );
}
