import './ShowpH.css'
import { useContext } from 'react';
import { PHContext } from './PHContext';

const ShowpH = () => {
    const { ph, phTolerance, phToleranceRange, esp32Connected, lastDataReceived } = useContext(PHContext);
    
    const getStatus = () => {
        if (ph < phTolerance - phToleranceRange) {
            return { 
                text: '🔴 pH Bajo - Agregar pH+', 
                color: 'var(--danger-color)',
                status: 'low'
            };
        } else if (ph > phTolerance + phToleranceRange) {
            return { 
                text: '🟡 pH Alto - Agregar pH-', 
                color: 'var(--warning-color)',
                status: 'high'
            };
        } else {
            return { 
                text: '🟢 pH Ideal - Estado Óptimo', 
                color: 'var(--success-color)',
                status: 'ok'
            };
        }
    };

    const status = getStatus();

    // Debug info
    console.log('🧪 [ShowpH] Estado actual:', {
        ph,
        esp32Connected,
        lastDataReceived,
        status: status.status
    });

    return (
        <div className='body fade-in' data-ph-status={status.status}>
            <span className='ph'>Nivel de pH</span>
            <b className='numpH'>{ph.toFixed(2)}</b>
            <span className='state' style={{ color: status.color }}>
                {status.text}
            </span>
            
            {/* Debug info temporal */}
            {process.env.NODE_ENV === 'development' && (
                <div style={{ 
                    fontSize: '0.8rem', 
                    color: 'var(--text-muted)', 
                    marginTop: '1rem',
                    textAlign: 'center',
                    opacity: 0.7
                }}>
                    <div>Conexión: {esp32Connected ? '✅' : '❌'}</div>
                    {lastDataReceived && (
                        <div>Última actualización: {new Date(lastDataReceived).toLocaleTimeString()}</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ShowpH;