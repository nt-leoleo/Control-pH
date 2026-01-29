import { useContext } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PHContext } from './PHContext';
import './PHChart.css';

const WarningIcon = () => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="1.5em" 
        height="1.5em" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2"
    >
        <path d="M12 2L2 20h20L12 2z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
);

const PHChart = () => {
    const { phHistory, ph, phTolerance, phToleranceRange } = useContext(PHContext);

    // Calcular el rango dinámico del eje Y basado en los datos
    const calculateYAxisDomain = () => {
        if (!phHistory || phHistory.length === 0) {
            return [6, 8]; // Valores por defecto si no hay datos
        }

        const values = phHistory.map(item => item.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        
        // Agregar un margen del 10% para mejor visualización
        const range = maxValue - minValue;
        const margin = Math.max(range * 0.1, 0.2); // Mínimo margen de 0.2
        
        const yMin = Math.max(minValue - margin, 6.0); // No bajar de 6.0
        const yMax = Math.min(maxValue + margin, 8.5); // No subir de 8.5
        
        return [yMin, yMax];
    };

    const yAxisDomain = calculateYAxisDomain();

    const getStatus = () => {
        if (ph < phTolerance - phToleranceRange) {
            return { color: '#ef4444', label: 'Bajo' };
        } else if (ph > phTolerance + phToleranceRange) {
            return { color: '#f59e0b', label: 'Alto' };
        } else {
            return { color: '#22c55e', label: 'OK' };
        }
    };

    const status = getStatus();
    const showWarning = status.label !== 'OK';

    return (
        <div className="chartContainer">
            <div className="chartHeader">
                <h3>Seguimiento de pH por Hora</h3>
                {showWarning && (
                    <div className="warningBadge" style={{ color: status.color }}>
                        <WarningIcon />
                    </div>
                )}
            </div>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={phHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                    <XAxis 
                        dataKey="hour" 
                        stroke="rgba(255, 255, 255, 0.6)"
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                        domain={yAxisDomain} 
                        stroke="rgba(255, 255, 255, 0.6)"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.toFixed(1)}
                    />
                    <Tooltip 
                        contentStyle={{
                            backgroundColor: 'rgba(41, 25, 66, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.158)',
                            borderRadius: '0.5em',
                            color: 'whitesmoke'
                        }}
                        formatter={(value) => value.toFixed(2)}
                    />
                    <Legend wrapperStyle={{ color: 'whitesmoke' }} />
                    <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke={status.color}
                        dot={{ fill: status.color, r: 4 }}
                        activeDot={{ r: 6 }}
                        name="pH"
                        strokeWidth={2}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PHChart;
