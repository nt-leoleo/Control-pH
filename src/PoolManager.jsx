import { useContext, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
import ErrorNotification from './ErrorNotification';
import ConfirmDialog from './ConfirmDialog';
import './PoolManager.css';

const PoolManager = ({ onBack }) => {
    const { 
        setPoolVolume, 
        setAlkalinity,
        setChlorineType,
        setAcidType,
        saveConfigToFirebase,
        userConfig
    } = useContext(PHContext);

    const [pools, setPools] = useState([]);
    const [currentPoolId, setCurrentPoolId] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingPool, setEditingPool] = useState(null);
    const [uiMessage, setUiMessage] = useState(null);
    const [poolIdToDelete, setPoolIdToDelete] = useState(null);

    // Formulario para nueva piscina
    const [formData, setFormData] = useState({
        name: '',
        volume: '',
        alkalinity: 100,
        chlorineType: 'sodium-hypochlorite',
        acidType: 'muriatic',
        location: '',
        notes: ''
    });

    const notify = (type, message) => {
        setUiMessage({
            id: Date.now(),
            type,
            message
        });
    };

    // Cargar piscinas guardadas
    useEffect(() => {
        if (userConfig && userConfig.pools) {
            setPools(userConfig.pools);
            setCurrentPoolId(userConfig.currentPoolId || null);
        }
    }, [userConfig]);

    const handleAddPool = async () => {
        if (!formData.name || !formData.volume) {
            notify('warning', 'Completa el nombre y el volumen de la piscina.');
            return;
        }

        const nextPoolId = (pools.reduce((maxId, pool) => {
            const parsedId = Number.parseInt(pool.id, 10);
            return Number.isNaN(parsedId) ? maxId : Math.max(maxId, parsedId);
        }, 0) + 1).toString();

        const newPool = {
            id: nextPoolId,
            name: formData.name,
            volume: parseFloat(formData.volume),
            alkalinity: parseFloat(formData.alkalinity),
            chlorineType: formData.chlorineType,
            acidType: formData.acidType,
            location: formData.location,
            notes: formData.notes,
            createdAt: new Date().toISOString()
        };

        const updatedPools = [...pools, newPool];
        setPools(updatedPools);

        // Guardar en Firebase
        await saveConfigToFirebase({
            pools: updatedPools,
            currentPoolId: currentPoolId || newPool.id
        });

        // Si es la primera piscina, activarla automáticamente
        if (pools.length === 0) {
            await switchPool(newPool.id, updatedPools);
        }

        // Resetear formulario
        setFormData({
            name: '',
            volume: '',
            alkalinity: 100,
            chlorineType: 'sodium-hypochlorite',
            acidType: 'muriatic',
            location: '',
            notes: ''
        });
        setShowAddModal(false);
    };

    const handleEditPool = async () => {
        if (!editingPool || !formData.name || !formData.volume) {
            notify('warning', 'Completa el nombre y el volumen de la piscina.');
            return;
        }

        const updatedPools = pools.map(pool => 
            pool.id === editingPool.id 
                ? { ...pool, ...formData, volume: parseFloat(formData.volume), alkalinity: parseFloat(formData.alkalinity) }
                : pool
        );

        setPools(updatedPools);

        // Guardar en Firebase
        await saveConfigToFirebase({
            pools: updatedPools
        });

        // Si estamos editando la piscina activa, actualizar configuración actual
        if (currentPoolId === editingPool.id) {
            await switchPool(editingPool.id, updatedPools);
        }

        setEditingPool(null);
        setShowAddModal(false);
    };

    const confirmDeletePool = async () => {
        const poolId = poolIdToDelete;
        if (!poolId) return;

        setPoolIdToDelete(null);
        const updatedPools = pools.filter(pool => pool.id !== poolId);
        setPools(updatedPools);

        // Si eliminamos la piscina activa, cambiar a la primera disponible
        let newCurrentId = currentPoolId;
        if (currentPoolId === poolId) {
            newCurrentId = updatedPools.length > 0 ? updatedPools[0].id : null;
            if (newCurrentId) {
                await switchPool(newCurrentId, updatedPools);
            }
        }

        // Guardar en Firebase
        await saveConfigToFirebase({
            pools: updatedPools,
            currentPoolId: newCurrentId
        });
        notify('success', 'Piscina eliminada correctamente.');
    };

    const requestDeletePool = (poolId) => {
        setPoolIdToDelete(poolId);
    };

    const switchPool = async (poolId, poolsList = pools) => {
        const pool = poolsList.find(p => p.id === poolId);
        if (!pool) return;

        // Actualizar configuración actual
        setPoolVolume(pool.volume);
        setAlkalinity(pool.alkalinity);
        setChlorineType(pool.chlorineType);
        setAcidType(pool.acidType);
        setCurrentPoolId(poolId);

        // Guardar en Firebase
        await saveConfigToFirebase({
            currentPoolId: poolId,
            poolVolume: pool.volume,
            alkalinity: pool.alkalinity,
            chlorineType: pool.chlorineType,
            acidType: pool.acidType
        });
    };

    const openEditModal = (pool) => {
        setEditingPool(pool);
        setFormData({
            name: pool.name,
            volume: pool.volume.toString(),
            alkalinity: pool.alkalinity,
            chlorineType: pool.chlorineType,
            acidType: pool.acidType,
            location: pool.location || '',
            notes: pool.notes || ''
        });
        setShowAddModal(true);
    };

    const closeModal = () => {
        setShowAddModal(false);
        setEditingPool(null);
        setFormData({
            name: '',
            volume: '',
            alkalinity: 100,
            chlorineType: 'sodium-hypochlorite',
            acidType: 'muriatic',
            location: '',
            notes: ''
        });
    };

    const currentPool = pools.find(p => p.id === currentPoolId);

    return (
        <div className="pool-manager fade-in">
            {/* Header */}
            <div className="pool-manager-header">
                <button 
                    className="pool-back-btn"
                    onClick={onBack}
                    title="Volver a configuración"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="m15 18-6-6 6-6"/>
                    </svg>
                </button>
                <h1 className="pool-manager-title">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2c3.5 4.5 6 7.4 6 10a6 6 0 1 1-12 0c0-2.6 2.5-5.5 6-10Z" />
                    </svg>
                    Administrar Piscinas
                </h1>
            </div>

            {/* Piscina Actual */}
            {currentPool && (
                <div className="current-pool-banner scale-in">
                    <div className="banner-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <circle cx="12" cy="12" r="6" />
                            <circle cx="12" cy="12" r="2" />
                        </svg>
                    </div>
                    <div className="banner-content">
                        <div className="banner-label">Piscina Activa</div>
                        <div className="banner-name">{currentPool.name}</div>
                        <div className="banner-details">
                            {currentPool.volume}L • Alcalinidad: {currentPool.alkalinity} ppm
                        </div>
                    </div>
                </div>
            )}

            {/* Lista de Piscinas */}
            <div className="pools-list">
                {pools.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2c3.5 4.5 6 7.4 6 10a6 6 0 1 1-12 0c0-2.6 2.5-5.5 6-10Z" />
                            </svg>
                        </div>
                        <h3>No hay piscinas configuradas</h3>
                        <p>Agrega tu primera piscina para comenzar</p>
                    </div>
                ) : (
                    pools.map(pool => (
                        <div 
                            key={pool.id} 
                            className={`pool-card ${pool.id === currentPoolId ? 'active' : ''}`}
                        >
                            <div className="pool-card-header">
                                <div className="pool-card-title">
                                    <h3>{pool.name}</h3>
                                    {pool.id === currentPoolId && (
                                        <span className="active-badge">Activa</span>
                                    )}
                                </div>
                                <div className="pool-card-actions">
                                    <button 
                                        className="pool-action-btn edit"
                                        onClick={() => openEditModal(pool)}
                                        title="Editar"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                    <button 
                                        className="pool-action-btn delete"
                                        onClick={() => requestDeletePool(pool.id)}
                                        title="Eliminar"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            <line x1="10" y1="11" x2="10" y2="17" />
                                            <line x1="14" y1="11" x2="14" y2="17" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="pool-card-details">
                                <div className="detail-item">
                                    <span className="detail-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 2c3.5 4.5 6 7.4 6 10a6 6 0 1 1-12 0c0-2.6 2.5-5.5 6-10Z" />
                                        </svg>
                                    </span>
                                    <span className="detail-text">{pool.volume} Litros</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M10 2h4" />
                                            <path d="M12 2v7" />
                                            <path d="M8 9h8" />
                                            <path d="M9 9v8a3 3 0 0 0 6 0V9" />
                                        </svg>
                                    </span>
                                    <span className="detail-text">Alcalinidad: {pool.alkalinity} ppm</span>
                                </div>
                                {pool.location && (
                                    <div className="detail-item">
                                        <span className="detail-icon">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                        </span>
                                        <span className="detail-text">{pool.location}</span>
                                    </div>
                                )}
                            </div>

                            {pool.notes && (
                                <div className="pool-card-notes">
                                    <span className="notes-icon">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                            <polyline points="14 2 14 8 20 8" />
                                            <line x1="16" y1="13" x2="8" y2="13" />
                                            <line x1="16" y1="17" x2="8" y2="17" />
                                            <polyline points="10 9 9 9 8 9" />
                                        </svg>
                                    </span>
                                    <span className="notes-text">{pool.notes}</span>
                                </div>
                            )}

                            {pool.id !== currentPoolId && (
                                <button 
                                    className="switch-pool-btn"
                                    onClick={() => switchPool(pool.id)}
                                >
                                    Cambiar a esta piscina
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Botón Agregar */}
            <button 
                className="add-pool-fab"
                onClick={() => setShowAddModal(true)}
                title="Agregar piscina"
            >
                +
            </button>

            {/* Modal Agregar/Editar */}
            {showAddModal && (
                <div className="pool-modal-overlay" onClick={closeModal}>
                    <div className="pool-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="pool-modal-header">
                            <h2>
                                {editingPool ? (
                                    <>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                        Editar Piscina
                                    </>
                                ) : (
                                    <>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        Nueva Piscina
                                    </>
                                )}
                            </h2>
                            <button className="modal-close-btn" onClick={closeModal}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <div className="pool-modal-body">
                            <div className="form-group">
                                <label>Nombre *</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Piscina Principal"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                />
                            </div>

                            <div className="form-group">
                                <label>Volumen (Litros) *</label>
                                <input
                                    type="number"
                                    placeholder="Ej: 50000"
                                    value={formData.volume}
                                    onChange={(e) => setFormData({...formData, volume: e.target.value})}
                                />
                            </div>

                            <div className="form-group">
                                <label>Alcalinidad (ppm)</label>
                                <input
                                    type="number"
                                    placeholder="Ej: 100"
                                    value={formData.alkalinity}
                                    onChange={(e) => setFormData({...formData, alkalinity: e.target.value})}
                                />
                            </div>

                            <div className="form-group">
                                <label>Tipo de Cloro</label>
                                <select
                                    value={formData.chlorineType}
                                    onChange={(e) => setFormData({...formData, chlorineType: e.target.value})}
                                >
                                    <option value="sodium-hypochlorite">Hipoclorito de Sodio</option>
                                    <option value="calcium-hypochlorite">Hipoclorito de Calcio</option>
                                    <option value="chlorine-gas">Cloro Gas</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Tipo de Ácido</label>
                                <select
                                    value={formData.acidType}
                                    onChange={(e) => setFormData({...formData, acidType: e.target.value})}
                                >
                                    <option value="muriatic">Ácido Muriático</option>
                                    <option value="bisulfate">Bisulfato de Sodio</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Ubicación (opcional)</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Jardín trasero"
                                    value={formData.location}
                                    onChange={(e) => setFormData({...formData, location: e.target.value})}
                                />
                            </div>

                            <div className="form-group">
                                <label>Notas (opcional)</label>
                                <textarea
                                    placeholder="Ej: Piscina climatizada, uso familiar"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                                    rows="3"
                                />
                            </div>
                        </div>

                        <div className="pool-modal-footer">
                            <button className="modal-btn cancel" onClick={closeModal}>
                                Cancelar
                            </button>
                            <button 
                                className="modal-btn save" 
                                onClick={editingPool ? handleEditPool : handleAddPool}
                            >
                                {editingPool ? 'Guardar Cambios' : 'Agregar Piscina'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {uiMessage && (
                <ErrorNotification
                    key={uiMessage.id}
                    message={uiMessage.message}
                    type={uiMessage.type}
                    duration={4500}
                />
            )}

            <ConfirmDialog
                isOpen={Boolean(poolIdToDelete)}
                title="Eliminar piscina"
                message="Vas a eliminar esta piscina de tu cuenta."
                details="Si era la piscina activa, el sistema cambiara automaticamente a otra disponible."
                confirmLabel="Eliminar"
                tone="danger"
                onCancel={() => setPoolIdToDelete(null)}
                onConfirm={confirmDeletePool}
            />
        </div>
    );
};

export default PoolManager;

