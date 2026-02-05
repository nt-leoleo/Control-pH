import { createContext, useState, useEffect } from 'react';
import { validatePHValue, validateTolerance, validateToleranceRange, logError, ErrorMessages } from './errorUtils';
import { useESP32Connection, getPHDataFromESP32, checkESP32Connection } from './esp32Communication';
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
            console.log('🔧 [PHContext] Cargando configuración desde Firebase:', userConfig);
            
            // Cargar configuración guardada
            if (userConfig.poolVolume) setPoolVolume(userConfig.poolVolume);
            if (userConfig.alkalinity) setAlkalinity(userConfig.alkalinity);
            if (userConfig.chlorineType) setChlorineType(userConfig.chlorineType);
            if (userConfig.acidType) setAcidType(userConfig.acidType);
            if (userConfig.phMin) setPhTolerance(userConfig.phMin);
            if (userConfig.phMax) setPhToleranceRange(userConfig.phMax - userConfig.phMin);
            if (userConfig.dosingMode) setDosingMode(userConfig.dosingMode);
            
            // Si tiene configuración básica, marcar como configurado
            const hasBasicConfig = userConfig.poolVolume && userConfig.phMin && userConfig.phMax;
            setIsConfigured(hasBasicConfig || userConfig.isConfigured || false);
            
            console.log('✅ [PHContext] Configuración cargada, isConfigured:', hasBasicConfig);
        }
    }, [userConfig]);

    // Función para guardar configuración en Firebase
    const saveConfigToFirebase = async (configUpdate) => {
        if (!user) return;
        
        try {
            await updateUserConfig(configUpdate);
            console.log('💾 [PHContext] Configuración guardada en Firebase:', configUpdate);
        } catch (error) {
            console.error('❌ [PHContext] Error guardando configuración:', error);
            logError('FIREBASE_SAVE_ERROR', error.message, configUpdate);
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
            await saveConfigToFirebase({ phMin: validatedValue });
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
            await saveConfigToFirebase({ phMax: phTolerance + validatedValue });
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
    };

    // Función para obtener datos de ThingSpeak
    const fetchPHData = async () => {
        try {
            console.log('🔍 [PHContext] Obteniendo datos de ThingSpeak...');
            const phData = await getPHDataFromESP32();
            
            if (phData) {
                console.log('✅ [PHContext] Datos recibidos:', phData);
                safePHSet(phData.ph);
                setLastDataReceived(new Date(phData.timestamp));
                setEsp32Connected(true);
                
                // Actualizar historial
                const now = new Date();
                const hour = now.getHours().toString().padStart(2, '0');
                const minutes = now.getMinutes().toString().padStart(2, '0');
                const timeString = `${hour}:${minutes}`;
                
                setPhHistory(prev => {
                    const newHistory = [...prev, { hour: timeString, value: phData.ph }];
                    return newHistory.slice(-24);
                });
                
            } else {
                console.log('⚠️ [PHContext] No se recibieron datos');
                setEsp32Connected(false);
            }
        } catch (error) {
            console.error('❌ [PHContext] Error obteniendo datos:', error);
            setEsp32Connected(false);
            logError('THINGSPEAK_DATA_ERROR', error.message);
        }
    };

    // Verificar conexión ESP32
    const checkConnection = async () => {
        try {
            const isConnected = await checkESP32Connection();
            setEsp32Connected(isConnected);
            
            if (isConnected) {
                console.log('✅ [PHContext] ESP32 conectado');
            } else {
                console.log('❌ [PHContext] ESP32 desconectado');
            }
        } catch (error) {
            console.error('❌ [PHContext] Error verificando conexión:', error);
            setEsp32Connected(false);
        }
    };

    // Comunicación con ESP32 usando ThingSpeak
    const handleDataReceived = (phData) => {
        try {
            console.log('📊 [PHContext] Datos recibidos del hook:', phData);
            safePHSet(phData.ph);
            setLastDataReceived(new Date(phData.timestamp));
            setEsp32Connected(true);
        } catch (error) {
            console.error('❌ [PHContext] Error procesando datos:', error);
            logError('ESP32_DATA_ERROR', error.message, phData);
        }
    };

    const handleConnectionChange = (isConnected) => {
        console.log('🔄 [PHContext] Cambio de conexión:', isConnected);
        setEsp32Connected(isConnected);
        if (isConnected) {
            setLastDataReceived(new Date());
        }
    };

    const { startConnection, stopConnection } = useESP32Connection(
        handleDataReceived,
        handleConnectionChange
    );

    // Inicializar sistema de datos
    useEffect(() => {
        console.log('🚀 [PHContext] Inicializando sistema de datos...');
        
        // Verificación inicial
        checkConnection();
        
        // Obtener datos iniciales
        fetchPHData();
        
        // Iniciar conexión automática
        startConnection();
        
        // Intervalo para obtener datos cada 30 segundos
        const dataInterval = setInterval(() => {
            fetchPHData();
        }, 30000);
        
        // Intervalo para verificar conexión cada 60 segundos
        const connectionInterval = setInterval(() => {
            checkConnection();
        }, 60000);
        
        return () => {
            stopConnection();
            clearInterval(dataInterval);
            clearInterval(connectionInterval);
        };
    }, []);

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
            fetchPHData,
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