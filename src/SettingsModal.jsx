import { useContext, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
import './SettingsModal.css';
import { logError } from './errorUtils';

const SettingsModal = ({ isOpen, onClose }) => {
    const { phTolerance, setPhTolerance, phToleranceRange, setPhToleranceRange, setError } = useContext(PHContext);
    const [tempTolerance, setTempTolerance] = useState(phTolerance);
    const [tempToleranceRange, setTempToleranceRange] = useState(phToleranceRange);

    useEffect(() => {
        if (isOpen) {
            setTempTolerance(phTolerance);
            setTempToleranceRange(phToleranceRange);
        }
    }, [isOpen, phTolerance, phToleranceRange]);

    const handleSave = () => {
        try {
            if (isNaN(tempTolerance) || isNaN(tempToleranceRange)) {
                throw new Error('Los valores deben ser números válidos');
            }
            
            setPhTolerance(tempTolerance);
            setPhToleranceRange(tempToleranceRange);
            logError('SETTINGS_SAVED', 'Configuración guardada exitosamente', { 
                tolerance: tempTolerance, 
                range: tempToleranceRange 
            });
            onClose();
        } catch (err) {
            logError('SETTINGS_SAVE_ERROR', err.message, { tempTolerance, tempToleranceRange });
            setError({ type: 'error', message: err.message });
        }
    };

    const handleCancel = () => {
        try {
            setTempTolerance(phTolerance);
            setTempToleranceRange(phToleranceRange);
            onClose();
        } catch (err) {
            logError('SETTINGS_CANCEL_ERROR', err.message);
            setError({ type: 'error', message: 'Error al cancelar la configuración' });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modalOverlay" onClick={handleCancel}>
            <div className="modalContent" onClick={(e) => e.stopPropagation()}>
                <div className="modalHeader">
                    <h2>Configuración</h2>
                    <button className="closeButton" onClick={handleCancel}>✕</button>
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
                            value={tempTolerance}
                            onChange={(e) => setTempTolerance(parseFloat(e.target.value))}
                            className="slider"
                        />
                        <div className="toleranceValue">{tempTolerance.toFixed(1)}</div>
                    </div>

                    <div className="sliderContainer">
                        <label htmlFor="phToleranceRange">Rango de tolerancia (±)</label>
                        <input 
                            id="phToleranceRange"
                            type="range" 
                            min="0.1" 
                            max="1" 
                            step="0.1" 
                            value={tempToleranceRange}
                            onChange={(e) => setTempToleranceRange(parseFloat(e.target.value))}
                            className="slider"
                        />
                        <div className="toleranceValue">{tempToleranceRange.toFixed(1)}</div>
                    </div>
                </div>

                <div className="modalFooter">
                    <button className="btnCancel" onClick={handleCancel}>Cancelar</button>
                    <button className="btnSave" onClick={handleSave}>Guardar</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
