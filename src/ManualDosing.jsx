import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PHContext } from './PHContext';
import { calculatePHChange, validateDosage, getChemicalInfo } from './dosageCalculations';
import { sendDosingCommandToFirebase, waitForCommandConfirmation } from './esp32Communication-firebase';
import { useAuth } from './useAuth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getConfiguredProducts, getChemicalName } from './chemicalLabels';
import { CONFIG } from './config';
import InfoHint from './InfoHint';
import './ManualDosing.css';

const MAX_DURATION_SECONDS = 300;

const toNumberOr = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const formatLiters = (value) => {
    if (!Number.isFinite(value) || value <= 0) return '0.000';
    return value >= 1 ? value.toFixed(2) : value.toFixed(3);
};

const clampTimeValue = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(59, parsed);
};

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
        hasConfiguredDevice,
        ensureDeviceConfigured,
        userConfig,
        chlorineType,
        acidType,
    } = useContext(PHContext);

    const { user } = useAuth();
    const [isDosing, setIsDosing] = useState(false);
    const hasInitializedSaveRef = useRef(false);

    const { raiseCode, lowerCode, raiseName, lowerName } = useMemo(
        () => getConfiguredProducts(chlorineType, acidType),
        [chlorineType, acidType]
    );

    const allowedProducts = useMemo(() => Array.from(new Set([raiseCode, lowerCode])), [raiseCode, lowerCode]);

    useEffect(() => {
        if (!allowedProducts.includes(manualDosingConfig.product)) {
            setManualDosingConfig((previous) => ({ ...previous, product: raiseCode }));
        }
    }, [allowedProducts, manualDosingConfig.product, raiseCode, setManualDosingConfig]);

    useEffect(() => {
        if (!user?.uid || !manualDosingConfig) {
            return;
        }

        if (!hasInitializedSaveRef.current) {
            hasInitializedSaveRef.current = true;
            return;
        }

        const timeoutId = setTimeout(async () => {
            try {
                const userDocRef = doc(db, 'users', user.uid);
                await setDoc(
                    userDocRef,
                    {
                        lastManualDosingConfig: {
                            product: manualDosingConfig.product,
                            minutes: manualDosingConfig.minutes,
                            seconds: manualDosingConfig.seconds,
                            lastUpdated: new Date().toISOString(),
                        },
                    },
                    { merge: true }
                );
            } catch {
                // Saving this snapshot is best-effort and should not block dosing.
            }
        }, 600);

        return () => clearTimeout(timeoutId);
    }, [manualDosingConfig, user?.uid]);

    const pumpFlowRateLh = useMemo(() => {
        const defaultFlowRate = toNumberOr(CONFIG?.HARDWARE?.PUMP_FLOW_RATE, 60);
        const directUserFlow = toNumberOr(userConfig?.pumpFlowRate, NaN);
        const adminFlow = toNumberOr(userConfig?.adminConfig?.pumpFlowRate, NaN);

        if (Number.isFinite(directUserFlow) && directUserFlow > 0) {
            return directUserFlow;
        }

        if (Number.isFinite(adminFlow) && adminFlow > 0) {
            return adminFlow;
        }

        return defaultFlowRate;
    }, [userConfig?.adminConfig?.pumpFlowRate, userConfig?.pumpFlowRate]);

    const totalSeconds = useMemo(() => {
        const minutes = toNumberOr(manualDosingConfig.minutes, 0);
        const seconds = toNumberOr(manualDosingConfig.seconds, 0);
        return Math.max(0, (minutes * 60) + seconds);
    }, [manualDosingConfig.minutes, manualDosingConfig.seconds]);

    const calculatedLiters = useMemo(
        () => (pumpFlowRateLh / 3600) * totalSeconds,
        [pumpFlowRateLh, totalSeconds]
    );

    const adminConfig = userConfig?.adminConfig || {};
    const minSafePH = useMemo(() => {
        const configuredMin = toNumberOr(adminConfig.minPH, 6.0);
        return Math.max(0, Math.min(14, configuredMin));
    }, [adminConfig.minPH]);

    const maxSafePH = useMemo(() => {
        const configuredMax = toNumberOr(adminConfig.maxPH, 8.5);
        return Math.max(minSafePH + 0.1, Math.min(14, configuredMax));
    }, [adminConfig.maxPH, minSafePH]);

    const maxSafePHChange = useMemo(() => {
        const configuredMaxChange = toNumberOr(adminConfig.maxPHChange, 1.0);
        return configuredMaxChange > 0 ? configuredMaxChange : 1.0;
    }, [adminConfig.maxPHChange]);

    const phEstimate = useMemo(() => {
        if (!poolVolume || calculatedLiters <= 0) {
            return null;
        }

        try {
            const phChange = calculatePHChange(
                manualDosingConfig.product,
                calculatedLiters,
                poolVolume,
                alkalinity || 100
            );
            const finalPh = ph + phChange;
            return {
                change: phChange,
                final: finalPh,
                isValid: finalPh >= minSafePH && finalPh <= maxSafePH,
            };
        } catch {
            return null;
        }
    }, [
        alkalinity,
        calculatedLiters,
        manualDosingConfig.product,
        maxSafePH,
        minSafePH,
        ph,
        poolVolume,
    ]);

    const handleProductChange = useCallback(
        (product) => {
            setManualDosingConfig((previous) => ({ ...previous, product }));
        },
        [setManualDosingConfig]
    );

    const handleTimeChange = useCallback(
        (field, value) => {
            setManualDosingConfig((previous) => ({
                ...previous,
                [field]: clampTimeValue(value),
            }));
        },
        [setManualDosingConfig]
    );

    const productDirectionLabel = useCallback(
        (product) => {
            if (product === raiseCode) return 'Subir pH';
            if (product === lowerCode) return 'Bajar pH';
            return 'Correccion';
        },
        [lowerCode, raiseCode]
    );

    const productRelayLabel = useCallback((product) => {
        return ['muriatic', 'bisulfate', 'chlorine-gas'].includes(product)
            ? 'Relay 2 (GPIO 5)'
            : 'Relay 1 (GPIO 4)';
    }, []);

    const handleDosify = useCallback(async () => {
        try {
            if (!ensureDeviceConfigured('la dosificacion manual')) {
                return;
            }

            if (!poolVolume) {
                throw new Error('Volumen de piscina no configurado');
            }

            if (calculatedLiters <= 0) {
                throw new Error('La duracion debe ser mayor a 0 segundos');
            }

            if (totalSeconds > MAX_DURATION_SECONDS) {
                throw new Error('Duracion maxima: 5 minutos (300 segundos)');
            }

            if (!user?.uid) {
                throw new Error('Usuario no autenticado');
            }

            const { product, minutes, seconds } = manualDosingConfig;
            const chemInfo = getChemicalInfo(product);
            if (!chemInfo) {
                throw new Error('Producto no reconocido. Revisa la configuracion de quimicos.');
            }

            const validation = validateDosage(product, calculatedLiters, poolVolume, ph, {
                alkalinityPpm: alkalinity,
                minSafePH,
                maxSafePH,
                maxPHChange: maxSafePHChange,
            });

            if (!validation.valid) {
                setError({ type: 'warning', message: validation.message });
                return;
            }

            setIsDosing(true);
            setError({ type: 'info', message: 'Enviando comando a Firebase...' });

            const result = await sendDosingCommandToFirebase(user.uid, product, totalSeconds);
            if (!result.success) {
                throw new Error(result.message || 'Error enviando comando de dosificacion');
            }

            const commandId = result.commandId;
            setError({
                type: 'info',
                message: `Arduino ejecutando dosificacion (${totalSeconds}s). Esperando confirmacion...`,
            });

            // The command can take several polling cycles to transition to completed.
            const confirmed = await waitForCommandConfirmation(user.uid, commandId, 60000);
            if (!confirmed) {
                setError({
                    type: 'warning',
                    message: 'Comando enviado pero no se recibio confirmacion del Arduino.',
                });
                return;
            }

            const phChange = calculatePHChange(product, calculatedLiters, poolVolume, alkalinity);
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now
                .getMinutes()
                .toString()
                .padStart(2, '0')}`;

            const dosingRecord = {
                timestamp: timeString,
                product,
                productName: chemInfo.name,
                duration: { minutes, seconds },
                durationSeconds: totalSeconds,
                liters: calculatedLiters,
                phChangeBefore: ph,
                phChangeAfter: ph + phChange,
                expectedChange: phChange,
                status: 'completado',
                confirmed: true,
                method: 'firebase',
                commandId,
            };

            setDosingHistory((previous) => [...previous, dosingRecord]);

            const isPhPlus = product === 'sodium-hypochlorite' || product === 'calcium-hypochlorite';
            const relayNum = isPhPlus ? '1' : '2';
            setError({
                type: 'success',
                message: `Dosificacion completada: ${formatLiters(calculatedLiters)}L de ${chemInfo.name} (Relay ${relayNum})`,
            });
        } catch (runtimeError) {
            setError({ type: 'error', message: runtimeError.message });
        } finally {
            setIsDosing(false);
        }
    }, [
        alkalinity,
        calculatedLiters,
        ensureDeviceConfigured,
        manualDosingConfig,
        maxSafePH,
        maxSafePHChange,
        minSafePH,
        ph,
        poolVolume,
        setDosingHistory,
        setError,
        totalSeconds,
        user?.uid,
    ]);

    return (
        <div className="manualDosingContainer" data-tutorial="manual-module">
            <h3 className="manual-title-with-info">
                <span>Dosificacion Manual</span>
                <InfoHint
                    size="sm"
                    title="Modo manual"
                    text="Vos decidis producto y tiempo. El volumen se calcula automaticamente segun el caudal de bomba configurado."
                />
            </h3>

            <div className="dosingSection" data-tutorial="manual-product">
                <label className="label-with-info">
                    <span>Producto a aplicar:</span>
                    <InfoHint
                        size="sm"
                        title="Producto"
                        text="Elegi si queres subir o bajar el pH. Cada boton activa una bomba distinta."
                    />
                </label>
                <div className="productButtons">
                    {allowedProducts.map((product) => (
                        <button
                            key={product}
                            className={`productBtn ${manualDosingConfig.product === product ? 'active' : ''}`}
                            onClick={() => handleProductChange(product)}
                            disabled={isDosing}
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

            <div className="dosingSection" data-tutorial="manual-time">
                <label className="label-with-info">
                    <span>Tiempo de dosificado:</span>
                    <InfoHint
                        size="sm"
                        title="Tiempo"
                        text="Es la duracion de la bomba encendida. A mayor tiempo, mayor producto inyectado."
                    />
                </label>
                <div className="timeInputs">
                    <div className="timeGroup">
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={manualDosingConfig.minutes}
                            onChange={(event) => handleTimeChange('minutes', event.target.value)}
                            disabled={isDosing}
                        />
                        <span>minutos</span>
                    </div>
                    <div className="timeGroup">
                        <input
                            type="number"
                            min="0"
                            max="59"
                            value={manualDosingConfig.seconds}
                            onChange={(event) => handleTimeChange('seconds', event.target.value)}
                            disabled={isDosing}
                        />
                        <span>segundos</span>
                    </div>
                </div>
            </div>

            <div className="dosingSection" data-tutorial="manual-volume">
                <label className="label-with-info">
                    <span>Volumen calculado (automatico):</span>
                    <InfoHint
                        size="sm"
                        title="Volumen automatico"
                        text="Se calcula con esta formula: tiempo de dosificado x caudal de bomba configurado."
                    />
                </label>
                <div className="calculatedVolumeBox">
                    <strong>{formatLiters(calculatedLiters)} L</strong>
                    <small>
                        Caudal: {pumpFlowRateLh.toFixed(1)} L/h | Tiempo: {manualDosingConfig.minutes}m {manualDosingConfig.seconds}s
                    </small>
                </div>
            </div>

            {phEstimate && (
                <div className="phEstimateSection" data-tutorial="manual-estimate">
                    <div className="estimateHeader">
                        <span>Estimado despues de dosificar:</span>
                    </div>
                    <div className={`phEstimate ${phEstimate.isValid ? 'valid' : 'warning'}`}>
                        <div className="estimateRow">
                            <span>pH actual:</span>
                            <span className="currentPh">{ph.toFixed(2)}</span>
                        </div>
                        <div className="estimateRow">
                            <span>Cambio esperado:</span>
                            <span className={`phChange ${phEstimate.change >= 0 ? 'positive' : 'negative'}`}>
                                {phEstimate.change >= 0 ? '+' : ''}
                                {phEstimate.change.toFixed(2)}
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
                                pH fuera del rango seguro ({minSafePH.toFixed(1)} - {maxSafePH.toFixed(1)})
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="esp32-connection-status" data-tutorial="manual-connection">
                <div className="manual-connection-header">
                    <span className={`connection-indicator ${esp32Connected ? 'connected' : 'disconnected'}`}>
                        {esp32Connected ? 'ESP32 Conectado' : 'ESP32 Desconectado'}
                    </span>
                    <InfoHint
                        size="sm"
                        title="Conexion ESP32"
                        text="Si esta desconectado, los comandos no llegan al equipo fisico y la dosificacion no se ejecuta."
                    />
                </div>
                {!esp32Connected && <small>Los comandos de dosificacion requieren conexion con el ESP32</small>}
            </div>

            <div className="manual-submit-wrap">
                <button
                    className="dosifyBtn"
                    data-tutorial="manual-submit"
                    onClick={handleDosify}
                    disabled={isDosing || (hasConfiguredDevice && !esp32Connected)}
                >
                    {isDosing
                        ? 'Dosificando... Esperando ESP32'
                        : !hasConfiguredDevice
                            ? 'Configurar dispositivo'
                            : !esp32Connected
                                ? 'ESP32 Desconectado'
                                : 'DOSIFICAR'}
                </button>
                <InfoHint
                    size="sm"
                    title="Ejecutar dosificacion"
                    text="Al presionar este boton se envia la orden al ESP32 y se espera confirmacion de finalizacion."
                />
            </div>
        </div>
    );
};

export default ManualDosing;
