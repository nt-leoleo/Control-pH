import { useEffect, useState } from 'react';
import './SplashScreen.css';

function createRaindrops() {
    const drops = [];
    const dropCount = 15;

    for (let i = 0; i < dropCount; i++) {
        drops.push({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 3,
            duration: 0.8 + Math.random() * 0.4,
            size: 0.8 + Math.random() * 0.4
        });
    }

    return drops;
}

const SplashScreen = ({ onFinish }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [raindrops] = useState(() => createRaindrops());

    useEffect(() => {
        const fadeTimer = setTimeout(() => {
            setIsVisible(false);
        }, 2700);

        const finishTimer = setTimeout(() => {
            if (onFinish) {
                onFinish();
            }
        }, 3000);

        return () => {
            clearTimeout(fadeTimer);
            clearTimeout(finishTimer);
        };
    }, [onFinish]);

    return (
        <div className={`splash-screen ${!isVisible ? 'fade-out' : ''}`}>
            <div className="rain-effect">
                {raindrops.map((drop) => (
                    <div
                        key={drop.id}
                        className="raindrop"
                        style={{
                            left: `${drop.left}%`,
                            animationDelay: `${drop.delay}s`,
                            animationDuration: `${drop.duration}s`,
                            transform: `scale(${drop.size})`
                        }}
                    >
                        <div className="raindrop-trail"></div>
                    </div>
                ))}
            </div>

            <div className="splash-content">
                <div className="wave-container">
                    <div className="wave wave1"></div>
                    <div className="wave wave2"></div>
                    <div className="wave wave3"></div>
                </div>

                <div className="splash-logo">
                    <div className="logo-circle">
                        <div className="water-drop">💧</div>
                    </div>
                    <h1 className="app-title">Control Pileta pH</h1>
                    <p className="app-subtitle">Monitoreo inteligente en tiempo real</p>
                </div>

                <div className="loading-container">
                    <div className="loading-bar">
                        <div className="loading-progress"></div>
                    </div>
                    <p className="loading-text">Iniciando...</p>
                </div>
            </div>
        </div>
    );
};

export default SplashScreen;
