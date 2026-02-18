import { useContext, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
import { calculatePHChange, interpolatePhChange, validateDosage, getChemicalInfo } from './dosageCalculations';
import { sendDosingCommandToFirebase, waitForCommandConfirmation } from './esp32Communication-firebase';
import { useAuth } from './useAuth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import './ManualDosing.css';

const ManualDosing = () => {
    const { manualDosingConfig, setManualDosingConfig, dosingHistory, setDosingHistory, setError, ph, setPH, poolVolume, alkalinity, esp32Connected } = useContext(PHContext);
    const { user } = useAuth();
    const [isAnimating, setIsAnimating] = useState(false);
    const [isDosing, setIsDosing] = useState(false);
    const [dosingStatus, setDosingStatus] = useState(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Marcar como inicializado después del primer render
    useEffect(() => {
        const timer = setTimeout(() => setIsInitialized(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    // Guardar configuración en Firebase cuando cambie (solo después de inicializar)
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
                    console.log('💾 Configuración de dosificación guardada:', {
                        product: manualDosingConfig.product,
                        minutes: manualDosingConfig.minutes,
                        seconds: manualDosingConfig.seconds,
                        liters: manualDosingConfig.liters
                    });
                } catch (error) {
                    console.error('❌ Error guardando configuración:', error);
                }
            }
        };

        // Debounce para no guardar en cada tecla
        const timeoutId = setTimeout(saveManualDosingConfig, 1000);
        return () => clearTimeout(timeoutId);
    }, [user, manualDosingConfig, isInitialized]);

    // Calcular el pH estimado después de la dosificación
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

            // Validar dosificación
            const validation = validateDosage(product, liters, poolVolume, ph);
            if (!validation.valid) {
                setError({ type: 'warning', message: validation.message });
                return;
            }

            // Calcular duración total en segundos
            const totalSeconds = (minutes * 60) + seconds;
            
            if (totalSeconds <= 0) {
                throw new Error('La duración debe ser mayor a 0 segundos');
            }

            if (totalSeconds > 300) {
                throw new Error('Duración máxima: 5 minutos (300 segundos)');
            }

            if (!user?.uid) {
                throw new Error('Usuario no autenticado');
            }

            setIsDosing(true);
            setError({ type: 'info', message: '⏳ Enviando comando a Firebase...' });

            console.log('🔧 [ManualDosing] Enviando comando vía Firebase');
            
            // Enviar comando a Firebase Realtime Database
            const result = await sendDosingCommandToFirebase(user.uid, product, totalSeconds);
            
            if (result.success) {
                const commandId = result.commandId;
                console.log(`📤 [ManualDosing] Comando enviado (ID: ${commandId})`);
                
                setError({ 
                    type: 'info', 
                    message: `⏳ Arduino ejecutando dosificación (${totalSeconds}s)... Esperando confirmación` 
                });
                
                // Esperar confirmación del Arduino (máximo 60 segundos)
                const confirmed = await waitForCommandConfirmation(user.uid, commandId, 60000);
                
                if (confirmed) {
                    console.log('✅ [ManualDosing] Arduino confirmó que terminó la dosificación');
                    
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
                    
                    // Mensaje de éxito
                    const isPhPlus = product === 'sodium-hypochlorite' || product === 'calcium-hypochlorite';
                    const relayNum = isPhPlus ? '1' : '2';
                    setError({ 
                        type: 'success', 
                        message: `✅ Dosificación completada y confirmada: ${liters}L de ${chemInfo.name} (Relé ${relayNum})` 
                    });
                } else {
                    console.warn('⚠️ [ManualDosing] No se recibió confirmación del Arduino (timeout)');
                    setError({ 
                        type: 'warning', 
                        message: `⚠️ Comando enviado pero no se recibió confirmación del Arduino. Verifica que esté conectado.` 
                    });
                }
                
                setIsDosing(false);
                setDosingStatus(null);

            } else {
                throw new Error(result.message || 'Error enviando comando de dosificación');
            }

        } catch (err) {
            console.error('❌ [ManualDosing] Error en dosificación:', err);
            setError({ type: 'error', message: err.message });
            setIsDosing(false);
            setDosingStatus(null);
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
                        <small style={{ display: 'block', fontSize: '0.75em', marginTop: '0.3em', opacity: 0.8 }}>
                            🔌 Relé 1 (GPIO 4)
                        </small>
                    </button>
                    <button 
                        className={`productBtn ${manualDosingConfig.product === 'muriatic' ? 'active' : ''}`}
                        onClick={() => handleProductChange('muriatic')}
                        disabled={isAnimating}
                    >
                        ↓ Ácido Muriático (Baja pH)
                        <small style={{ display: 'block', fontSize: '0.75em', marginTop: '0.3em', opacity: 0.8 }}>
                            🔌 Relé 2 (GPIO 5)
                        </small>
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '0.5em' }}>
                    <button 
                        className={`productBtn small ${manualDosingConfig.product === 'calcium-hypochlorite' ? 'active' : ''}`}
                        onClick={() => handleProductChange('calcium-hypochlorite')}
                        disabled={isAnimating}
                        title="Relé 1 (GPIO 4)"
                    >
                        Hipoclorito Ca
                    </button>
                    <button 
                        className={`productBtn small ${manualDosingConfig.product === 'bisulfate' ? 'active' : ''}`}
                        onClick={() => handleProductChange('bisulfate')}
                        disabled={isAnimating}
                        title="Relé 2 (GPIO 5)"
                    >
                        Bisulfato
                    </button>
                    <button 
                        className={`productBtn small ${manualDosingConfig.product === 'chlorine-gas' ? 'active' : ''}`}
                        onClick={() => handleProductChange('chlorine-gas')}
                        disabled={isAnimating}
                        title="Relé 2 (GPIO 5)"
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

            {/* Estimado de pH final */}
            {phEstimate && (
                <div className="phEstimateSection">
                    <div className="estimateHeader">
                        <span>📊 Estimado después de dosificar:</span>
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
                                ⚠️ pH fuera del rango seguro (6.0 - 8.5)
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Indicador de conexión ESP32 */}
            <div className="esp32-connection-status">
                <span className={`connection-indicator ${esp32Connected ? 'connected' : 'disconnected'}`}>
                    {esp32Connected ? '🟢 ESP32 Conectado' : '🔴 ESP32 Desconectado'}
                </span>
                {!esp32Connected && (
                    <small>Los comandos de dosificación requieren conexión con el ESP32</small>
                )}
            </div>

            <button 
                className="dosifyBtn" 
                onClick={handleDosify}
                disabled={isAnimating || isDosing || !esp32Connected}
            >
                {isDosing ? '⏳ Dosificando... Esperando ESP32' : 
                 isAnimating ? '📊 Simulando cambio...' : 
                 !esp32Connected ? '🔴 ESP32 Desconectado' :
                 'DOSIFICAR'}
            </button>
        </div>
    );
};

export default ManualDosing;
