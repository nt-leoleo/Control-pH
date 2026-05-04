import { useState } from 'react';
import './UpdateNotification.css';

const UpdateNotification = ({ updateInfo, onUpdate, onDismiss, isUpdating }) => {
  if (!updateInfo) return null;

  if (isUpdating) {
    return (
      <div className="update-overlay">
        <div className="update-modal">
          <div className="update-header">
            <svg className="update-icon update-icon-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <h2>Actualizando...</h2>
          </div>

          <div className="update-body">
            <p className="update-version">Descargando versión {updateInfo.version}</p>
            <div className="update-progress">
              <div className="update-progress-bar"></div>
            </div>
            <p className="update-status">Por favor espera, esto tomará unos segundos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="update-overlay">
      <div className="update-modal">
        <div className="update-header">
          <svg className="update-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <h2>Nueva actualización disponible</h2>
        </div>

        <div className="update-body">
          <p className="update-version">Versión {updateInfo.version}</p>
          
          {updateInfo.releaseNotes && (
            <div className="update-notes">
              <h3>Novedades:</h3>
              <p>{updateInfo.releaseNotes}</p>
            </div>
          )}

          <p className="update-question">¿Desea actualizar ahora?</p>

          {updateInfo.forceUpdate && (
            <p className="update-required">Esta actualización es obligatoria</p>
          )}
        </div>

        <div className="update-actions">
          {!updateInfo.forceUpdate && (
            <button className="update-btn update-btn-secondary" onClick={onDismiss}>
              Más tarde
            </button>
          )}
          <button className="update-btn update-btn-primary" onClick={onUpdate}>
            Actualizar ahora
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotification;
