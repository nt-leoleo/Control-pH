import './ShowpH.css'
import { useContext } from 'react';
import { PHContext } from './PHContext';

const ShowpH = () => {
    const { ph, phTolerance, phToleranceRange } = useContext(PHContext);
    
    const getStatus = () => {
        if (ph < phTolerance - phToleranceRange) {
            return { text: 'pH bajo', color: '#ef4444' };
        } else if (ph > phTolerance + phToleranceRange) {
            return { text: 'pH alto', color: '#f59e0b' };
        } else {
            return { text: 'Estado: OK', color: '#22c55e' };
        }
    };

    const status = getStatus();

    return (
        <div className='body'>
            <span className='ph'>pH</span>
            <b className='numpH'>{ph}</b>
            <span className='state' style={{ color: status.color }}>
                {status.text}
            </span>
        
        </div>
    );
};

export default ShowpH;