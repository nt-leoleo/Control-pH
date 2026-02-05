import { createContext, useState, useEffect } from 'react';
import { validatePHValue, validateTolerance, validateToleranceRange, logError, ErrorMessages } from './errorUtils';
import { useESP32Connection, getPHDataFromESP32, checkESP32Connection } from './esp32Communication-proxy';

export const PHContext = createContext(null);

export const PHProvider = ({ children }) => {
    const [isConfigured, setIsConfigured] = useState(false); // Nueva: si pasó onboarding
    const [poolVolume, setPoolVolume] = useState(null); // Litros de la piscina
    const [alkalinity, setAlkalinity] = useState(100); // ppm (80-120 ideal)
    const [chlorineType, setChlorineType] = useState('sodium-hypochlorite'); // Tipo de cloro
    const [acidType, setAcidType] = useState('muriatic'); // Tipo de ácido para bajar pH
    
    // Estado de conexión ESP32
    const [esp32Connected, setEsp32Connected] = useState(false);
    const [lastDataReceived, setLastDataReceived] = useState(null);
    
    const [ph, setPH] = useState(7.4);
    const [phTolerance, setPhTolerance] = useState(7.4); // pH ideal para piscinas
    const [phToleranceRange, setPhToleranceRange] = useState(0.5);
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
    const [dosingMode, setDosingMode] = useState('automatic'); // 'automatic' | 'manual'
    const [manualDosingConfig, setManualDosingConfig] = useState({
        product: 'sodium-hypochlorite', // Por defecto
        minutes: 2,
        seconds: 30,
        liters: 5,
    });
    const [dosingHistory, setDosingHistory] = useState([]);

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

    // Wrapper para setPhTolerance con validación
    const safeToleranceSet = (value) => {
        try {
            const validatedValue = parseFloat(value);
            if (isNaN(validatedValue)) {
                throw new Error(ErrorMessages.INVALID_INPUT);
            }
            validateToleranceRange(validatedValue, phToleranceRange);
            setPhTolerance(validatedValue);
            setError(null);
        } catch (err) {
            logError('TOLERANCE_VALIDATION_ERROR', err.message, { value });
            setError({ type: 'error', message: err.message });
        }
    };

    // Wrapper para setPhToleranceRange con validación
    const safeToleranceRangeSet = (value) => {
        try {
            const validatedValue = validateTolerance(value);
            validateToleranceRange(phTolerance, validatedValue);
            setPhToleranceRange(validatedValue);
            setError(null);
        } catch (err) {
            logError('TOLERANCE_RANGE_VALIDATION_ERROR', err.message, { value });
            setError({ type: 'error', message: err.message });
        }
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
            isConfigured,
            setIsConfigured,
            poolVolume,
            setPoolVolume,
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
            setDosingMode,
            manualDosingConfig,
            setManualDosingConfig,
            dosingHistory,
            setDosingHistory,
            // Funciones adicionales
            fetchPHData,
            checkConnection
        }}>
            {children}
        </PHContext.Provider>
    );
}

export default PHContext;