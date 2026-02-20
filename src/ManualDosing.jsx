import { useContext, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
import { calculatePHChange, validateDosage, getChemicalInfo } from './dosageCalculations';
import { sendDosingCommandToFirebase, waitForCommandConfirmation } from './esp32Communication-firebase';
import { useAuth } from './useAuth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getConfiguredProducts, getChemicalName } from './chemicalLabels';
import './ManualDosing.css';

const ManualDosing = () => {
    const {
        manualDosingConfig,
        setManualDosingConfig,
        setDosingHistory,
        setError,
        ph,
        poolVolume,
        alkalinity,
        esp32Connected,
        chlorineType,
        acidType
    } = useContext(PHContext);
    const { user } = useAuth();
    const [isAnimating] = useState(false);
    const [isDosing, setIsDosing] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const { raiseCode, lowerCode, raiseName, lowerName } = getConfiguredProducts(chlorineType, acidType);
    const allowedProducts = Array.from(new Set([raiseCode, lowerCode]));

    // Marcar como inicializado despuÃ©s del primer render
    useEffect(() => {
        const timer = setTimeout(() => setIsInitialized(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!allowedProducts.includes(manualDosingConfig.product)) {
            setManualDosingConfig(prev => ({
                ...prev,
                product: raiseCode
            }));
        }
    }, [allowedProducts, manualDosingConfig.product, raiseCode, setManualDosingConfig]);

    // Guardar configuraciÃ³n en Firebase cuando cambie (solo despuÃ©s de inicializar)
    useEffect(() => {
        if (!isInitialized) return; // No guardar durante la carga inicial
        
        const saveManualDosingConfig = async () => {
            if (user && manualDosingConfig) {
                try {
                    const userDocRef = doc(db, 'users', user.uid);
                    await setDoc(userDocRef, {
                        lastManualDosingConfig: {
                            product: manualDosingConfig.product,
                            minutes: manualDosingConfig.minutes,
                            seconds: manualDosingConfig.seconds,
                            liters: manualDosingConfig.liters,
                            lastUpdated: new Date().toISOString()
                        }
                    }, { merge: true });
                    console.log('ðŸ’¾ ConfiguraciÃ³n de dosificaciÃ³n guardada:', {
                        product: manualDosingConfig.product,
                        minutes: manualDosingConfig.minutes,
                        seconds: manualDosingConfig.seconds,
                        liters: manualDosingConfig.liters
                    });
                } catch (error) {
                    console.error('âŒ Error guardando configuraciÃ³n:', error);
                }
            }
        };

        // Debounce para no guardar en cada tecla
        const timeoutId = setTimeout(saveManualDosingConfig, 1000);
        return () => clearTimeout(timeoutId);
    }, [user, manualDosingConfig, isInitialized]);

    // Calcular el pH estimado despuÃ©s de la dosificaciÃ³n
    const calculateEstimatedPH = () => {
        const { product, liters } = manualDosingConfig;
        
        if (!poolVolume || liters <= 0) {
            return null;
        }

        try {
            const phChange = calculatePHChange(product, liters, poolVolume, alkalinity || 100);
            const estimatedPH = ph + phChange;
            return {
                change: phChange,
                final: estimatedPH,
                isValid: estimatedPH >= 0 && estimatedPH <= 14 // Permitir rango completo de pH
            };
        } catch (error) {
            return null;
        }
    };

    const phEstimate = calculateEstimatedPH();

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

    const handleDosify = async () => {
        try {
            const { product, minutes, seconds, liters } = manualDosingConfig;
            
            if (liters <= 0) {
                throw new Error('La cantidad de litros debe ser mayor a 0');
            }

            if (!poolVolume) {
                throw new Error('Volumen de piscina no configurado');
            }

            // Validar dosificaciÃ³n
            const validation = validateDosage(product, liters, poolVolume, ph);
            if (!validation.valid) {
                setError({ type: 'warning', message: validation.message });
                return;
            }

            // Calcular duraciÃ³n total en segundos
            const totalSeconds = (minutes * 60) + seconds;
            
            if (totalSeconds <= 0) {
                throw new Error('La duraciÃ³n debe ser mayor a 0 segundos');
            }

            if (totalSeconds > 300) {
                throw new Error('DuraciÃ³n mÃ¡xima: 5 minutos (300 segundos)');
            }

            if (!user?.uid) {
                throw new Error('Usuario no autenticado');
            }

            setIsDosing(true);
            setError({ type: 'info', message: 'â³ Enviando comando a Firebase...' });

            console.log('ðŸ”§ [ManualDosing] Enviando comando vÃ­a Firebase');
            
            // Enviar comando a Firebase Realtime Database
            const result = await sendDosingCommandToFirebase(user.uid, product, totalSeconds);
            
            if (result.success) {
                const commandId = result.commandId;
                console.log(`ðŸ“¤ [ManualDosing] Comando enviado (ID: ${commandId})`);
                
                setError({ 
                    type: 'info', 
                    message: `â³ Arduino ejecutando dosificaciÃ³n (${totalSeconds}s)... Esperando confirmaciÃ³n` 
                });
                
                // Esperar confirmaciÃ³n del Arduino (mÃ¡ximo 60 segundos)
                const confirmed = await waitForCommandConfirmation(user.uid, commandId, 60000);
                
                if (confirmed) {
                    console.log('âœ… [ManualDosing] Arduino confirmÃ³ que terminÃ³ la dosificaciÃ³n');
                    
                    // Calcular cambio de pH
                    const phChange = calculatePHChange(product, liters, poolVolume, alkalinity);
                    const chemInfo = getChemicalInfo(product);
                    
                    // Registrar en historial
                    const now = new Date();
                    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    
                    const dosingRecord = {
                        timestamp: timeString,
                        product,
                        productName: chemInfo.name,
                        duration: { minutes, seconds },
                        durationSeconds: totalSeconds,
                        liters,
                        phChangeBefore: ph,
                        phChangeAfter: ph + phChange,
                        expectedChange: phChange,
                        status: 'completado',
                        confirmed: true,
                        method: 'firebase',
                        commandId: commandId
                    };

                    setDosingHistory(prev => [...prev, dosingRecord]);
                    
                    // Mensaje de Ã©xito
                    const isPhPlus = product === 'sodium-hypochlorite' || product === 'calcium-hypochlorite';
                    const relayNum = isPhPlus ? '1' : '2';
                    setError({ 
                        type: 'success', 
                        message: `âœ… DosificaciÃ³n completada y confirmada: ${liters}L de ${chemInfo.name} (RelÃ© ${relayNum})` 
                    });
                } else {
                    console.warn('âš ï¸ [ManualDosing] No se recibiÃ³ confirmaciÃ³n del Arduino (timeout)');
                    setError({ 
                        type: 'warning', 
                        message: `âš ï¸ Comando enviado pero no se recibiÃ³ confirmaciÃ³n del Arduino. Verifica que estÃ© conectado.` 
                    });
                }
                
                setIsDosing(false);

            } else {
                throw new Error(result.message || 'Error enviando comando de dosificaciÃ³n');
            }

        } catch (err) {
            console.error('âŒ [ManualDosing] Error en dosificaciÃ³n:', err);
            setError({ type: 'error', message: err.message });
            setIsDosing(false);
        }
    };

    const productDirectionLabel = (product) => {
        if (product === raiseCode) return 'Subir pH';
        if (product === lowerCode) return 'Bajar pH';
        return 'Correccion';
    };

    const productRelayLabel = (product) => {
        return ['muriatic', 'bisulfate', 'chlorine-gas'].includes(product)
            ? 'Relay 2 (GPIO 5)'
            : 'Relay 1 (GPIO 4)';
    };

    return (
        <div className="manualDosingContainer">
            <h3>DosificaciÃ³n Manual</h3>
            
            <div className="dosingSection">
                <label>Producto a aplicar:</label>
                <div className="productButtons">
                    {allowedProducts.map((product) => (
                        <button 
                            key={product}
                            className={`productBtn ${manualDosingConfig.product === product ? 'active' : ''}`}
                            onClick={() => handleProductChange(product)}
                            disabled={isAnimating}
                        >
                            {productDirectionLabel(product)} - {getChemicalName(product)}
                            <small style={{ display: 'block', fontSize: '0.75em', marginTop: '0.3em', opacity: 0.8 }}>
                                {productRelayLabel(product)}
                            </small>
                        </button>
                    ))}
                </div>
                <small style={{ display: 'block', marginTop: '0.5em', opacity: 0.75 }}>
                    Productos configurados: subir pH con {raiseName} y bajar pH con {lowerName}.
                </small>
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

            {/* Estimado de pH final */}
            {phEstimate && (
                <div className="phEstimateSection">
                    <div className="estimateHeader">
                        <span>ðŸ“Š Estimado despuÃ©s de dosificar:</span>
                    </div>
                    <div className={`phEstimate ${phEstimate.isValid ? 'valid' : 'warning'}`}>
                        <div className="estimateRow">
                            <span>pH actual:</span>
                            <span className="currentPh">{ph.toFixed(2)}</span>
                        </div>
                        <div className="estimateRow">
                            <span>Cambio esperado:</span>
                            <span className={`phChange ${phEstimate.change >= 0 ? 'positive' : 'negative'}`}>
                                {phEstimate.change >= 0 ? '+' : ''}{phEstimate.change.toFixed(2)}
                            </span>
                        </div>
                        <div className="estimateRow final">
                            <span>pH final estimado:</span>
                            <span className={`finalPh ${phEstimate.isValid ? 'valid' : 'invalid'}`}>
                                {phEstimate.final.toFixed(2)}
                            </span>
                        </div>
                        {!phEstimate.isValid && (
                            <div className="warningText">
                                âš ï¸ pH fuera del rango seguro (6.0 - 8.5)
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Indicador de conexiÃ³n ESP32 */}
            <div className="esp32-connection-status">
                <span className={`connection-indicator ${esp32Connected ? 'connected' : 'disconnected'}`}>
                    {esp32Connected ? 'ðŸŸ¢ ESP32 Conectado' : 'ðŸ”´ ESP32 Desconectado'}
                </span>
                {!esp32Connected && (
                    <small>Los comandos de dosificaciÃ³n requieren conexiÃ³n con el ESP32</small>
                )}
            </div>

            <button 
                className="dosifyBtn" 
                onClick={handleDosify}
                disabled={isAnimating || isDosing || !esp32Connected}
            >
                {isDosing ? 'â³ Dosificando... Esperando ESP32' : 
                 isAnimating ? 'ðŸ“Š Simulando cambio...' : 
                 !esp32Connected ? 'ðŸ”´ ESP32 Desconectado' :
                 'DOSIFICAR'}
            </button>
        </div>
    );
};

export default ManualDosing;

