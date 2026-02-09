import { useContext } from 'react';
import { PHContext } from './PHContext';
import { getESP32IP } from './esp32Communication';
import './ConnectionStatus.css';

const ConnectionStatus = () => {
    const { esp32Connected, lastDataReceived } = useContext(PHContext);
    
    const getStatusText = () => {
        const esp32IP = getESP32IP();
        if (esp32Connected) {
            return `Sensor (${esp32IP})`;
        }
        return 'Sensor Desconectado';
    };

    const getTimeAgo = () => {
        if (!lastDataReceived) return '';
        
        const now = new Date();
        const lastUpdate = new Date(lastDataReceived);
        const diff = now - lastUpdate;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Ahora';
        if (minutes === 1) return 'Hace 1 min';
        if (minutes < 60) return `Hace ${minutes} min`;
        
        const hours = Math.floor(minutes / 60);
        if (hours === 1) return 'Hace 1 hora';
        return `Hace ${hours} horas`;
    };

    return (
        <div className={`connection-status ${esp32Connected ? 'connected' : 'disconnected'}`}>
            <div className="connection-indicator">
                <div className={`status-dot ${esp32Connected ? 'online' : 'offline'}`}></div>
                <span className="status-text">{getStatusText()}</span>
            </div>
            {lastDataReceived && (
                <div className="last-update">
                    <span className="update-time">{getTimeAgo()}</span>
                </div>
            )}
        </div>
    );
};

export default ConnectionStatus;