import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { validatePHValue, validateTolerance, validateToleranceRange, logError, ErrorMessages } from './errorUtils';
import { subscribeToPHData, checkESP32Connection } from './esp32Communication-firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './useAuth';

export const PHContext = createContext(null);

const DEFAULT_PH_HISTORY = [
    { hour: '00:00', value: 7.0 },
    { hour: '01:00', value: 7.1 },
    { hour: '02:00', value: 7.0 },
    { hour: '03:00', value: 6.9 },
    { hour: '04:00', value: 7.2 },
    { hour: '05:00', value: 7.3 },
    { hour: '06:00', value: 7.1 },
];

const DEFAULT_MANUAL_DOSING_CONFIG = {
    product: 'sodium-hypochlorite',
    minutes: 2,
    seconds: 30,
};

const hasValue = (value) => value !== undefined && value !== null;

const toHistoryEntry = (phValue, date = new Date()) => {
    const hour = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return { hour: `${hour}:${minutes}`, value: phValue };
};

export const PHProvider = ({ children }) => {
    const { user, userConfig, updateUserConfig } = useAuth();

    const [isConfigured, setIsConfigured] = useState(false);
    const [poolVolume, setPoolVolume] = useState(null);
    const [alkalinity, setAlkalinity] = useState(100);
    const [chlorineType, setChlorineType] = useState('sodium-hypochlorite');
    const [acidType, setAcidType] = useState('muriatic');
    const [phTolerance, setPhTolerance] = useState(7.4);
    const [phToleranceRange, setPhToleranceRange] = useState(0.5);
    const [dosingMode, setDosingMode] = useState('automatic');
    const [ph, setPH] = useState(7.4);
    const [phHistory, setPhHistory] = useState(DEFAULT_PH_HISTORY);
    const [error, setError] = useState(null);
    const [manualDosingConfig, setManualDosingConfig] = useState(DEFAULT_MANUAL_DOSING_CONFIG);
    const [dosingHistory, setDosingHistory] = useState([]);
    const [esp32Connected, setEsp32Connected] = useState(false);
    const [lastDataReceived, setLastDataReceived] = useState(null);
    const [hasConfiguredDevice, setHasConfiguredDevice] = useState(false);

    useEffect(() => {
        if (userConfig) {
            if (hasValue(userConfig.poolVolume)) setPoolVolume(userConfig.poolVolume);
            if (hasValue(userConfig.alkalinity)) setAlkalinity(userConfig.alkalinity);
            if (hasValue(userConfig.chlorineType)) setChlorineType(userConfig.chlorineType);
            if (hasValue(userConfig.acidType)) setAcidType(userConfig.acidType);

            const resolvedTolerance = hasValue(userConfig.phTolerance)
                ? userConfig.phTolerance
                : userConfig.phMin;
            if (hasValue(resolvedTolerance)) setPhTolerance(resolvedTolerance);

            const resolvedToleranceRange = hasValue(userConfig.phToleranceRange)
                ? userConfig.phToleranceRange
                : hasValue(userConfig.phMax) && hasValue(userConfig.phMin)
                    ? userConfig.phMax - userConfig.phMin
                    : null;
            if (hasValue(resolvedToleranceRange)) setPhToleranceRange(resolvedToleranceRange);

            if (hasValue(userConfig.dosingMode)) setDosingMode(userConfig.dosingMode);

            if (userConfig.lastManualDosingConfig) {
                const savedConfig = userConfig.lastManualDosingConfig;
                setManualDosingConfig({
                    product: savedConfig.product ?? DEFAULT_MANUAL_DOSING_CONFIG.product,
                    minutes: savedConfig.minutes ?? DEFAULT_MANUAL_DOSING_CONFIG.minutes,
                    seconds: savedConfig.seconds ?? DEFAULT_MANUAL_DOSING_CONFIG.seconds,
                });
            }

            const hasBasicConfig = Boolean(userConfig.poolVolume) && (hasValue(userConfig.phTolerance) || hasValue(userConfig.phMin));
            setIsConfigured(Boolean(userConfig.isConfigured) || hasBasicConfig);
            return;
        }

        if (!user?.uid) {
            return;
        }

        try {
            const localConfig = JSON.parse(localStorage.getItem('poolConfig') || '{}');
            if (Object.keys(localConfig).length === 0) {
                setIsConfigured(false);
                return;
            }

            if (hasValue(localConfig.poolVolume)) setPoolVolume(localConfig.poolVolume);
            if (hasValue(localConfig.alkalinity)) setAlkalinity(localConfig.alkalinity);
            if (hasValue(localConfig.chlorineType)) setChlorineType(localConfig.chlorineType);
            if (hasValue(localConfig.acidType)) setAcidType(localConfig.acidType);

            const resolvedTolerance = hasValue(localConfig.phTolerance)
                ? localConfig.phTolerance
                : localConfig.phMin;
            if (hasValue(resolvedTolerance)) setPhTolerance(resolvedTolerance);

            const resolvedToleranceRange = hasValue(localConfig.phToleranceRange)
                ? localConfig.phToleranceRange
                : hasValue(localConfig.phMax) && hasValue(localConfig.phMin)
                    ? localConfig.phMax - localConfig.phMin
                    : null;
            if (hasValue(resolvedToleranceRange)) setPhToleranceRange(resolvedToleranceRange);

            if (hasValue(localConfig.dosingMode)) setDosingMode(localConfig.dosingMode);

            const hasBasicConfig = Boolean(localConfig.poolVolume) && (hasValue(localConfig.phTolerance) || hasValue(localConfig.phMin));
            setIsConfigured(Boolean(localConfig.isConfigured) || hasBasicConfig);
        } catch {
            setIsConfigured(false);
        }
    }, [user?.uid, userConfig]);

    useEffect(() => {
        if (!user) {
            setIsConfigured(false);
            return;
        }

        if (!userConfig) {
            try {
                const localConfig = JSON.parse(localStorage.getItem('poolConfig') || '{}');
                if (Object.keys(localConfig).length === 0) {
                    setIsConfigured(false);
                }
            } catch {
                setIsConfigured(false);
            }
        }
    }, [user?.uid, userConfig, user]);

    useEffect(() => {
        const loadDeviceState = async () => {
            if (!user?.uid) {
                setHasConfiguredDevice(false);
                return;
            }

            const linkedDeviceIds = Array.isArray(userConfig?.linkedDeviceIds) ? userConfig.linkedDeviceIds : [];
            if (linkedDeviceIds.length > 0) {
                setHasConfiguredDevice(true);
                return;
            }

            try {
                const [linkedByArrayResult, linkedLegacyResult] = await Promise.allSettled([
                    getDocs(query(collection(db, 'devices'), where('userIds', 'array-contains', user.uid))),
                    getDocs(query(collection(db, 'devices'), where('userId', '==', user.uid))),
                ]);

                const hasArrayDevices =
                    linkedByArrayResult.status === 'fulfilled' && !linkedByArrayResult.value.empty;
                const hasLegacyDevices =
                    linkedLegacyResult.status === 'fulfilled' && !linkedLegacyResult.value.empty;

                setHasConfiguredDevice(hasArrayDevices || hasLegacyDevices);
            } catch {
                setHasConfiguredDevice(false);
            }
        };

        loadDeviceState();
    }, [user?.uid, userConfig?.linkedDeviceIds]);

    useEffect(() => {
        const handleDeviceStateUpdate = (event) => {
            setHasConfiguredDevice(Boolean(event?.detail?.hasDevice));
        };

        window.addEventListener('device-registration:updated', handleDeviceStateUpdate);
        return () => window.removeEventListener('device-registration:updated', handleDeviceStateUpdate);
    }, []);

    const openDeviceRegistrationModal = useCallback(() => {
        window.dispatchEvent(new CustomEvent('device-registration:open'));
    }, []);

    const ensureDeviceConfigured = useCallback(
        (featureName = 'esta funcion') => {
            if (hasConfiguredDevice) {
                return true;
            }

            setError({
                type: 'warning',
                message: `Primero registra tu ESP32 para usar ${featureName}.`,
            });
            openDeviceRegistrationModal();
            return false;
        },
        [hasConfiguredDevice, openDeviceRegistrationModal]
    );

    const saveConfigToFirebase = useCallback(
        async (configUpdate) => {
            if (!user) return;

            try {
                await updateUserConfig(configUpdate);
            } catch {
                try {
                    const currentConfig = JSON.parse(localStorage.getItem('poolConfig') || '{}');
                    localStorage.setItem('poolConfig', JSON.stringify({ ...currentConfig, ...configUpdate }));
                } catch (localError) {
                    logError('CONFIG_SAVE_ERROR', localError.message, configUpdate);
                }
            }
        },
        [updateUserConfig, user]
    );

    const updatePhHistory = useCallback((nextPhValue) => {
        const entry = toHistoryEntry(nextPhValue);
        setPhHistory((previous) => {
            const filtered = previous.filter((item) => item.hour !== entry.hour);
            return [...filtered, entry].slice(-24);
        });
    }, []);

    const safePHSet = useCallback(
        (value, options = {}) => {
            const { trackHistory = true } = options;
            try {
                const validatedValue = validatePHValue(value);
                setPH((previous) => (previous === validatedValue ? previous : validatedValue));
                if (trackHistory) {
                    updatePhHistory(validatedValue);
                }
                setError(null);
                return true;
            } catch (err) {
                logError('PH_VALIDATION_ERROR', err.message, { value });
                setError({ type: 'error', message: err.message });
                return false;
            }
        },
        [updatePhHistory]
    );

    const safePoolVolumeSet = useCallback(
        async (value) => {
            setPoolVolume(value);
            await saveConfigToFirebase({ poolVolume: value });
        },
        [saveConfigToFirebase]
    );

    const safeSetIsConfigured = useCallback(
        async (value) => {
            setIsConfigured(value);
            await saveConfigToFirebase({ isConfigured: value });
        },
        [saveConfigToFirebase]
    );

    const safeToleranceSet = useCallback(
        async (value) => {
            try {
                const validatedValue = Number.parseFloat(value);
                if (!Number.isFinite(validatedValue)) {
                    throw new Error(ErrorMessages.INVALID_INPUT);
                }

                validateToleranceRange(validatedValue, phToleranceRange);
                setPhTolerance(validatedValue);
                await saveConfigToFirebase({ phTolerance: validatedValue });
                setError(null);
            } catch (err) {
                logError('TOLERANCE_VALIDATION_ERROR', err.message, { value });
                setError({ type: 'error', message: err.message });
            }
        },
        [phToleranceRange, saveConfigToFirebase]
    );

    const safeToleranceRangeSet = useCallback(
        async (value) => {
            try {
                const validatedValue = validateTolerance(value);
                validateToleranceRange(phTolerance, validatedValue);
                setPhToleranceRange(validatedValue);
                await saveConfigToFirebase({ phToleranceRange: validatedValue });
                setError(null);
            } catch (err) {
                logError('TOLERANCE_RANGE_VALIDATION_ERROR', err.message, { value });
                setError({ type: 'error', message: err.message });
            }
        },
        [phTolerance, saveConfigToFirebase]
    );

    const safeDosingModeSet = useCallback(
        async (value) => {
            setDosingMode(value);
            await saveConfigToFirebase({ dosingMode: value });
        },
        [saveConfigToFirebase]
    );

    const checkConnection = useCallback(async () => {
        if (!user?.uid) return false;

        try {
            const isConnected = await checkESP32Connection(user.uid);
            setEsp32Connected(isConnected);
            return isConnected;
        } catch {
            setEsp32Connected(false);
            return false;
        }
    }, [user?.uid]);

    const handleDataReceived = useCallback(
        (phData) => {
            try {
                if (!phData || !Number.isFinite(Number(phData.ph))) {
                    return;
                }

                const safePh = Number(phData.ph);
                const wasUpdated = safePHSet(safePh, { trackHistory: false });
                if (!wasUpdated) {
                    return;
                }

                setLastDataReceived(new Date(phData.timestamp));
                setEsp32Connected(Boolean(phData.isRecent));
                updatePhHistory(safePh);
            } catch (receivedError) {
                logError('ESP32_DATA_ERROR', receivedError.message, phData);
            }
        },
        [safePHSet, updatePhHistory]
    );

    useEffect(() => {
        if (!user?.uid) {
            return undefined;
        }

        const unsubscribe = subscribeToPHData(user.uid, handleDataReceived);
        checkConnection();

        return () => {
            unsubscribe();
        };
    }, [checkConnection, handleDataReceived, user?.uid]);

    const contextValue = useMemo(
        () => ({
            isConfigured,
            setIsConfigured: safeSetIsConfigured,
            poolVolume,
            setPoolVolume: safePoolVolumeSet,
            alkalinity,
            setAlkalinity,
            chlorineType,
            setChlorineType,
            acidType,
            setAcidType,
            esp32Connected,
            setEsp32Connected,
            lastDataReceived,
            setLastDataReceived,
            ph,
            setPH: safePHSet,
            phTolerance,
            setPhTolerance: safeToleranceSet,
            phToleranceRange,
            setPhToleranceRange: safeToleranceRangeSet,
            phHistory,
            error,
            setError,
            dosingMode,
            setDosingMode: safeDosingModeSet,
            manualDosingConfig,
            setManualDosingConfig,
            dosingHistory,
            setDosingHistory,
            checkConnection,
            saveConfigToFirebase,
            hasConfiguredDevice,
            ensureDeviceConfigured,
            openDeviceRegistrationModal,
            user,
            userConfig,
        }),
        [
            acidType,
            alkalinity,
            checkConnection,
            chlorineType,
            dosingHistory,
            dosingMode,
            ensureDeviceConfigured,
            error,
            esp32Connected,
            hasConfiguredDevice,
            isConfigured,
            lastDataReceived,
            manualDosingConfig,
            openDeviceRegistrationModal,
            ph,
            phHistory,
            phTolerance,
            phToleranceRange,
            poolVolume,
            safeDosingModeSet,
            safePHSet,
            safePoolVolumeSet,
            safeSetIsConfigured,
            safeToleranceRangeSet,
            safeToleranceSet,
            saveConfigToFirebase,
            user,
            userConfig,
        ]
    );

    return <PHContext.Provider value={contextValue}>{children}</PHContext.Provider>;
};

export default PHContext;
