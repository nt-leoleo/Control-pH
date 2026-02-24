import { useCallback, useContext, useState, useEffect } from 'react';
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
import { PHContext } from './PHContext';
import { useAuth } from './useAuth';
import { sendEmergencyStopCommand } from './esp32Communication-firebase';
import './App.css';

export default function App() {
  const { ph, error, setError, dosingMode, setDosingMode, isConfigured, ensureDeviceConfigured } =
    useContext(PHContext);
  const { user, loading, userConfig, updateUserConfig } = useAuth();
  const [currentView, setCurrentView] = useState('main');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [showSplash, setShowSplash] = useState(true);
  const [isSendingEmergencyStop, setIsSendingEmergencyStop] = useState(false);
  const [showDeviceRegistrationModal, setShowDeviceRegistrationModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialCheckedForUser, setTutorialCheckedForUser] = useState(false);

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
    const seenInAccount = userConfig?.tutorialCompleted !== false;

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

  const handleEmergencyStop = async () => {
    if (!user?.uid || isSendingEmergencyStop) {
      return;
    }

    if (!ensureDeviceConfigured('la parada de emergencia')) {
      return;
    }

    const confirmed = window.confirm(
      'Parada de emergencia: se apagaran bombas, sensor y LCD del ESP32. Continuar?'
    );
    if (!confirmed) {
      return;
    }

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
    return <Onboarding />;
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
      <Header
        onConfigClick={() => {
          setCurrentView('settings');
          window.location.hash = 'settings';
        }}
      />

      <main className="fade-in app-main" data-tutorial="dashboard-root">
        <div className="dashboard-stack">
          <ShowpH />
          <HandleAdmin />
          <PHBar ph={ph} />
          <PHChart />
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

        <div className="emergency-stop-container" data-tutorial="emergency-stop">
          <button
            onClick={handleEmergencyStop}
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
              ×
            </button>
            <DeviceRegistration />
          </div>
        </div>
      )}

      <AppTutorial
        isOpen={showTutorial}
        onClose={(reason) => {
          setShowTutorial(false);
          if (reason === 'completed' || reason === 'skipped') {
            markTutorialAsSeen();
          }
        }}
      />
    </>
  );
}
