import { useEffect, useState } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onFinish }) => {
    const [isVisible, setIsVisible] = useState(true);
    const [raindrops, setRaindrops] = useState([]);

    // Generar gotas de lluvia estilo GTA Vice City
    useEffect(() => {
        const drops = [];
        const dropCount = 15; // Número de gotas

        for (let i = 0; i < dropCount; i++) {
            drops.push({
                id: i,
                left: Math.random() * 100, // Posición horizontal aleatoria (%)
                delay: Math.random() * 3, // Delay aleatorio (0-3s)
                duration: 0.8 + Math.random() * 0.4, // Duración (0.8-1.2s)
                size: 0.8 + Math.random() * 0.4 // Tamaño (0.8-1.2)
            });
        }

        setRaindrops(drops);
    }, []);

    useEffect(() => {
        console.log('🎬 SplashScreen montado - Iniciando animación de 3 segundos');
        
        // Después de 2.7 segundos, comenzar fade out
        const fadeTimer = setTimeout(() => {
            console.log('🎭 Iniciando fade out (2.7s)');
            setIsVisible(false);
        }, 2700);

        // Después de 3 segundos, notificar que terminó
        const finishTimer = setTimeout(() => {
            console.log('✅ SplashScreen terminado (3s) - Llamando onFinish');
            if (onFinish) {
                onFinish();
            }
        }, 3000);

        return () => {
            console.log('🧹 SplashScreen desmontado - Limpiando timers');
            clearTimeout(fadeTimer);
            clearTimeout(finishTimer);
        };
    }, [onFinish]);

    console.log('🎨 Renderizando SplashScreen, isVisible:', isVisible);

    return (
        <div className={`splash-screen ${!isVisible ? 'fade-out' : ''}`}>
            {/* Efecto de gotas de lluvia estilo GTA Vice City */}
            <div className="rain-effect">
                {raindrops.map(drop => (
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
                {/* Onda animada de fondo */}
                <div className="wave-container">
                    <div className="wave wave1"></div>
                    <div className="wave wave2"></div>
                    <div className="wave wave3"></div>
                </div>

                {/* Logo y texto */}
                <div className="splash-logo">
                    <div className="logo-circle">
                        <div className="water-drop">💧</div>
                    </div>
                    <h1 className="app-title">Control Pileta pH</h1>
                    <p className="app-subtitle">Monitoreo inteligente en tiempo real</p>
                </div>

                {/* Indicador de carga */}
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
