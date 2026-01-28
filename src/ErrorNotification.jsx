import { useState, useEffect } from 'react';
import './ErrorNotification.css';

const ErrorNotification = ({ message, type = 'error', duration = 5000 }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (duration && isVisible) {
            const timer = setTimeout(() => setIsVisible(false), duration);
            return () => clearTimeout(timer);
        }
    }, [duration, isVisible]);

    if (!isVisible) return null;

    return (
        <div className={`notification notification-${type}`}>
            <div className="notificationContent">
                <span className="notificationIcon">
                    {type === 'error' && '❌'}
                    {type === 'warning' && '⚠️'}
                    {type === 'success' && '✅'}
                    {type === 'info' && 'ℹ️'}
                </span>
                <span className="notificationMessage">{message}</span>
            </div>
            <button 
                className="notificationClose" 
                onClick={() => setIsVisible(false)}
            >
                ✕
            </button>
        </div>
    );
};

export default ErrorNotification;
