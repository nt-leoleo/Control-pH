import './PHBar.css'

const PHBar = ({ph}) => {
    const minPH = 6;
    const maxPH = 8;
    const cursorPosition = () => ((ph - minPH) / (maxPH - minPH)) * 100
    return (
        <div className="bar">
            <div className="gradientBg" />
            <div 
                className="indicatorCursor" 
                style={{left: `${cursorPosition()}%`}}
            />
        </div>
    );
}

export default PHBar;