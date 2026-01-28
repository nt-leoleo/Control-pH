import { useContext, useState } from 'react';
import { PHContext } from './PHContext';
import { calculatePHChange, interpolatePhChange, validateDosage, getChemicalInfo } from './dosageCalculations';
import './ManualDosing.css';

const ManualDosing = () => {
    const { manualDosingConfig, setManualDosingConfig, dosingHistory, setDosingHistory, setError, ph, setPH, poolVolume, alkalinity } = useContext(PHContext);
    const [isAnimating, setIsAnimating] = useState(false);

    const handleProductChange = (product) => {
        setManualDosingConfig(prev => ({
            ...prev,
            product
        }));
    };

    const handleTimeChange = (field, value) => {
        const numValue = Math.max(0, parseInt(value) || 0);
        setManualDosingConfig(prev => ({
            ...prev,
            [field]: numValue
        }));
    };

    const handleLitersChange = (value) => {
        const numValue = Math.max(0, parseFloat(value) || 0);
        setManualDosingConfig(prev => ({
            ...prev,
            liters: numValue
        }));
    };

    const handleDosify = () => {
        try {
            const { product, minutes, seconds, liters } = manualDosingConfig;
            
            if (liters <= 0) {
                throw new Error('La cantidad de litros debe ser mayor a 0');
            }

            if (!poolVolume) {
                throw new Error('Volumen de piscina no configurado');
            }

            // Validar dosificación
            const validation = validateDosage(product, liters, poolVolume, ph);
            if (!validation.valid) {
                setError({ type: 'warning', message: validation.message });
                return;
            }

            // Desplazar pantalla al tope para ver el cambio de pH
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Calcular cambio de pH
            const phChange = calculatePHChange(product, liters, poolVolume, alkalinity);
            const chemInfo = getChemicalInfo(product);

            // Obtener valores interpolados para animación (10 segundos = 20 frames @ 500ms)
            const phValues = interpolatePhChange(ph, phChange, 20);

            // Animar el cambio de pH
            setIsAnimating(true);
            let frameIndex = 0;

            const animationInterval = setInterval(() => {
                if (frameIndex < phValues.length) {
                    setPH(phValues[frameIndex]);
                    frameIndex++;
                } else {
                    clearInterval(animationInterval);
                    setIsAnimating(false);
                }
            }, 500); // 500ms entre frames = 10 segundos totales

            // Registrar en historial
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            const dosingRecord = {
                timestamp: timeString,
                product,
                productName: chemInfo.name,
                duration: { minutes, seconds },
                liters,
                phChangeBefore: ph,
                phChangeAfter: ph + phChange,
                expectedChange: phChange,
                status: 'completado'
            };

            setDosingHistory(prev => [...prev, dosingRecord]);
            
            setError({ 
                type: 'success', 
                message: `✓ Dosificación: ${liters}L de ${chemInfo.name} (cambio esperado: ${phChange > 0 ? '+' : ''}${phChange.toFixed(2)} pH)` 
            });
        } catch (err) {
            setError({ type: 'error', message: err.message });
        }
    };

    return (
        <div className="manualDosingContainer">
            <h3>Dosificación Manual</h3>
            
            <div className="dosingSection">
                <label>Producto a aplicar:</label>
                <div className="productButtons">
                    <button 
                        className={`productBtn ${manualDosingConfig.product === 'sodium-hypochlorite' ? 'active' : ''}`}
                        onClick={() => handleProductChange('sodium-hypochlorite')}
                        disabled={isAnimating}
                    >
                        ↑ Hipoclorito de Sodio (Sube pH)
                    </button>
                    <button 
                        className={`productBtn ${manualDosingConfig.product === 'muriatic' ? 'active' : ''}`}
                        onClick={() => handleProductChange('muriatic')}
                        disabled={isAnimating}
                    >
                        ↓ Ácido Muriático (Baja pH)
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5em' }}>
                    <button 
                        className={`productBtn small ${manualDosingConfig.product === 'calcium-hypochlorite' ? 'active' : ''}`}
                        onClick={() => handleProductChange('calcium-hypochlorite')}
                        disabled={isAnimating}
                    >
                        Hipoclorito Ca
                    </button>
                    <button 
                        className={`productBtn small ${manualDosingConfig.product === 'bisulfate' ? 'active' : ''}`}
                        onClick={() => handleProductChange('bisulfate')}
                        disabled={isAnimating}
                    >
                        Bisulfato
                    </button>
                    <button 
                        className={`productBtn small ${manualDosingConfig.product === 'chlorine-gas' ? 'active' : ''}`}
                        onClick={() => handleProductChange('chlorine-gas')}
                        disabled={isAnimating}
                    >
                        Cloro Gas
                    </button>
                </div>
            </div>

            <div className="dosingSection">
                <label>Tiempo de dosificado:</label>
                <div className="timeInputs">
                    <div className="timeGroup">
                        <input 
                            type="number" 
                            min="0" 
                            max="59"
                            value={manualDosingConfig.minutes}
                            onChange={(e) => handleTimeChange('minutes', e.target.value)}
                            disabled={isAnimating}
                        />
                        <span>minutos</span>
                    </div>
                    <div className="timeGroup">
                        <input 
                            type="number" 
                            min="0" 
                            max="59"
                            value={manualDosingConfig.seconds}
                            onChange={(e) => handleTimeChange('seconds', e.target.value)}
                            disabled={isAnimating}
                        />
                        <span>segundos</span>
                    </div>
                </div>
            </div>

            <div className="dosingSection">
                <label>Cantidad (litros):</label>
                <input 
                    type="number" 
                    min="0" 
                    step="0.5"
                    value={manualDosingConfig.liters}
                    onChange={(e) => handleLitersChange(e.target.value)}
                    disabled={isAnimating}
                    className="litersInput"
                />
            </div>

            <button 
                className="dosifyBtn" 
                onClick={handleDosify}
                disabled={isAnimating}
            >
                {isAnimating ? '⏳ Dosificando...' : 'DOSIFICAR'}
            </button>
        </div>
    );
};

export default ManualDosing;
