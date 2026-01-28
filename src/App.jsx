import { useContext, useState } from "react";
import Header from "./Header";
import ShowpH from "./ShowpH";
import HandleAdmin from "./HandleAdmin";
import PHBar from "./PHBar";
import PHChart from "./PHChart";
import SettingsModal from "./SettingsModal";
import ErrorNotification from "./ErrorNotification";
import { PHContext } from "./PHContext";

export default function App() {
  const { ph, setPH, phTolerance, phToleranceRange, error, setError } = useContext(PHContext);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handlePHChange = (e) => {
    try {
      setPH(parseFloat(e.target.value));
    } catch (err) {
      setError({ type: 'error', message: err.message });
    }
  };

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
          style={{
            margin: '2em auto',
            padding: '0.5em',
            fontSize: '1em',
            borderRadius: '0.5em',
            border: 'none',
            backgroundColor: 'rgba(127, 255, 212, 0.2)',
            color: 'whitesmoke'
          }}
        />
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
