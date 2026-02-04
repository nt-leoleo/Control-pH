import { useContext, useState, useEffect } from "react";
import Header from "./Header";
import ShowpH from "./ShowpH";
import HandleAdmin from "./HandleAdmin";
import PHBar from "./PHBar";
import PHChart from "./PHChart";
import ManualDosing from "./ManualDosing";
import Onboarding from "./Onboarding";
import SettingsModal from "./SettingsModal";
import ErrorNotification from "./ErrorNotification";
import { PHContext } from "./PHContext";
import "./App.css";

export default function App() {
  const { ph, setPH, phTolerance, phToleranceRange, error, setError, dosingMode, setDosingMode, isConfigured } = useContext(PHContext);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState('dark'); // Modo nocturno por defecto

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
      <Header onConfigClick={() => setSettingsOpen(true)} />
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
          <div className="slide-in">
            <ManualDosing />
          </div>
        )}

        <div className="mode-toggle-container">
          <button 
            onClick={() => setDosingMode(dosingMode === 'automatic' ? 'manual' : 'automatic')}
            className={`mode-toggle-button ${dosingMode === 'automatic' ? 'mode-toggle-button--automatic' : 'mode-toggle-button--manual'}`}
          >
            <span>🔧 Modo: {dosingMode === 'automatic' ? 'AUTOMÁTICO' : 'MANUAL'}</span>
            <br />
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

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
