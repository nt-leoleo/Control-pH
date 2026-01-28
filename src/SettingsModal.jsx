import { useContext, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
import './SettingsModal.css';
import { logError } from './errorUtils';

const SettingsModal = ({ isOpen, onClose }) => {
    const { phTolerance, setPhTolerance, phToleranceRange, setPhToleranceRange, alkalinity, setAlkalinity, chlorineType, setChlorineType, acidType, setAcidType, setError } = useContext(PHContext);
    const [tempTolerance, setTempTolerance] = useState(phTolerance);
    const [tempToleranceRange, setTempToleranceRange] = useState(phToleranceRange);
    const [tempAlkalinity, setTempAlkalinity] = useState(alkalinity);
    const [tempChlorineType, setTempChlorineType] = useState(chlorineType);
    const [tempAcidType, setTempAcidType] = useState(acidType);

    useEffect(() => {
        if (isOpen) {
            setTempTolerance(phTolerance);
            setTempToleranceRange(phToleranceRange);
            setTempAlkalinity(alkalinity);
            setTempChlorineType(chlorineType);
            setTempAcidType(acidType);
        }
    }, [isOpen, phTolerance, phToleranceRange, alkalinity, chlorineType, acidType]);

    const handleSave = () => {
        try {
            if (isNaN(tempTolerance) || isNaN(tempToleranceRange) || isNaN(tempAlkalinity)) {
                throw new Error('Los valores deben ser números válidos');
            }
            
            setPhTolerance(tempTolerance);
            setPhToleranceRange(tempToleranceRange);
            setAlkalinity(tempAlkalinity);
            setChlorineType(tempChlorineType);
            setAcidType(tempAcidType);
            logError('SETTINGS_SAVED', 'Configuración guardada exitosamente', { 
                tolerance: tempTolerance, 
                range: tempToleranceRange,
                alkalinity: tempAlkalinity,
                chlorineType: tempChlorineType,
                acidType: tempAcidType
            });
            onClose();
        } catch (err) {
            logError('SETTINGS_SAVE_ERROR', err.message);
            setError({ type: 'error', message: err.message });
        }
    };

    const handleCancel = () => {
        try {
            setTempTolerance(phTolerance);
            setTempToleranceRange(phToleranceRange);
            setTempAlkalinity(alkalinity);
            setTempChlorineType(chlorineType);
            setTempAcidType(acidType);
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

                    <div className="sliderContainer">
                        <label htmlFor="alkalinity">Alcalinidad Total (ppm)</label>
                        <input 
                            id="alkalinity"
                            type="number" 
                            min="50"
                            max="200"
                            step="10"
                            value={tempAlkalinity}
                            onChange={(e) => setTempAlkalinity(parseFloat(e.target.value))}
                            className="numberInput"
                        />
                        <div className="toleranceValue">{tempAlkalinity} ppm</div>
                    </div>

                    <div className="selectContainer">
                        <label htmlFor="chlorineType">Tipo de Cloro</label>
                        <select 
                            id="chlorineType"
                            value={tempChlorineType}
                            onChange={(e) => setTempChlorineType(e.target.value)}
                            className="selectInput"
                        >
                            <option value="sodium-hypochlorite">Hipoclorito de Sodio</option>
                            <option value="calcium-hypochlorite">Hipoclorito de Calcio</option>
                            <option value="chlorine-gas">Cloro Gas</option>
                        </select>
                    </div>

                    <div className="selectContainer">
                        <label htmlFor="acidType">Tipo de Ácido (para bajar pH)</label>
                        <select 
                            id="acidType"
                            value={tempAcidType}
                            onChange={(e) => setTempAcidType(e.target.value)}
                            className="selectInput"
                        >
                            <option value="muriatic">Ácido Muriático</option>
                            <option value="bisulfate">Bisulfato de Sodio</option>
                        </select>
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
