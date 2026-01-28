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
                        domain={[6, 8]} 
                        stroke="rgba(255, 255, 255, 0.6)"
                        tick={{ fontSize: 12 }}
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
