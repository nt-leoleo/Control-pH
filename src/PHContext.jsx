import { createContext, useState, useEffect } from 'react';
import { validatePHValue, validateTolerance, validateToleranceRange, logError, ErrorMessages } from './errorUtils';

export const PHContext = createContext(null);

export const PHProvider = ({ children }) => {
    const [isConfigured, setIsConfigured] = useState(false); // Nueva: si pasó onboarding
    const [poolVolume, setPoolVolume] = useState(null); // Litros de la piscina
    const [alkalinity, setAlkalinity] = useState(100); // ppm (80-120 ideal)
    const [chlorineType, setChlorineType] = useState('sodium-hypochlorite'); // Tipo de cloro
    const [acidType, setAcidType] = useState('muriatic'); // Tipo de ácido para bajar pH
    
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

    useEffect(() => {
        try {
            const now = new Date();
            const hour = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const timeString = `${hour}:${minutes}`;
            
            setPhHistory(prev => {
                const newHistory = [...prev, { hour: timeString, value: ph }];
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
            setDosingHistory
        }}>
            {children}
        </PHContext.Provider>
    );
}

export default PHContext;