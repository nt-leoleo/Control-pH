import { useContext, useState, useEffect } from "react";
import Header from "./Header";
import ShowpH from "./ShowpH";
import HandleAdmin from "./HandleAdmin";
import PHBar from "./PHBar";
import PHChart from "./PHChart";
import ManualDosing from "./ManualDosing";
import AutomaticDosing from "./AutomaticDosing";
import Onboarding from "./Onboarding";
import SettingsPage from "./SettingsPage";
import PoolManager from "./PoolManager";
import ErrorNotification from "./ErrorNotification";
import LoginScreen from "./LoginScreen";
import { PHContext } from "./PHContext";
import { useAuth } from "./useAuth";
import "./App.css";

export default function App() {
  const { ph, setPH, phTolerance, phToleranceRange, error, setError, dosingMode, setDosingMode, isConfigured } = useContext(PHContext);
  const { user, userConfig, loading } = useAuth();
  const [currentView, setCurrentView] = useState('main'); // 'main', 'settings', 'pool-manager'
  const [theme, setTheme] = useState('dark'); // Modo nocturno por defecto

  // Escuchar cambios en el hash para navegación
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
    handleHashChange(); // Verificar hash inicial

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Cargar tema guardado al iniciar
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Función para cambiar tema
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-container">
          <h1>🧪 Control Pileta pH</h1>
          <div className="loading-spinner"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  // Si no hay usuario autenticado, mostrar pantalla de login
  if (!user) {
    return <LoginScreen />;
  }

  // Si no está configurado, mostrar onboarding
  if (!isConfigured) {
    return (
      <>
        <Onboarding />
        <button 
          className="theme-toggle" 
          onClick={toggleTheme}
          title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </>
    );
  }

  // Si está en vista de configuración, mostrar página de configuración
  if (currentView === 'settings') {
    return (
      <>
        <SettingsPage onBack={() => {
          setCurrentView('main');
          window.location.hash = '';
        }} />
        <button 
          className="theme-toggle" 
          onClick={toggleTheme}
          title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </>
    );
  }

  // Si está en vista de administrador de piscinas
  if (currentView === 'pool-manager') {
    return (
      <>
        <PoolManager onBack={() => {
          setCurrentView('settings');
          window.location.hash = 'settings';
        }} />
        <button 
          className="theme-toggle" 
          onClick={toggleTheme}
          title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </>
    );
  }

  const handlePHChange = (e) => {
    try {
      setPH(parseFloat(e.target.value));
    } catch (err) {
      setError({ type: 'error', message: err.message });
    }
  };

  // Validación visual para el input de pH
  const isOutOfRange = Math.abs(ph - phTolerance) > phToleranceRange;

  return (
    <>
      <Header onConfigClick={() => {
        setCurrentView('settings');
        window.location.hash = 'settings';
      }} />
      <main className="fade-in">
        <ShowpH />
        <HandleAdmin />
        <PHBar ph={ph} />
        <PHChart />
        <input 
          type="number" 
          value={ph} 
          onChange={handlePHChange}
          min="0"
          max="14"
          step="0.1"
          className={`ph-input ${isOutOfRange ? 'ph-input--out-of-range' : 'ph-input--in-range'}`}
          title={isOutOfRange ? `pH fuera del rango ideal (${phTolerance} ± ${phToleranceRange})` : 'pH dentro del rango ideal'}
          placeholder="Ingresa valor de pH"
        />
        
        {dosingMode === 'manual' && (
          <div className="scale-in">
            <ManualDosing />
          </div>
        )}

        {dosingMode === 'automatic' && (
          <div className="scale-in">
            <AutomaticDosing />
          </div>
        )}

        <div className="mode-toggle-container">
          <button 
            onClick={async () => {
              try {
                const newMode = dosingMode === 'automatic' ? 'manual' : 'automatic';
                await setDosingMode(newMode);
              } catch (error) {
                console.error('❌ [App] Error cambiando modo de dosificación:', error);
              }
            }}
            className={`mode-toggle-button ${dosingMode === 'automatic' ? 'mode-toggle-button--automatic' : 'mode-toggle-button--manual'}`}
          >
            <span>🔧 Modo: {dosingMode === 'automatic' ? 'AUTOMÁTICO' : 'MANUAL'}</span>
            <small>Toca para cambiar a {dosingMode === 'automatic' ? 'MANUAL' : 'AUTOMÁTICO'}</small>
          </button>
        </div>
      </main>

      {/* Botón de cambio de tema */}
      <button 
        className="theme-toggle" 
        onClick={toggleTheme}
        title={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {error && (
        <ErrorNotification 
          message={error.message} 
          type={error.type || 'error'} 
          duration={5000}
        />
      )}
    </>
  );
}
