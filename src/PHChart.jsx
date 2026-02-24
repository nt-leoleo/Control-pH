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
    const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';

    // Calcular el rango dinámico del eje Y basado en los datos
    const calculateYAxisDomain = () => {
        if (!phHistory || phHistory.length === 0) {
            return [0, 14]; // Rango completo de pH si no hay datos
        }

        const values = phHistory.map(item => item.value);
        const minValue = Math.min(...values);
        const maxValue = Math.max(...values);
        
        // Agregar un margen del 10% para mejor visualización
        const range = maxValue - minValue;
        const margin = Math.max(range * 0.1, 0.5); // Mínimo margen de 0.5
        
        const yMin = Math.max(minValue - margin, 0); // No bajar de 0
        const yMax = Math.min(maxValue + margin, 14); // No subir de 14
        
        return [yMin, yMax];
    };

    const yAxisDomain = calculateYAxisDomain();

    const getStatus = () => {
        if (ph < phTolerance - phToleranceRange) {
            return { color: '#fb7185', label: 'Bajo' };
        } else if (ph > phTolerance + phToleranceRange) {
            return { color: '#f59e0b', label: 'Alto' };
        } else {
            return { color: '#14b8a6', label: 'OK' };
        }
    };

    const status = getStatus();
    const showWarning = status.label !== 'OK';
    const axisColor = isLightTheme ? '#475569' : 'rgba(148, 163, 184, 0.9)';
    const gridColor = isLightTheme ? 'rgba(100, 116, 139, 0.24)' : 'rgba(148, 163, 184, 0.25)';
    const legendColor = isLightTheme ? '#334155' : '#cbd5e1';
    const tooltipStyles = {
        backgroundColor: isLightTheme ? 'rgba(255, 255, 255, 0.98)' : 'rgba(17, 34, 49, 0.96)',
        border: isLightTheme ? '1px solid rgba(148, 163, 184, 0.45)' : '1px solid rgba(148, 163, 184, 0.35)',
        borderRadius: '0.75rem',
        color: isLightTheme ? '#0f172a' : '#e2e8f0'
    };

    return (
        <div className="chartContainer" data-tutorial="ph-chart">
            <div className="chartHeader" data-tutorial="chart-header">
                <h3 data-tutorial="chart-title">Seguimiento de pH por Hora</h3>
                {showWarning && (
                    <div
                        className={`warningBadge warningBadge--active warningBadge--${status.label.toLowerCase()}`}
                        data-tutorial="chart-warning"
                        style={{ '--warning-color': status.color }}
                        title={`Alerta: pH ${status.label}`}
                    >
                        <WarningIcon />
                    </div>
                )}
            </div>
            <div data-tutorial="chart-plot">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={phHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis 
                        dataKey="hour" 
                        stroke={axisColor}
                        tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                        domain={yAxisDomain} 
                        stroke={axisColor}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => value.toFixed(1)}
                    />
                    <Tooltip 
                        contentStyle={tooltipStyles}
                        formatter={(value) => value.toFixed(2)}
                    />
                    <Legend wrapperStyle={{ color: legendColor }} />
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
        </div>
    );
};

export default PHChart;
