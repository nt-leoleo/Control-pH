import { createContext, useState, useEffect } from 'react';
import { validatePHValue, validateTolerance, validateToleranceRange, logError, ErrorMessages } from './errorUtils';
import { subscribeToPHData, checkESP32Connection, sendManualDosingCommand } from './esp32Communication-firebase';
import { useAuth } from './useAuth';

export const PHContext = createContext(null);

export const PHProvider = ({ children }) => {
    const { user, userConfig, updateUserConfig } = useAuth();
    const [isConfigured, setIsConfigured] = useState(false);
    
    // Estados que se sincronizarán con Firebase
    const [poolVolume, setPoolVolume] = useState(null);
    const [alkalinity, setAlkalinity] = useState(100);
    const [chlorineType, setChlorineType] = useState('sodium-hypochlorite');
    const [acidType, setAcidType] = useState('muriatic');
    const [phTolerance, setPhTolerance] = useState(7.4);
    const [phToleranceRange, setPhToleranceRange] = useState(0.5);
    const [dosingMode, setDosingMode] = useState('automatic');
    const [ph, setPH] = useState(7.4);
    const [phHistory, setPhHistory] = useState([
        { hour: '00:00', value: 7.0 },
        { hour: '01:00', value: 7.1 },
        { hour: '02:00', value: 7.0 },
        { hour: '03:00', value: 6.9 },
        { hour: '04:00', value: 7.2 },
        { hour: '05:00', value: 7.3 },
        { hour: '06:00', value: 7.1 },
    ]);
    const [error, setError] = useState(null);
    const [manualDosingConfig, setManualDosingConfig] = useState({
        product: 'sodium-hypochlorite',
        minutes: 2,
        seconds: 30,
        liters: 5,
    });
    const [dosingHistory, setDosingHistory] = useState([]);

    // Estado de conexión ESP32
    const [esp32Connected, setEsp32Connected] = useState(false);
    const [lastDataReceived, setLastDataReceived] = useState(null);

    // Cargar configuración desde Firebase cuando esté disponible
    useEffect(() => {
        if (userConfig) {
            // Cargar configuración guardada
            if (userConfig.poolVolume) setPoolVolume(userConfig.poolVolume);
            if (userConfig.alkalinity) setAlkalinity(userConfig.alkalinity);
            if (userConfig.chlorineType) setChlorineType(userConfig.chlorineType);
            if (userConfig.acidType) setAcidType(userConfig.acidType);
            
            // Cargar pH y tolerancia (nuevo formato)
            if (userConfig.phTolerance) setPhTolerance(userConfig.phTolerance);
            if (userConfig.phToleranceRange) setPhToleranceRange(userConfig.phToleranceRange);
            
            // Compatibilidad con formato anterior (phMin/phMax)
            if (!userConfig.phTolerance && userConfig.phMin) {
                setPhTolerance(userConfig.phMin);
            }
            if (!userConfig.phToleranceRange && userConfig.phMax && userConfig.phMin) {
                setPhToleranceRange(userConfig.phMax - userConfig.phMin);
            }
            
            if (userConfig.dosingMode) setDosingMode(userConfig.dosingMode);
            
            // Cargar última configuración de dosificación manual
            if (userConfig.lastManualDosingConfig) {
                console.log('📥 Cargando configuración de dosificación manual:', userConfig.lastManualDosingConfig);
                const savedConfig = userConfig.lastManualDosingConfig;
                setManualDosingConfig({
                    product: savedConfig.product ?? 'sodium-hypochlorite',
                    minutes: savedConfig.minutes ?? 2,
                    seconds: savedConfig.seconds ?? 30,
                    liters: savedConfig.liters ?? 5
                });
                console.log('✅ Configuración aplicada - Minutos:', savedConfig.minutes);
            } else {
                console.log('⚠️ No hay configuración de dosificación manual guardada');
            }
            
            // Si tiene configuración básica, marcar como configurado
            const hasBasicConfig = userConfig.poolVolume && (userConfig.phTolerance || userConfig.phMin);
            const isConfiguredValue = userConfig.isConfigured || hasBasicConfig || false;
            setIsConfigured(isConfiguredValue);
        } else if (user && !userConfig) {
            // Si hay usuario pero no configuración de Firebase, intentar localStorage
            try {
                const localConfig = JSON.parse(localStorage.getItem('poolConfig') || '{}');
                if (Object.keys(localConfig).length > 0) {
                    if (localConfig.poolVolume) setPoolVolume(localConfig.poolVolume);
                    if (localConfig.alkalinity) setAlkalinity(localConfig.alkalinity);
                    if (localConfig.chlorineType) setChlorineType(localConfig.chlorineType);
                    if (localConfig.acidType) setAcidType(localConfig.acidType);
                    
                    // Cargar pH y tolerancia (nuevo formato)
                    if (localConfig.phTolerance) setPhTolerance(localConfig.phTolerance);
                    if (localConfig.phToleranceRange) setPhToleranceRange(localConfig.phToleranceRange);
                    
                    // Compatibilidad con formato anterior
                    if (!localConfig.phTolerance && localConfig.phMin) {
                        setPhTolerance(localConfig.phMin);
                    }
                    if (!localConfig.phToleranceRange && localConfig.phMax && localConfig.phMin) {
                        setPhToleranceRange(localConfig.phMax - localConfig.phMin);
                    }
                    
                    if (localConfig.dosingMode) setDosingMode(localConfig.dosingMode);
                    
                    const hasBasicConfig = localConfig.poolVolume && (localConfig.phTolerance || localConfig.phMin);
                    setIsConfigured(localConfig.isConfigured || hasBasicConfig || false);
                }
            } catch (error) {
                // Ignorar errores de localStorage
            }
        }
    }, [userConfig, user]);

    // Función para guardar configuración en Firebase
    const saveConfigToFirebase = async (configUpdate) => {
        if (!user) return;
        
        try {
            await updateUserConfig(configUpdate);
        } catch (error) {
            // Fallback a localStorage si Firebase falla
            try {
                const currentConfig = JSON.parse(localStorage.getItem('poolConfig') || '{}');
                const newConfig = { ...currentConfig, ...configUpdate };
                localStorage.setItem('poolConfig', JSON.stringify(newConfig));
            } catch (localError) {
                logError('CONFIG_SAVE_ERROR', localError.message, configUpdate);
            }
        }
    };

    // Wrapper mejorado para setPoolVolume que guarda en Firebase
    const safePoolVolumeSet = async (value) => {
        setPoolVolume(value);
        await saveConfigToFirebase({ poolVolume: value });
    };

    // Wrapper mejorado para setIsConfigured que guarda en Firebase
    const safeSetIsConfigured = async (value) => {
        setIsConfigured(value);
        await saveConfigToFirebase({ isConfigured: value });
    };

    // Wrapper para setPH con validación
    const safePHSet = (value) => {
        try {
            const validatedValue = validatePHValue(value);
            setPH(validatedValue);
            setError(null);
        } catch (err) {
            logError('PH_VALIDATION_ERROR', err.message, { value });
            setError({ type: 'error', message: err.message });
        }
    };

    // Wrapper para setPhTolerance con validación y guardado en Firebase
    const safeToleranceSet = async (value) => {
        try {
            const validatedValue = parseFloat(value);
            if (isNaN(validatedValue)) {
                throw new Error(ErrorMessages.INVALID_INPUT);
            }
            validateToleranceRange(validatedValue, phToleranceRange);
            setPhTolerance(validatedValue);
            await saveConfigToFirebase({ phTolerance: validatedValue });
            
            // Enviar configuración a ThingSpeak para el ESP32
            await sendConfigToThingSpeak(validatedValue, phToleranceRange, dosingMode);
            
            setError(null);
        } catch (err) {
            logError('TOLERANCE_VALIDATION_ERROR', err.message, { value });
            setError({ type: 'error', message: err.message });
        }
    };

    // Wrapper para setPhToleranceRange con validación y guardado en Firebase
    const safeToleranceRangeSet = async (value) => {
        try {
            const validatedValue = validateTolerance(value);
            validateToleranceRange(phTolerance, validatedValue);
            setPhToleranceRange(validatedValue);
            await saveConfigToFirebase({ phToleranceRange: validatedValue });
            
            // Enviar configuración a ThingSpeak para el ESP32
            await sendConfigToThingSpeak(phTolerance, validatedValue, dosingMode);
            
            setError(null);
        } catch (err) {
            logError('TOLERANCE_RANGE_VALIDATION_ERROR', err.message, { value });
            setError({ type: 'error', message: err.message });
        }
    };

    // Wrapper para setDosingMode con guardado en Firebase
    const safeDosingModeSet = async (value) => {
        setDosingMode(value);
        await saveConfigToFirebase({ dosingMode: value });
        
        // Enviar configuración a ThingSpeak para el ESP32
        await sendConfigToThingSpeak(phTolerance, phToleranceRange, value);
    };
    
    // Función para enviar configuración a ThingSpeak Field8
    const sendConfigToThingSpeak = async (phTarget, tolerance, mode) => {
        try {
            const autoMode = mode === 'automatic' ? '1' : '0';
            const configStr = `phTarget:${phTarget},tolerance:${tolerance},autoMode:${autoMode}`;
            
            const url = `https://api.thingspeak.com/update?api_key=GQXD1DTF1D6DPUSG&field8=${encodeURIComponent(configStr)}`;
            
            await fetch(url, { method: 'GET' });
            console.log('✅ Configuración enviada a ThingSpeak:', configStr);
        } catch (error) {
            console.error('❌ Error enviando configuración a ThingSpeak:', error);
        }
    };

    // Verificar conexión ESP32 vía Firebase
    const checkConnection = async () => {
        if (!user?.uid) return;
        
        try {
            const isConnected = await checkESP32Connection(user.uid);
            setEsp32Connected(isConnected);
        } catch (error) {
            setEsp32Connected(false);
        }
    };

    // Comunicación con ESP32 vía Firebase
    const handleDataReceived = (phData) => {
        try {
            console.log('📊 [PHContext] Datos recibidos de Firebase:', phData);
            
            if (!phData || !phData.ph) {
                console.warn('⚠️ [PHContext] Datos inválidos recibidos:', phData);
                return;
            }
            
            safePHSet(phData.ph);
            setLastDataReceived(new Date(phData.timestamp));
            setEsp32Connected(phData.isRecent);
            
            console.log('✅ [PHContext] pH actualizado:', phData.ph, 'Conectado:', phData.isRecent);
            
            // Actualizar historial
            const now = new Date();
            const hour = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const timeString = `${hour}:${minutes}`;
            
            setPhHistory(prev => {
                const filtered = prev.filter(item => item.hour !== timeString);
                const newHistory = [...filtered, { hour: timeString, value: phData.ph }];
                return newHistory.slice(-24);
            });
        } catch (error) {
            console.error('❌ [PHContext] Error procesando datos:', error);
            logError('ESP32_DATA_ERROR', error.message, phData);
        }
    };

    // Inicializar suscripción a Firebase cuando el usuario esté disponible
    useEffect(() => {
        if (!user?.uid) {
            console.log('⏳ Esperando autenticación de usuario...');
            return;
        }

        console.log('🔌 Iniciando suscripción a Firebase para usuario:', user.uid);
        
        // Suscribirse a cambios en tiempo real
        const unsubscribe = subscribeToPHData(user.uid, handleDataReceived);
        
        // Verificación inicial de conexión
        checkESP32Connection(user.uid).then(isConnected => {
            console.log('📡 Estado inicial de conexión:', isConnected);
            setEsp32Connected(isConnected);
        });
        
        return () => {
            console.log('🔌 Cerrando suscripción a Firebase');
            unsubscribe();
        };
    }, [user?.uid]); // Reiniciar cuando cambie el usuario

    // Actualizar historial cuando cambia el pH
    useEffect(() => {
        try {
            const now = new Date();
            const hour = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const timeString = `${hour}:${minutes}`;
            
            setPhHistory(prev => {
                // Evitar duplicados del mismo minuto
                const filtered = prev.filter(item => item.hour !== timeString);
                const newHistory = [...filtered, { hour: timeString, value: ph }];
                return newHistory.slice(-24);
            });
        } catch (err) {
            logError('HISTORY_UPDATE_ERROR', err.message, { ph });
        }
    }, [ph]);
    
    return (
        <PHContext.Provider value={{ 
            // Estados de configuración
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
            
            // Estados de conexión ESP32
            esp32Connected,
            setEsp32Connected,
            lastDataReceived,
            setLastDataReceived,
            
            // Estados de pH
            ph, 
            setPH: safePHSet, 
            phTolerance, 
            setPhTolerance: safeToleranceSet, 
            phToleranceRange, 
            setPhToleranceRange: safeToleranceRangeSet, 
            phHistory,
            
            // Estados de error y dosificación
            error,
            setError,
            dosingMode,
            setDosingMode: safeDosingModeSet,
            manualDosingConfig,
            setManualDosingConfig,
            dosingHistory,
            setDosingHistory,
            
            // Funciones adicionales
            checkConnection,
            saveConfigToFirebase,
            
            // Información de usuario
            user,
            userConfig
        }}>
            {children}
        </PHContext.Provider>
    );
}

export default PHContext;