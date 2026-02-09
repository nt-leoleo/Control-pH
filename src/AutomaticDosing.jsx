import { useContext, useEffect, useState } from 'react';
import { PHContext } from './PHContext';
import { calculatePHChange, getChemicalInfo } from './dosageCalculations';
import { CONFIG, getConfig, getModeDescription } from './config';
import { sendRealDosingCommand } from './esp32Communication';
import './AutomaticDosing.css';

const AutomaticDosing = () => {
    const { 
        ph, 
        phTolerance, 
        phToleranceRange, 
        poolVolume, 
        alkalinity,
        acidType,
        chlorineType,
        dosingMode,
        setError,
        dosingHistory,
        setDosingHistory
    } = useContext(PHContext);

    const [autoStatus, setAutoStatus] = useState('monitoring'); // monitoring, dosing, waiting, error
    const [lastDosing, setLastDosing] = useState(null);
    const [nextCheckTime, setNextCheckTime] = useState(null);
    const [currentAction, setCurrentAction] = useState(null);

    // Obtener configuración según el modo
    const config = getConfig();
    const modeInfo = getModeDescription();
    
    // Constantes de hardware
    const { PUMP_FLOW_RATE, MAX_DOSE_VOLUME, CORRECTION_FACTOR, MIN_DOSE_VOLUME } = CONFIG.HARDWARE;
    const { MIN_WAIT_TIME, CHECK_INTERVAL, DOSING_DELAY } = config;

    /**
     * Calcula la cantidad de producto necesaria para ajustar el pH
     * Usa búsqueda iterativa para encontrar la dosis correcta
     */
    const calculateRequiredDose = (currentPH, targetPH, poolVolumeL, alkalinityPpm) => {
        const deviation = currentPH - targetPH;
        
        // Determinar producto a usar
        const product = deviation > 0 ? acidType : chlorineType;
        
        // Búsqueda iterativa: probar diferentes cantidades hasta encontrar la correcta
        let liters = 0.01; // Empezar con 10ml
        let phChange = 0;
        let iterations = 0;
        const maxIterations = 100;
        
        // Incrementar de a poco hasta lograr el cambio deseado
        while (Math.abs(phChange) < Math.abs(deviation) * CORRECTION_FACTOR && iterations < maxIterations) {
            liters += 0.01; // Incrementar 10ml
            phChange = calculatePHChange(product, liters, poolVolumeL, alkalinityPpm);
            iterations++;
            
            // Limitar a dosis máxima segura
            if (liters >= MAX_DOSE_VOLUME) {
                break;
            }
        }
        
        // Asegurar mínimo
        liters = Math.max(MIN_DOSE_VOLUME, liters);
        
        // Recalcular cambio final
        const finalPhChange = calculatePHChange(product, liters, poolVolumeL, alkalinityPpm);
        
        return {
            product,
            liters: Math.round(liters * 100) / 100, // Redondear a 2 decimales
            expectedChange: finalPhChange,
            duration: calculatePumpDuration(liters)
        };
    };

    /**
     * Calcula el tiempo que debe estar encendida la bomba
     * Basado en el caudal de la bomba (1.5 L/h)
     * Limitado a máximo 15 minutos (900 segundos)
     */
    const calculatePumpDuration = (liters) => {
        const hours = liters / PUMP_FLOW_RATE;
        const seconds = Math.min(Math.round(hours * 3600), 900); // Máximo 15 minutos
        return {
            seconds,
            minutes: Math.floor(seconds / 60),
            remainingSeconds: seconds % 60
        };
    };

    /**
     * Verifica si es necesario dosificar
     */
    const checkAndDose = () => {
        // Verificar que estamos en modo automático
        if (dosingMode !== 'automatic') return;

        // Verificar que tenemos configuración válida
        if (!poolVolume || poolVolume <= 0) {
            setAutoStatus('error');
            setError({ 
                type: 'warning', 
                message: 'Configuración incompleta: Volumen de piscina no configurado' 
            });
            return;
        }

        // Verificar si estamos en período de espera
        if (lastDosing && (Date.now() - lastDosing) < MIN_WAIT_TIME) {
            const remainingTime = MIN_WAIT_TIME - (Date.now() - lastDosing);
            const remainingMinutes = Math.ceil(remainingTime / 60000);
            setAutoStatus('waiting');
            setNextCheckTime(new Date(lastDosing + MIN_WAIT_TIME));
            return;
        }

        // Calcular desviación del pH
        const deviation = ph - phTolerance;
        const isOutOfRange = Math.abs(deviation) > phToleranceRange;

        if (isOutOfRange) {
            // pH fuera de rango, calcular dosificación
            const dose = calculateRequiredDose(ph, phTolerance, poolVolume, alkalinity || 100);
            
            setAutoStatus('dosing');
            setCurrentAction(dose);
            
            // Simular dosificación
            executeDosing(dose);
        } else {
            // pH en rango, solo monitorear
            setAutoStatus('monitoring');
            setCurrentAction(null);
        }
    };

    /**
     * Ejecuta la dosificación
     */
    const executeDosing = async (dose) => {
        const chemInfo = getChemicalInfo(dose.product);
        
        setAutoStatus('dosing');
        setCurrentAction(dose);
        
        try {
            // Enviar comando real al ESP32
            console.log('🚀 Enviando comando de dosificación al ESP32...');
            const result = await sendRealDosingCommand(dose.product, dose.duration.seconds);
            
            if (result.success) {
                console.log('✅ Comando enviado exitosamente:', result);
                
                const now = new Date();
                const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                
                const dosingRecord = {
                    timestamp: timeString,
                    product: dose.product,
                    productName: chemInfo.name,
                    duration: dose.duration,
                    liters: dose.liters,
                    phBefore: ph,
                    phTarget: phTolerance,
                    expectedChange: dose.expectedChange,
                    mode: 'automatic',
                    status: 'completado',
                    esp32Response: result
                };

                setDosingHistory(prev => [...prev, dosingRecord]);
                setLastDosing(Date.now());
                
                setError({ 
                    type: 'success', 
                    message: `✓ Dosificación automática: ${dose.liters.toFixed(2)}L de ${chemInfo.name} durante ${dose.duration.minutes}m ${dose.duration.remainingSeconds}s` 
                });
            } else {
                console.error('❌ Error en comando:', result.message);
                setError({ 
                    type: 'error', 
                    message: `Error al dosificar: ${result.message}` 
                });
            }
        } catch (error) {
            console.error('❌ Error ejecutando dosificación:', error);
            setError({ 
                type: 'error', 
                message: `Error al comunicarse con el ESP32: ${error.message}` 
            });
        }

        // Después de dosificar, esperar período de mezcla
        setTimeout(() => {
            setAutoStatus('waiting');
            setNextCheckTime(new Date(Date.now() + MIN_WAIT_TIME));
        }, DOSING_DELAY);
    };

    // Efecto para verificación periódica
    useEffect(() => {
        if (dosingMode !== 'automatic') return;

        // Verificación inicial
        checkAndDose();

        // Configurar intervalo de verificación
        const interval = setInterval(() => {
            checkAndDose();
        }, CHECK_INTERVAL);

        return () => clearInterval(interval);
    }, [ph, phTolerance, phToleranceRange, poolVolume, dosingMode, lastDosing]);

    // No mostrar nada si no está en modo automático
    if (dosingMode !== 'automatic') return null;

    return (
        <div className="automatic-dosing-container">
            <h3>🤖 Modo Automático Activo {CONFIG.DEV_MODE && <span className="dev-badge">{modeInfo.mode}</span>}</h3>
            
            <div className={`auto-status ${autoStatus}`}>
                <div className="status-indicator">
                    {autoStatus === 'monitoring' && (
                        <>
                            <span className="status-icon">👁️</span>
                            <span className="status-text">Monitoreando pH</span>
                        </>
                    )}
                    {autoStatus === 'dosing' && (
                        <>
                            <span className="status-icon">💧</span>
                            <span className="status-text">Dosificando...</span>
                        </>
                    )}
                    {autoStatus === 'waiting' && (
                        <>
                            <span className="status-icon">⏳</span>
                            <span className="status-text">Esperando mezcla completa</span>
                        </>
                    )}
                    {autoStatus === 'error' && (
                        <>
                            <span className="status-icon">⚠️</span>
                            <span className="status-text">Error de configuración</span>
                        </>
                    )}
                </div>

                <div className="status-details">
                    <div className="detail-row">
                        <span>pH Objetivo:</span>
                        <span className="value">{phTolerance.toFixed(1)} ± {phToleranceRange.toFixed(1)}</span>
                    </div>
                    <div className="detail-row">
                        <span>pH Actual:</span>
                        <span className={`value ${Math.abs(ph - phTolerance) > phToleranceRange ? 'out-of-range' : 'in-range'}`}>
                            {ph.toFixed(2)}
                        </span>
                    </div>
                    <div className="detail-row">
                        <span>Desviación:</span>
                        <span className={`value ${Math.abs(ph - phTolerance) > phToleranceRange ? 'warning' : 'ok'}`}>
                            {(ph - phTolerance) >= 0 ? '+' : ''}{(ph - phTolerance).toFixed(2)}
                        </span>
                    </div>
                </div>

                {currentAction && autoStatus === 'dosing' && (
                    <div className="current-action">
                        <h4>Acción en curso:</h4>
                        <div className="action-details">
                            <p><strong>Producto:</strong> {getChemicalInfo(currentAction.product).name}</p>
                            <p><strong>Cantidad:</strong> {currentAction.liters.toFixed(2)} L</p>
                            <p><strong>Duración:</strong> {currentAction.duration.minutes}m {currentAction.duration.remainingSeconds}s</p>
                            <p><strong>Cambio esperado:</strong> {currentAction.expectedChange >= 0 ? '+' : ''}{currentAction.expectedChange.toFixed(2)} pH</p>
                        </div>
                    </div>
                )}

                {nextCheckTime && autoStatus === 'waiting' && (
                    <div className="next-check">
                        <p>Próxima verificación: {nextCheckTime.toLocaleTimeString()}</p>
                        <p className="info-text">
                            ⏱️ Tiempo de espera: {modeInfo.waitTime}
                        </p>
                    </div>
                )}
            </div>

            <div className="auto-info">
                <h4>ℹ️ Información del Sistema</h4>
                {CONFIG.DEV_MODE && modeInfo.warning && (
                    <div className="dev-warning">
                        {modeInfo.warning}
                        <ul>
                            <li>Verificación: Cada {modeInfo.checkInterval}</li>
                            <li>Tiempo de espera: {modeInfo.waitTime}</li>
                            <li>Cambiar DEV_MODE en src/config.js</li>
                        </ul>
                    </div>
                )}
                <ul>
                    <li>Caudal de bomba: {PUMP_FLOW_RATE} L/h (25 ml/min)</li>
                    <li>Dosis máxima: {MAX_DOSE_VOLUME * 1000} ml por ciclo</li>
                    <li>Tiempo de espera: {modeInfo.waitTime}</li>
                    <li>Verificación: {modeInfo.checkInterval}</li>
                </ul>
            </div>
        </div>
    );
};

export default AutomaticDosing;
