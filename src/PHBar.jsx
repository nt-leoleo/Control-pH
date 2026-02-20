import './PHBar.css';
import { useContext } from 'react';
import { PHContext } from './PHContext';

const PHBar = ({ ph }) => {
  const { phTolerance, phToleranceRange } = useContext(PHContext);
  const minPH = 0;
  const maxPH = 14;

  const markerPosition = Math.min(100, Math.max(0, ((ph - minPH) / (maxPH - minPH)) * 100));

  const idealMin = phTolerance - phToleranceRange;
  const idealMax = phTolerance + phToleranceRange;
  const idealLeft = Math.max(0, ((idealMin - minPH) / (maxPH - minPH)) * 100);
  const idealRight = Math.min(100, ((idealMax - minPH) / (maxPH - minPH)) * 100);

  return (
    <section className="ph-scale">
      <div className="ph-scale-header">
        <h3>Escala de pH</h3>
        <span className="ph-scale-current">Actual {ph.toFixed(2)}</span>
      </div>

      <div className="ph-scale-track">
        <div className="ph-scale-gradient"></div>
        <div
          className="ph-scale-target"
          style={{
            left: `${idealLeft}%`,
            width: `${Math.max(0, idealRight - idealLeft)}%`,
          }}
        ></div>
        <div className="ph-scale-marker" style={{ left: `${markerPosition}%` }}></div>
      </div>

      <div className="ph-scale-labels">
        <span>0</span>
        <span>7</span>
        <span>14</span>
      </div>

      <p className="ph-scale-range">
        Rango ideal configurado: {idealMin.toFixed(1)} - {idealMax.toFixed(1)}
      </p>
    </section>
  );
};

export default PHBar;
