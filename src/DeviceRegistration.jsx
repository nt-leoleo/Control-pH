import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './useAuth';
import './DeviceRegistration.css';

/**
 * Componente para registrar dispositivos ESP32 automáticamente
 * El usuario solo necesita ingresar el Device ID una vez
 */
const DeviceRegistration = () => {
    const { user } = useAuth();
    const [deviceId, setDeviceId] = useState('');
    const [deviceName, setDeviceName] = useState('Piscina Principal');
    const [isRegistering, setIsRegistering] = useState(false);
    const [message, setMessage] = useState(null);
    const [registeredDevices, setRegisteredDevices] = useState([]);

    // Cargar dispositivos registrados del usuario
    useEffect(() => {
        if (user) {
            loadUserDevices();
        }
    }, [user]);

    const loadUserDevices = async () => {
        try {
            // Buscar en localStorage si hay dispositivos guardados
            const savedDeviceId = localStorage.getItem('esp32_device_id');
            if (savedDeviceId) {
                // Verificar si existe en Firestore
                const deviceDoc = await getDoc(doc(db, 'devices', savedDeviceId));
                if (deviceDoc.exists() && deviceDoc.data().userId === user.uid) {
                    setRegisteredDevices([{
                        id: savedDeviceId,
                        ...deviceDoc.data()
                    }]);
                    setMessage({
                        type: 'success',
                        text: `✅ Dispositivo registrado: ${savedDeviceId}`
                    });
                }
            }
        } catch (error) {
            console.error('Error cargando dispositivos:', error);
        }
    };

    const handleDelete = async (deviceIdToDelete) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este dispositivo?')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'devices', deviceIdToDelete));
            localStorage.removeItem('esp32_device_id');
            setRegisteredDevices([]);
            setMessage({
                type: 'success',
                text: '✅ Dispositivo eliminado correctamente'
            });
        } catch (error) {
            console.error('Error eliminando dispositivo:', error);
            setMessage({
                type: 'error',
                text: `❌ Error: ${error.message}`
            });
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        
        if (!deviceId.trim()) {
            setMessage({
                type: 'error',
                text: '❌ Por favor ingresa el Device ID del ESP32'
            });
            return;
        }

        if (!user) {
            setMessage({
                type: 'error',
                text: '❌ Debes estar logueado para registrar un dispositivo'
            });
            return;
        }

        setIsRegistering(true);
        setMessage(null);

        try {
            // Verificar si el dispositivo ya existe
            const deviceDoc = await getDoc(doc(db, 'devices', deviceId.trim()));
            
            if (deviceDoc.exists()) {
                const existingData = deviceDoc.data();
                if (existingData.userId !== user.uid) {
                    setMessage({
                        type: 'error',
                        text: '❌ Este dispositivo ya está registrado por otro usuario'
                    });
                    setIsRegistering(false);
                    return;
                }
                
                // Ya está registrado por este usuario
                setMessage({
                    type: 'info',
                    text: '✅ Este dispositivo ya está registrado en tu cuenta'
                });
            } else {
                // Registrar nuevo dispositivo
                await setDoc(doc(db, 'devices', deviceId.trim()), {
                    userId: user.uid,
                    name: deviceName.trim() || 'Piscina Principal',
                    createdAt: new Date(),
                    lastSeen: new Date(),
                    metadata: {
                        registeredFrom: 'web-app',
                        userEmail: user.email
                    }
                });

                // Guardar en localStorage
                localStorage.setItem('esp32_device_id', deviceId.trim());

                setMessage({
                    type: 'success',
                    text: `✅ Dispositivo registrado exitosamente: ${deviceId.trim()}`
                });

                // Recargar dispositivos
                await loadUserDevices();

                // Limpiar formulario
                setDeviceId('');
                setDeviceName('Piscina Principal');
            }

        } catch (error) {
            console.error('Error registrando dispositivo:', error);
            setMessage({
                type: 'error',
                text: `❌ Error: ${error.message}`
            });
        } finally {
            setIsRegistering(false);
        }
    };

    if (!user) {
        return null; // No mostrar si no hay usuario logueado
    }

    return (
        <div className="device-registration">
            <div className="registration-header">
                <h3>🔧 Registro de Dispositivo ESP32</h3>
                <p>Registra tu ESP32 para comenzar a monitorear tu piscina</p>
            </div>

            {registeredDevices.length > 0 ? (
                <div className="registered-devices">
                    <h4>Dispositivos Registrados:</h4>
                    {registeredDevices.map(device => (
                        <div key={device.id} className="device-card">
                            <div className="device-info">
                                <span className="device-icon">📱</span>
                                <div>
                                    <strong>{device.name}</strong>
                                    <small>ID: {device.id}</small>
                                </div>
                            </div>
                            <div className="device-actions">
                                <span className="device-status">✅ Activo</span>
                                <button 
                                    className="delete-btn"
                                    onClick={() => handleDelete(device.id)}
                                    title="Eliminar dispositivo"
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <form onSubmit={handleRegister} className="registration-form">
                    <div className="form-group">
                        <label>Device ID del ESP32:</label>
                        <input
                            type="text"
                            value={deviceId}
                            onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                            placeholder="Ej: A1B2C3D4E5F6"
                            disabled={isRegistering}
                            className="device-id-input"
                        />
                        <small className="help-text">
                            💡 Encuentra el Device ID en el Serial Monitor del ESP32 (115200 baud)
                        </small>
                    </div>

                    <div className="form-group">
                        <label>Nombre del dispositivo:</label>
                        <input
                            type="text"
                            value={deviceName}
                            onChange={(e) => setDeviceName(e.target.value)}
                            placeholder="Ej: Piscina Principal"
                            disabled={isRegistering}
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="register-btn"
                        disabled={isRegistering}
                    >
                        {isRegistering ? '⏳ Registrando...' : '✅ Registrar Dispositivo'}
                    </button>
                </form>
            )}

            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="registration-help">
                <h4>📋 Instrucciones:</h4>
                <ol>
                    <li>Conecta tu ESP32 a la computadora</li>
                    <li>Abre el Serial Monitor (115200 baud)</li>
                    <li>Presiona el botón RESET del ESP32</li>
                    <li>Copia el Device ID que aparece (ej: A1B2C3D4E5F6)</li>
                    <li>Pégalo en el campo de arriba y haz clic en "Registrar"</li>
                </ol>
            </div>
        </div>
    );
};

export default DeviceRegistration;
