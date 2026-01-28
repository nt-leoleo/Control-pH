import { useContext } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { PHContext } from './PHContext';
import './PHChart.css';

const PHChart = () => {
    const { phHistory } = useContext(PHContext);

    return (
        <div className="chartContainer">
            <h3>Seguimiento de pH por Hora</h3>
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
                        stroke="#22c55e" 
                        dot={{ fill: '#22c55e', r: 4 }}
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
