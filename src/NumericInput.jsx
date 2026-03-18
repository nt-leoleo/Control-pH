import { useCallback } from 'react';
import './NumericInput.css';

const NumericInput = ({ 
  value, 
  onChange, 
  min = 0, 
  max = 100, 
  step = 1, 
  unit = '', 
  disabled = false,
  className = ''
}) => {
  const handleIncrement = useCallback(() => {
    const newValue = Math.min(max, Number(value) + step);
    onChange(newValue);
  }, [value, max, step, onChange]);

  const handleDecrement = useCallback(() => {
    const newValue = Math.max(min, Number(value) - step);
    onChange(newValue);
  }, [value, min, step, onChange]);

  const handleInputChange = useCallback((e) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      onChange(Math.max(min, Math.min(max, newValue)));
    }
  }, [min, max, onChange]);

  return (
    <div className={`numeric-input ${className}`}>
      <button
        type="button"
        className="numeric-btn numeric-btn-decrement"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        aria-label="Disminuir"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14" />
        </svg>
      </button>
      
      <div className="numeric-input-wrapper">
        <input
          type="number"
          value={value}
          onChange={handleInputChange}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          className="numeric-input-field"
        />
        {unit && <span className="numeric-input-unit">{unit}</span>}
      </div>
      
      <button
        type="button"
        className="numeric-btn numeric-btn-increment"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        aria-label="Aumentar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
};

export default NumericInput;
