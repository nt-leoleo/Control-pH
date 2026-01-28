import { useContext } from 'react';
import { PHContext } from './PHContext';
import './SettingsModal.css';

const SettingsModal = ({ isOpen, onClose }) => {
    const { phTolerance, setPhTolerance, phToleranceRange, setPhToleranceRange } = useContext(PHContext);

    if (!isOpen) return null;

    return (
        <div className="modalOverlay" onClick={onClose}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                    <h2>Configuración</h2>
                    <button className="closeButton" onClick={onClose}>✕</button>
                </div>
                
                <div className="modalBody">
                    <div className="sliderContainer">
                        <label htmlFor="phTolerance">Nivel de pH óptimo</label>
                        <input 
                            id="phTolerance"
                            type="range" 
                            min="6" 
                            max="8" 
                            step="0.1" 
                            value={phTolerance}
                            onChange={(e) => setPhTolerance(parseFloat(e.target.value))}
                            className="slider"
                        />
                        <div className="toleranceValue">{phTolerance.toFixed(1)}</div>
                    </div>

                    <div className="sliderContainer">
                        <label htmlFor="phToleranceRange">Rango de tolerancia (±)</label>
                        <input 
                            id="phToleranceRange"
                            type="range" 
                            min="0.1" 
                            max="1" 
                            step="0.1" 
                            value={phToleranceRange}
                            onChange={(e) => setPhToleranceRange(parseFloat(e.target.value))}
                            className="slider"
                        />
                        <div className="toleranceValue">{phToleranceRange.toFixed(1)}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
