import { createContext, useState, useEffect } from 'react';

export const PHContext = createContext(null);

export const PHProvider = ({ children }) => {
    const [ph, setPH] = useState(7);
    const [phTolerance, setPhTolerance] = useState(7);
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

    useEffect(() => {
        const now = new Date();
        const hour = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const timeString = `${hour}:${minutes}`;
        
        setPhHistory(prev => {
            const newHistory = [...prev, { hour: timeString, value: ph }];
            return newHistory.slice(-24);
        });
    }, [ph]);
    
    return (
        <PHContext.Provider value={{ ph, setPH, phTolerance, setPhTolerance, phToleranceRange, setPhToleranceRange, phHistory }}>
            {children}
        </PHContext.Provider>
    );
}

export default PHContext;