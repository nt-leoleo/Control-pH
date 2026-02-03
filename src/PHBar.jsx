import './PHBar.css'
import { useContext } from 'react';
import { PHContext } from './PHContext';

const PHBar = ({ph}) => {
    const { phTolerance, phToleranceRange } = useContext(PHContext);
    const minPH = 0;  // Rango completo de pH
    const maxPH = 14; // Rango completo de pH
    const cursorPosition = () => ((ph - minPH) / (maxPH - minPH)) * 100
    const minRangePH = phTolerance - phToleranceRange;
    const maxRangePH = phTolerance + phToleranceRange;
    const minRangePosition = ((minRangePH - minPH) / (maxPH - minPH)) * 100;
    const maxRangePosition = ((maxRangePH - minPH) / (maxPH - minPH)) * 100;

    // Generar gradiente dinámico basado en la configuración
    const gradientStyle = {
        background: `linear-gradient(
            to right,
            #ef4444 0%,
            #ef4444 ${Math.max(0, minRangePosition)}%,
            #22c55e ${Math.max(0, minRangePosition)}%,
            #22c55e ${Math.min(100, maxRangePosition)}%,
            #f59e0b ${Math.min(100, maxRangePosition)}%,
            #f59e0b 100%
        )`
    };

    return (
        <div className="barContainer">
            <div className="barLabels">
                <span 
                    className="label" 
                    style={{left: `0`}}
                >
                    0
                </span>
                <span 
                    className="label" 
                    style={{left: `${(7 / 14) * 100}%`}}
                >
                    7 (Neutro)
                </span>
                <span 
                    className="label ideal" 
                    style={{left: `${((phTolerance - minPH) / (maxPH - minPH)) * 100}%`}}
                >
                    {phTolerance.toFixed(1)} (Ideal)
                </span>
                <span 
                    className="label" 
                    style={{right: `0`}}
                >
                    14
                </span>
            </div>
            <div className="bar">
                <div className="gradientBg" style={gradientStyle} />
                <div 
                    className="indicatorCursor" 
                    style={{left: `${cursorPosition()}%`}}
                />
            </div>
        </div>
    );
}

export default PHBar;