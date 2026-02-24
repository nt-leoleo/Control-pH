import './PHBar.css';
import { useContext } from 'react';
import { PHContext } from './PHContext';
import InfoHint from './InfoHint';

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
    <section className="ph-scale" data-tutorial="ph-scale">
      <div className="ph-scale-header" data-tutorial="ph-scale-header">
        <h3 className="ph-scale-title-with-info">
          <span>Escala de pH</span>
          <InfoHint
            size="sm"
            title="Escala de pH"
            text="El pH va de 0 a 14. Cerca de 7 es neutro. El sistema busca mantener el valor dentro del rango ideal configurado."
          />
        </h3>
        <span className="ph-scale-current">Actual {ph.toFixed(2)}</span>
      </div>

      <div className="ph-scale-track" data-tutorial="ph-scale-track">
        <div className="ph-scale-gradient" data-tutorial="ph-scale-gradient"></div>
        <div
          className="ph-scale-target"
          data-tutorial="ph-scale-target"
          style={{
            left: `${idealLeft}%`,
            width: `${Math.max(0, idealRight - idealLeft)}%`,
          }}
        ></div>
        <div className="ph-scale-marker" data-tutorial="ph-scale-marker" style={{ left: `${markerPosition}%` }}></div>
      </div>

      <div className="ph-scale-labels" data-tutorial="ph-scale-labels">
        <span>0</span>
        <span>7</span>
        <span>14</span>
      </div>

      <p className="ph-scale-range" data-tutorial="ph-scale-range">
        Rango ideal configurado: {idealMin.toFixed(1)} - {idealMax.toFixed(1)}
      </p>
    </section>
  );
};

export default PHBar;
