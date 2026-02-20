import { useContext, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
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

    // Cargar piscinas guardadas
    useEffect(() => {
        if (userConfig && userConfig.pools) {
            setPools(userConfig.pools);
            setCurrentPoolId(userConfig.currentPoolId || null);
        }
    }, [userConfig]);

    const handleAddPool = async () => {
        if (!formData.name || !formData.volume) {
            alert('Por favor completa el nombre y volumen de la piscina');
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
            alert('Por favor completa el nombre y volumen de la piscina');
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

    const handleDeletePool = async (poolId) => {
        if (!confirm('¿Estás seguro de eliminar esta piscina?')) return;

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
                <h1 className="pool-manager-title">🏊 Administrar Piscinas</h1>
            </div>

            {/* Piscina Actual */}
            {currentPool && (
                <div className="current-pool-banner scale-in">
                    <div className="banner-icon">🎯</div>
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
                        <div className="empty-icon">🏊</div>
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
                                        ✏️
                                    </button>
                                    <button 
                                        className="pool-action-btn delete"
                                        onClick={() => handleDeletePool(pool.id)}
                                        title="Eliminar"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>

                            <div className="pool-card-details">
                                <div className="detail-item">
                                    <span className="detail-icon">💧</span>
                                    <span className="detail-text">{pool.volume} Litros</span>
                                </div>
                                <div className="detail-item">
                                    <span className="detail-icon">⚗️</span>
                                    <span className="detail-text">Alcalinidad: {pool.alkalinity} ppm</span>
                                </div>
                                {pool.location && (
                                    <div className="detail-item">
                                        <span className="detail-icon">📍</span>
                                        <span className="detail-text">{pool.location}</span>
                                    </div>
                                )}
                            </div>

                            {pool.notes && (
                                <div className="pool-card-notes">
                                    <span className="notes-icon">📝</span>
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
                            <h2>{editingPool ? '✏️ Editar Piscina' : '➕ Nueva Piscina'}</h2>
                            <button className="modal-close-btn" onClick={closeModal}>✕</button>
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
        </div>
    );
};

export default PoolManager;
