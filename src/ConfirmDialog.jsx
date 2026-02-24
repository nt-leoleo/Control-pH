import './ConfirmDialog.css';

const ConfirmDialog = ({
  isOpen,
  title,
  message,
  details,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  isLoading = false,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div
        className={`confirm-dialog confirm-dialog--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>{title}</h3>
        <p>{message}</p>
        {details && <small>{details}</small>}
        <div className="confirm-dialog-actions">
          <button type="button" className="confirm-dialog-btn confirm-dialog-btn--ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="confirm-dialog-btn confirm-dialog-btn--primary"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
