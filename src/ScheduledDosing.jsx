import { useContext, useState, useEffect } from 'react';
import { PHContext } from './PHContext';
import { useAuth } from './useAuth';
import InfoHint from './InfoHint';
import './ScheduledDosing.css';

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Lun' },
  { id: 'tuesday', label: 'Mar' },
  { id: 'wednesday', label: 'MiÃ©' },
  { id: 'thursday', label: 'Jue' },
  { id: 'friday', label: 'Vie' },
  { id: 'saturday', label: 'SÃ¡b' },
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
    if (days.length === 7) return 'Todos los dÃ­as';
    if (days.length === 0) return 'NingÃºn dÃ­a';
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
          title="Â¿CuÃ¡ndo puede trabajar el sistema automÃ¡tico?"
          text="Elige en quÃ© horarios quieres que el sistema corrija el pH solo. Por ejemplo: solo de dÃ­a, o solo cuando estÃ¡s en casa. Si no configuras nada, el sistema trabaja todo el dÃ­a."
        />
      </div>

      <div className="scheduled-list">
        {schedules.length === 0 && !showAddForm && (
          <div className="no-schedules">
            <p>No hay horarios configurados</p>
            <p className="no-schedules-hint">
              El sistema automÃ¡tico puede trabajar todo el dÃ­a.
              Si quieres que solo trabaje en ciertos horarios, agrega uno aquÃ­.
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
                  className="edit-btn"
                  onClick={() => handleEditSchedule(schedule)}
                  title="Editar"
                >
                  Editar
                </button>
                <button
                  className="toggle-btn"
                  onClick={() => handleToggleSchedule(schedule.id)}
                  title={schedule.enabled ? 'Desactivar' : 'Activar'}
                >
                  {schedule.enabled ? 'âœ“' : 'â—‹'}
                </button>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteSchedule(schedule.id)}
                  title="Eliminar"
                >
                  âœ•
                </button>
              </div>
              </div>
            </div>
            <div className="schedule-details">
              <span className="detail-item">
                <strong>DÃ­as:</strong> {getDaysLabel(schedule.days)}
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
              placeholder="Ej: Solo de dÃ­a"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Desde las</label>
              <input
                type="text"
                value={formData.startTime}
                onChange={(e) => {
                  const value = e.target.value;
                  // Permitir solo nÃºmeros y :
                  if (/^[0-9:]*$/.test(value)) {
                    setFormData({ ...formData, startTime: value });
                  }
                }}
                onBlur={(e) => {
                  // Formatear al perder foco
                  const value = e.target.value;
                  if (value && !value.includes(':')) {
                    // Si solo escribiÃ³ nÃºmeros, formatear como HH:MM
                    if (value.length <= 2) {
                      setFormData({ ...formData, startTime: value.padStart(2, '0') + ':00' });
                    } else if (value.length === 3) {
                      setFormData({ ...formData, startTime: value[0] + ':' + value.slice(1) });
                    } else if (value.length === 4) {
                      setFormData({ ...formData, startTime: value.slice(0, 2) + ':' + value.slice(2) });
                    }
                  }
                }}
                placeholder="08:00"
                pattern="[0-2][0-9]:[0-5][0-9]"
                maxLength="5"
              />
            </div>

            <div className="form-group">
              <label>Hasta las</label>
              <input
                type="text"
                value={formData.endTime}
                onChange={(e) => {
                  const value = e.target.value;
                  // Permitir solo nÃºmeros y :
                  if (/^[0-9:]*$/.test(value)) {
                    setFormData({ ...formData, endTime: value });
                  }
                }}
                onBlur={(e) => {
                  // Formatear al perder foco
                  const value = e.target.value;
                  if (value && !value.includes(':')) {
                    // Si solo escribiÃ³ nÃºmeros, formatear como HH:MM
                    if (value.length <= 2) {
                      setFormData({ ...formData, endTime: value.padStart(2, '0') + ':00' });
                    } else if (value.length === 3) {
                      setFormData({ ...formData, endTime: value[0] + ':' + value.slice(1) });
                    } else if (value.length === 4) {
                      setFormData({ ...formData, endTime: value.slice(0, 2) + ':' + value.slice(2) });
                    }
                  }
                }}
                placeholder="20:00"
                pattern="[0-2][0-9]:[0-5][0-9]"
                maxLength="5"
              />
            </div>
          </div>

          <div className="time-format-info">
            <span className="info-icon-circle">i</span>
            <span className="info-text">Formato 24 horas - Ejemplos: 08:00 (maÃ±ana), 14:00 (tarde), 20:00 (noche)</span>
          </div>
          {!isTimeValid() && formData.startTime && formData.endTime && (
            <div className="form-error">
              La hora de fin tiene que ser despuÃ©s de la hora de inicio
            </div>
          )}

          <div className="form-group">
            <label>Â¿QuÃ© dÃ­as?</label>
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
          <strong>Recuerda:</strong> El sistema automÃ¡tico solo trabaja en estos horarios.
          TÃº puedes corregir manualmente cuando quieras, en cualquier momento.
        </p>
      </div>
    </div>
  );
};

export default ScheduledDosing;
