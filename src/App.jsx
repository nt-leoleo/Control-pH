import { useContext, useState } from "react";
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

  // Si no está configurado, mostrar onboarding
  if (!isConfigured) {
    return <Onboarding />;
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
      <main>
        <ShowpH />
        <HandleAdmin />
        <PHBar ph={ph} />
        <PHChart />
        <input 
          type="number" 
          value={ph} 
          onChange={handlePHChange}
          min="6"
          max="8"
          step="0.1"
          className={`ph-input ${isOutOfRange ? 'ph-input--out-of-range' : 'ph-input--in-range'}`}
          title={isOutOfRange ? `pH fuera del rango ideal (${phTolerance} ± ${phToleranceRange})` : 'pH dentro del rango ideal'}
        />
        
        {dosingMode === 'manual' && <ManualDosing />}

        <div className="mode-toggle-container">
          <button 
            onClick={() => setDosingMode(dosingMode === 'automatic' ? 'manual' : 'automatic')}
            className={`mode-toggle-button ${dosingMode === 'automatic' ? 'mode-toggle-button--automatic' : 'mode-toggle-button--manual'}`}
          >
            Modo: {dosingMode === 'automatic' ? 'AUTOMÁTICO' : 'MANUAL'} → Cambiar a {dosingMode === 'automatic' ? 'MANUAL' : 'AUTOMÁTICO'}
          </button>
        </div>
      </main>
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
