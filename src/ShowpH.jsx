import './ShowpH.css'
import { useContext } from 'react';
import { PHContext } from './PHContext';

const ShowpH = () => {
    const { ph, phTolerance, phToleranceRange } = useContext(PHContext);
    
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

    return (
        <div className='body fade-in' data-ph-status={status.status}>
            <span className='ph'>Nivel de pH</span>
            <b className='numpH'>{ph.toFixed(2)}</b>
            <span className='state' style={{ color: status.color }}>
                {status.text}
            </span>
        </div>
    );
};

export default ShowpH;