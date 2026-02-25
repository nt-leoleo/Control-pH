import { useContext, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
import { useAuth } from './useAuth';
import InfoHint from './InfoHint';
import './ScheduledDosing.css';

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Lun' },
  { id: 'tuesday', label: 'Mar' },
  { id: 'wednesday', label: 'Mié' },
  { id: 'thursday', label: 'Jue' },
  { id: 'friday', label: 'Vie' },
  { id: 'saturday', label: 'Sáb' },
  { id: 'sunday', label: 'Dom' },
];

const ScheduledDosing = () => {
  const { userConfig, saveConfigToFirebase } = useContext(PHContext);
  const { user } = useAuth();
  
  const [schedules, setSchedules] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    enabled: true,
    startTime: '08:00',
    endTime: '20:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    name: 'Horario permitido'
  });

  useEffect(() => {
    if (userConfig?.autoDosingWindows) {
      setSchedules(userConfig.autoDosingWindows);
    }
  }, [userConfig]);

  const handleSaveSchedule = async () => {
    const newSchedule = {
      id: editingId || `window_${Date.now()}`,
      ...formData,
      createdAt: Date.now(),
    };

    let updatedSchedules;
    if (editingId) {
      updatedSchedules = schedules.map(s => s.id === editingId ? newSchedule : s);
    } else {
      updatedSchedules = [...schedules, newSchedule];
    }

    setSchedules(updatedSchedules);
    await saveConfigToFirebase({ autoDosingWindows: updatedSchedules });
    
    setShowAddForm(false);
    setEditingId(null);
    resetForm();
  };

  const handleDeleteSchedule = async (id) => {
    const updatedSchedules = schedules.filter(s => s.id !== id);
    setSchedules(updatedSchedules);
    await saveConfigToFirebase({ autoDosingWindows: updatedSchedules });
  };

  const handleToggleSchedule = async (id) => {
    const updatedSchedules = schedules.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    setSchedules(updatedSchedules);
    await saveConfigToFirebase({ autoDosingWindows: updatedSchedules });
  };

  const handleEditSchedule = (schedule) => {
    setFormData({
      enabled: schedule.enabled,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      days: schedule.days,
      name: schedule.name
    });
    setEditingId(schedule.id);
    setShowAddForm(true);
  };

  const resetForm = () => {
    setFormData({
      enabled: true,
      startTime: '08:00',
      endTime: '20:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      name: 'Horario permitido'
    });
  };

  const handleCancelEdit = () => {
    setShowAddForm(false);
    setEditingId(null);
    resetForm();
  };

  const getDaysLabel = (days) => {
    if (days.length === 7) return 'Todos los días';
    if (days.length === 0) return 'Ningún día';
    return days.map(d => DAYS_OF_WEEK.find(day => day.id === d)?.label).join(', ');
  };

  const isTimeValid = () => {
    if (!formData.startTime || !formData.endTime) return false;
    const [startH, startM] = formData.startTime.split(':').map(Number);
    const [endH, endM] = formData.endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return endMinutes > startMinutes;
  };

  return (
    <div className="scheduled-dosing-container">
      <div className="scheduled-header-with-info">
        <InfoHint
          size="md"
          title="¿Cuándo puede trabajar el sistema automático?"
          text="Elige en qué horarios quieres que el sistema corrija el pH solo. Por ejemplo: solo de día, o solo cuando estás en casa. Si no configuras nada, el sistema trabaja todo el día."
        />
      </div>

      <div className="scheduled-list">
        {schedules.length === 0 && !showAddForm && (
          <div className="no-schedules">
            <p>No hay horarios configurados</p>
            <p className="no-schedules-hint">
              El sistema automático puede trabajar todo el día.
              Si quieres que solo trabaje en ciertos horarios, agrega uno aquí.
            </p>
          </div>
        )}

        {schedules.map(schedule => (
          <div key={schedule.id} className={`schedule-item ${!schedule.enabled ? 'disabled' : ''}`}>
            <div className="schedule-header">
              <div className="schedule-info">
                <h4>{schedule.name}</h4>
                <p className="schedule-time-range">
                  {schedule.startTime} - {schedule.endTime}
                </p>
              </div>
              <div className="schedule-actions">
                <button
                  className="toggle-btn"
                  onClick={() => handleToggleSchedule(schedule.id)}
                  title={schedule.enabled ? 'Desactivar' : 'Activar'}
                >
                  {schedule.enabled ? '✓' : '○'}
                </button>
                <button
                  className="edit-btn"
                  onClick={() => handleEditSchedule(schedule)}
                  title="Editar"
                >
                  ✎
                </button>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteSchedule(schedule.id)}
                  title="Eliminar"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="schedule-details">
              <span className="detail-item">
                <strong>Días:</strong> {getDaysLabel(schedule.days)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showAddForm && (
        <div className="schedule-form">
          <h4>{editingId ? 'Cambiar horario' : 'Nuevo horario'}</h4>
          
          <div className="form-group">
            <label>Nombre (para recordar)</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Solo de día"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Desde las</label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                step="3600"
              />
            </div>

            <div className="form-group">
              <label>Hasta las</label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                step="3600"
              />
            </div>
          </div>

          {!isTimeValid() && formData.startTime && formData.endTime && (
            <div className="form-error">
              La hora de fin tiene que ser después de la hora de inicio
            </div>
          )}

          <div className="form-group">
            <label>¿Qué días?</label>
            <div className="days-selector">
              {DAYS_OF_WEEK.map(day => (
                <button
                  key={day.id}
                  className={`day-btn ${formData.days.includes(day.id) ? 'selected' : ''}`}
                  onClick={() => {
                    const newDays = formData.days.includes(day.id)
                      ? formData.days.filter(d => d !== day.id)
                      : [...formData.days, day.id];
                    setFormData({ ...formData, days: newDays });
                  }}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-cancel" onClick={handleCancelEdit}>
              Cancelar
            </button>
            <button 
              className="btn-save" 
              onClick={handleSaveSchedule}
              disabled={formData.days.length === 0 || !isTimeValid()}
            >
              {editingId ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </div>
      )}

      {!showAddForm && (
        <button className="btn-add-schedule" onClick={() => setShowAddForm(true)}>
          + Agregar horario
        </button>
      )}

      <div className="schedule-info-box">
        <p className="info-text">
          <strong>Recuerda:</strong> El sistema automático solo trabaja en estos horarios.
          Tú puedes corregir manualmente cuando quieras, en cualquier momento.
        </p>
      </div>
    </div>
  );
};

export default ScheduledDosing;
