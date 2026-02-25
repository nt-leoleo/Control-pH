import { useContext, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
import WiFiConfig from './WiFiConfig';
import './SettingsModal.css';
import { logError } from './errorUtils';

const SettingsModal = ({ isOpen, onClose }) => {
    const { phTolerance, setPhTolerance, phToleranceRange, setPhToleranceRange, alkalinity, setAlkalinity, chlorineType, setChlorineType, acidType, setAcidType, setError } = useContext(PHContext);
    const [tempTolerance, setTempTolerance] = useState(phTolerance);
    const [tempToleranceRange, setTempToleranceRange] = useState(phToleranceRange);
    const [tempAlkalinity, setTempAlkalinity] = useState(alkalinity);
    const [tempChlorineType, setTempChlorineType] = useState(chlorineType);
    const [tempAcidType, setTempAcidType] = useState(acidType);
    const [wifiConfigOpen, setWifiConfigOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTempTolerance(phTolerance);
            setTempToleranceRange(phToleranceRange);
            setTempAlkalinity(alkalinity);
            setTempChlorineType(chlorineType);
            setTempAcidType(acidType);
        }
    }, [isOpen, phTolerance, phToleranceRange, alkalinity, chlorineType, acidType]);

    const handleSave = async () => {
        try {
            if (isNaN(tempTolerance) || isNaN(tempToleranceRange) || isNaN(tempAlkalinity)) {
                throw new Error('Los valores deben ser números válidos');
            }
            
            // Guardar todas las configuraciones de forma asíncrona
            await Promise.all([
                setPhTolerance(tempTolerance),
                setPhToleranceRange(tempToleranceRange),
                setAlkalinity(tempAlkalinity),
                setChlorineType(tempChlorineType),
                setAcidType(tempAcidType)
            ]);
            
            logError('SETTINGS_SAVED', 'Configuración guardada exitosamente', { 
                tolerance: tempTolerance, 
                range: tempToleranceRange,
                alkalinity: tempAlkalinity,
                chlorineType: tempChlorineType,
                acidType: tempAcidType
            });
            onClose();
        } catch (err) {
            console.error('❌ [SettingsModal] Error guardando configuración:', err);
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
            setWifiConfigOpen(false); // Cerrar también el WiFi config
            onClose();
        } catch (err) {
            logError('SETTINGS_CANCEL_ERROR', err.message);
            setError({ type: 'error', message: 'Error al cancelar la configuración' });
        }
    };

    const handleWifiConfigSuccess = () => {
        setWifiConfigOpen(false);
        setError({ type: 'success', message: 'WiFi configurado correctamente. El ESP32 se reiniciará.' });
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

                    <div className="esp32ConfigSection">
                        <h3>🔧 Configuración del ESP32</h3>
                        <p>Configura la conexión WiFi del dispositivo ESP32</p>
                        <button 
                            className="esp32ConfigButton"
                            onClick={() => setWifiConfigOpen(true)}
                        >
                            📡 Configuración de ESP32
                        </button>
                    </div>
                </div>

                <div className="modalFooter">
                    <button className="btnCancel" onClick={handleCancel}>Cancelar</button>
                    <button className="btnSave" onClick={handleSave}>Guardar</button>
                </div>
            </div>
            
            {/* Componente de configuración WiFi */}
            <WiFiConfig 
                isOpen={wifiConfigOpen}
                onClose={() => setWifiConfigOpen(false)}
                onSuccess={handleWifiConfigSuccess}
            />
        </div>
    );
};

export default SettingsModal;
