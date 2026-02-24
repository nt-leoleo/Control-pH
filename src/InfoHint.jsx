import { useEffect, useId, useRef, useState } from 'react';
import './InfoHint.css';

const InfoHint = ({ text, title, className = '', size = 'md', align = 'center' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <span ref={wrapperRef} className={`info-hint ${className}`.trim()}>
      <button
        type="button"
        className={`info-hint-button info-hint-button--${size}`}
        aria-label={title ? `Informacion sobre ${title}` : 'Informacion'}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((previous) => !previous);
        }}
      >
        i
      </button>

      {isOpen && (
        <span id={tooltipId} role="tooltip" className={`info-hint-tooltip info-hint-tooltip--${align}`}>
          {title && <strong>{title}</strong>}
          <span>{text}</span>
        </span>
      )}
    </span>
  );
};

export default InfoHint;
