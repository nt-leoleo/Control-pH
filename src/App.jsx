import { useContext, useState, useEffect } from 'react';
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
import { PHContext } from './PHContext';
import { useAuth } from './useAuth';
import './App.css';

export default function App() {
  const { ph, error, dosingMode, setDosingMode, isConfigured } = useContext(PHContext);
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState('main');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [showSplash, setShowSplash] = useState(true);

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

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
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

      <main className="fade-in app-main">
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
      </main>

      {error && (
        <ErrorNotification message={error.message} type={error.type || 'error'} duration={5000} />
      )}
    </>
  );
}
