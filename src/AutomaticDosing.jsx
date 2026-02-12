import { useContext, useEffect, useState } from 'react';
import { PHContext } from './PHContext';
import { getChemicalInfo } from './dosageCalculations';
import { useAuth } from './useAuth';
import { ref, onValue } from 'firebase/database';
import { database } from './firebase';
import './AutomaticDosing.css';

const AutomaticDosing = () => {
    const { 
        ph, 
        phTolerance, 
        phToleranceRange, 
        dosingMode,
        userConfig
    } = useContext(PHContext);

    const { user } = useAuth();
    const [backendStatus, setBackendStatus] = useState(null);
    const [lastDosingEvent, setLastDosingEvent] = useState(null);
    const [dosingState, setDosingState] = useState(null);
    
    // Configuración por defecto del administrador
    const adminConfig = userConfig?.adminConfig || {
        minWaitTimeBetweenDoses: 0.5,
        maxDailyDoses: 10,
        checkInterval: 1,
        minPH: 6.0,
        maxPH: 8.5
    };

    // Escuchar estado del backend (Cloud Functions)
    useEffect(() => {
        if (!user || dosingMode !== 'automatic') return;

        console.log('🔌 Conectando con Firebase Realtime Database...');
        
        // Inicializar estado vacío después de 2 segundos si no hay datos
        const timeoutId = setTimeout(() => {
            if (!dosingState) {
                console.log('⚠️ No hay datos del backend aún, mostrando estado inicial');
                setDosingState({
                    initialized: false,
                    message: 'Backend iniciando...'
                });
            }
        }, 2000);

        // Escuchar estado de dosificación
        const dosingStateRef = ref(database, `users/${user.uid}/dosingState`);
        const unsubscribeState = onValue(dosingStateRef, (snapshot) => {
            clearTimeout(timeoutId);
            if (snapshot.exists()) {
                const state = snapshot.val();
                setDosingState({ ...state, initialized: true });
                console.log('📊 Estado de dosificación actualizado:', state);
            } else {
                console.log('ℹ️ No hay estado de dosificación guardado');
                setDosingState({
                    initialized: true,
                    message: 'Sin dosificaciones previas'
                });
            }
        }, (error) => {
            console.error('❌ Error leyendo dosingState:', error);
            clearTimeout(timeoutId);
            setDosingState({
                initialized: true,
                error: error.message
            });
        });

        // Escuchar último evento de dosificación
        const historyRef = ref(database, `users/${user.uid}/dosingHistory`);
        const unsubscribeHistory = onValue(historyRef, (snapshot) => {
            if (snapshot.exists()) {
                const history = snapshot.val();
                const events = Object.values(history);
                // Obtener el último evento
                const lastEvent = events.sort((a, b) => b.timestamp - a.timestamp)[0];
                setLastDosingEvent(lastEvent);
                console.log('📝 Último evento de dosificación:', lastEvent);
            } else {
                console.log('ℹ️ No hay historial de dosificación');
            }
        }, (error) => {
            console.error('❌ Error leyendo historial:', error);
        });

        return () => {
            clearTimeout(timeoutId);
            unsubscribeState();
            unsubscribeHistory();
        };
    }, [user, dosingMode]);

    // No mostrar nada si no está en modo automático
    if (dosingMode !== 'automatic') return null;

    // Calcular desviación actual
    const deviation = ph - phTolerance;
    const isOutOfRange = Math.abs(deviation) > phToleranceRange;

    // Determinar estado del sistema
    const getSystemStatus = () => {
        if (!dosingState) {
            return { icon: '🔄', text: 'Conectando con backend...', status: 'connecting' };
        }

        if (!dosingState.initialized) {
            return { icon: '🔄', text: dosingState.message || 'Inicializando...', status: 'connecting' };
        }

        if (dosingState.error) {
            return { 
                icon: '❌', 
                text: `Error: ${dosingState.error}`, 
                status: 'error' 
            };
        }

        const timeSinceLastDosing = dosingState.lastDosingTime 
            ? Date.now() - dosingState.lastDosingTime 
            : null;

        // Calcular tiempo de espera desde la configuración del administrador
        const waitTimeMs = (adminConfig.minWaitTimeBetweenDoses || 0.5) * 60 * 60 * 1000;

        // Si dosificó hace menos del tiempo configurado, está en espera
        if (timeSinceLastDosing && timeSinceLastDosing < waitTimeMs) {
            const remainingMinutes = Math.ceil((waitTimeMs - timeSinceLastDosing) / 60000);
            return { 
                icon: '⏳', 
                text: `Esperando mezcla (${remainingMinutes} min)`, 
                status: 'waiting' 
            };
        }

        // Si el pH está fuera de rango
        if (isOutOfRange) {
            return { 
                icon: '⚠️', 
                text: 'pH fuera de rango - Backend dosificará pronto', 
                status: 'alert' 
            };
        }

        // pH en rango, monitoreando
        return { 
            icon: '✅', 
            text: 'pH en rango - Monitoreando', 
            status: 'monitoring' 
        };
    };

    const systemStatus = getSystemStatus();

    return (
        <div className="automatic-dosing-container">
            <h3>🤖 Modo Automático - Backend 24/7</h3>
            
            <div className={`auto-status ${systemStatus.status}`}>
                <div className="status-indicator">
                    <span className="status-icon">{systemStatus.icon}</span>
                    <span className="status-text">{systemStatus.text}</span>
                </div>

                <div className="status-details">
                    <div className="detail-row">
                        <span>pH Objetivo:</span>
                        <span className="value">{phTolerance.toFixed(1)} ± {phToleranceRange.toFixed(1)}</span>
                    </div>
                    <div className="detail-row">
                        <span>pH Actual:</span>
                        <span className={`value ${isOutOfRange ? 'out-of-range' : 'in-range'}`}>
                            {ph.toFixed(2)}
                        </span>
                    </div>
                    <div className="detail-row">
                        <span>Desviación:</span>
                        <span className={`value ${isOutOfRange ? 'warning' : 'ok'}`}>
                            {deviation >= 0 ? '+' : ''}{deviation.toFixed(2)}
                        </span>
                    </div>
                </div>

                {dosingState && dosingState.initialized && !dosingState.error && (
                    <div className="backend-info">
                        <h4>📊 Estado del Backend</h4>
                        {dosingState.message ? (
                            <p style={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center', padding: '1em' }}>
                                {dosingState.message}
                            </p>
                        ) : (
                            <div className="info-grid">
                                {dosingState.lastDosingTime && (
                                    <div className="info-item">
                                        <span className="info-label">Última dosificación:</span>
                                        <span className="info-value">
                                            {new Date(dosingState.lastDosingTime).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {dosingState.lastProduct && (
                                    <div className="info-item">
                                        <span className="info-label">Producto usado:</span>
                                        <span className="info-value">
                                            {dosingState.lastProduct === 'ph_plus' ? 'pH+ (Soda Ash)' : 'pH- (Acido)'}
                                        </span>
                                    </div>
                                )}
                                {dosingState.lastDuration && (
                                    <div className="info-item">
                                        <span className="info-label">Duración:</span>
                                        <span className="info-value">{dosingState.lastDuration}s</span>
                                    </div>
                                )}
                                {dosingState.dosingCountToday !== undefined && (
                                    <div className="info-item">
                                        <span className="info-label">Dosificaciones hoy:</span>
                                        <span className="info-value">
                                            {dosingState.dosingCountToday} / {adminConfig.maxDailyDoses || 10}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {lastDosingEvent && (
                    <div className="last-event">
                        <h4>📝 Último Evento</h4>
                        <div className="event-details">
                            <p><strong>Fecha:</strong> {new Date(lastDosingEvent.timestamp).toLocaleString()}</p>
                            <p><strong>Producto:</strong> {lastDosingEvent.product === 'ph_plus' ? 'pH+' : 'pH-'}</p>
                            <p><strong>Duración:</strong> {lastDosingEvent.duration}s</p>
                            <p><strong>pH antes:</strong> {lastDosingEvent.phBefore?.toFixed(2)}</p>
                            <p><strong>pH objetivo:</strong> {lastDosingEvent.phTarget?.toFixed(2)}</p>
                            <p><strong>Desviación:</strong> {lastDosingEvent.deviation?.toFixed(2)}</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="auto-info">
                <h4>ℹ️ Información del Sistema</h4>
                <ul>
                    <li>✅ Cloud Functions activas 24/7</li>
                    <li>🔄 Verificación automática cada {adminConfig.checkInterval || 1} minuto(s)</li>
                    <li>⏱️ Tiempo de espera entre dosificaciones: {adminConfig.minWaitTimeBetweenDoses || 0.5} hora(s)</li>
                    <li>🛡️ Límite diario: {adminConfig.maxDailyDoses || 10} dosificaciones</li>
                    <li>📊 Rango seguro de pH: {adminConfig.minPH || 6.0} - {adminConfig.maxPH || 8.5}</li>
                    <li>🌐 No requiere app abierta para funcionar</li>
                </ul>
                <div className="backend-status">
                    <p>
                        <strong>Estado:</strong> El backend está monitoreando tu piscina continuamente.
                        Cuando el pH salga del rango configurado, dosificará automáticamente.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AutomaticDosing;
