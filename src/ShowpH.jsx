import './ShowpH.css';
import { useContext, useMemo, useRef, useState } from 'react';
import { PHContext } from './PHContext';

const SWIPE_THRESHOLD = 42;
const GAUGE_MIN = 6.0;
const GAUGE_MAX = 8.5;
const GAUGE_START_ANGLE = -120;
const GAUGE_END_ANGLE = 120;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const polarToCartesian = (cx, cy, radius, angleDeg) => {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
};

const describeArc = (cx, cy, radius, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

const ShowpH = () => {
  const { ph, phTolerance, phToleranceRange } = useContext(PHContext);
  const [slideIndex, setSlideIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);

  const getStatus = () => {
    if (ph < phTolerance - phToleranceRange) return { text: 'pH bajo', status: 'low' };
    if (ph > phTolerance + phToleranceRange) return { text: 'pH alto', status: 'high' };
    return { text: 'pH en rango ideal', status: 'ok' };
  };

  const status = getStatus();
  const minIdeal = (phTolerance - phToleranceRange).toFixed(1);
  const maxIdeal = (phTolerance + phToleranceRange).toFixed(1);

  const idealMinValue = clamp(phTolerance - phToleranceRange, GAUGE_MIN, GAUGE_MAX);
  const idealMaxValue = clamp(phTolerance + phToleranceRange, GAUGE_MIN, GAUGE_MAX);
  const phOnGauge = clamp(ph, GAUGE_MIN, GAUGE_MAX);

  const valueToAngle = (value) => {
    const ratio = (value - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);
    return GAUGE_START_ANGLE + ratio * (GAUGE_END_ANGLE - GAUGE_START_ANGLE);
  };

  const needleAngle = valueToAngle(phOnGauge);
  const idealStartAngle = valueToAngle(idealMinValue);
  const idealEndAngle = valueToAngle(idealMaxValue);

  const gaugeArcs = useMemo(
    () => [
      {
        path: describeArc(100, 120, 84, GAUGE_START_ANGLE, idealStartAngle),
        className: 'zone-low',
      },
      {
        path: describeArc(100, 120, 84, idealStartAngle, idealEndAngle),
        className: 'zone-ideal',
      },
      {
        path: describeArc(100, 120, 84, idealEndAngle, GAUGE_END_ANGLE),
        className: 'zone-high',
      },
    ],
    [idealStartAngle, idealEndAngle]
  );

  const gaugeTicks = useMemo(() => {
    const totalTicks = 20;
    const ticks = [];

    for (let i = 0; i <= totalTicks; i++) {
      const value = GAUGE_MIN + (i / totalTicks) * (GAUGE_MAX - GAUGE_MIN);
      const angle = valueToAngle(value);
      const inner = polarToCartesian(100, 120, i % 5 === 0 ? 64 : 70, angle);
      const outer = polarToCartesian(100, 120, 76, angle);
      ticks.push({
        x1: inner.x,
        y1: inner.y,
        x2: outer.x,
        y2: outer.y,
        major: i % 5 === 0,
      });
    }

    return ticks;
  }, []);

  const goToSlide = (nextIndex) => setSlideIndex(Math.min(1, Math.max(0, nextIndex)));

  const onTouchStart = (event) => {
    touchStartX.current = event.touches[0].clientX;
    touchCurrentX.current = event.touches[0].clientX;
  };

  const onTouchMove = (event) => {
    touchCurrentX.current = event.touches[0].clientX;
  };

  const onTouchEnd = () => {
    const deltaX = touchCurrentX.current - touchStartX.current;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX < 0) goToSlide(slideIndex + 1);
    if (deltaX > 0) goToSlide(slideIndex - 1);
  };

  return (
    <section className="ph-hero fade-in" data-ph-status={status.status} data-tutorial="ph-meter">
      <div
        className="ph-carousel"
        data-tutorial="ph-carousel"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className={`ph-carousel-track slide-${slideIndex}`}>
          <div className="ph-slide" data-tutorial="ph-meter-read">
            <p className="ph-label">Lectura actual</p>
            <p className="ph-value" data-tutorial="ph-meter-value">
              {ph.toFixed(2)}
            </p>
            <p className="ph-status" data-tutorial="ph-meter-status">
              {status.text}
            </p>
            <div className="ph-meta" data-tutorial="ph-meter-target">
              <span>Objetivo: {phTolerance.toFixed(1)}</span>
              <span>Ideal: {minIdeal} - {maxIdeal}</span>
            </div>
          </div>

          <div className="ph-slide ph-slide-gauge" data-tutorial="ph-meter-gauge">
            <div className="ph-gauge-wrap">
              <svg viewBox="0 0 200 150" className="ph-gauge" role="img" aria-label={`Medidor de pH ${ph.toFixed(2)}`}>
                <defs>
                  <linearGradient id="gaugeBezelGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--gauge-bezel-top)" />
                    <stop offset="50%" stopColor="var(--gauge-bezel-mid)" />
                    <stop offset="100%" stopColor="var(--gauge-bezel-bottom)" />
                  </linearGradient>
                  <radialGradient id="gaugeDialGradient" cx="50%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="var(--gauge-dial-top)" />
                    <stop offset="60%" stopColor="var(--gauge-dial-mid)" />
                    <stop offset="100%" stopColor="var(--gauge-dial-bottom)" />
                  </radialGradient>
                  <linearGradient id="needleGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--gauge-needle-top)" />
                    <stop offset="100%" stopColor="var(--gauge-needle-bottom)" />
                  </linearGradient>
                  <linearGradient id="valuePanelGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="var(--gauge-panel-top)" />
                    <stop offset="100%" stopColor="var(--gauge-panel-bottom)" />
                  </linearGradient>
                  <filter id="needleGlow">
                    <feGaussianBlur stdDeviation="1.8" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="cyanGlow">
                    <feGaussianBlur stdDeviation="2.2" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <circle cx="100" cy="120" r="99" className="gauge-rim-outer" />
                <circle cx="100" cy="120" r="92" className="gauge-rim-inner" />
                <circle cx="100" cy="120" r="85" className="gauge-dial-surface" />
                <path d={describeArc(100, 120, 98, 215, 325)} className="gauge-neon-base" filter="url(#cyanGlow)" />
                <path d={describeArc(100, 120, 92, GAUGE_START_ANGLE, GAUGE_END_ANGLE)} className="gauge-base-arc" />

                {gaugeArcs.map((arc, index) => (
                  <path key={index} d={arc.path} className={`gauge-color-arc ${arc.className}`} />
                ))}

                {gaugeTicks.map((tick, index) => (
                  <line
                    key={index}
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                    className={`gauge-tick ${tick.major ? 'major' : ''}`}
                  />
                ))}

                <text x="100" y="24" className="gauge-ideal-label">
                  IDEAL
                </text>

                <text x="25" y="98" className="gauge-limit-label">
                  {minIdeal}
                </text>
                <text x="175" y="98" className="gauge-limit-label" textAnchor="end">
                  {maxIdeal}
                </text>

                <g transform={`rotate(${needleAngle} 100 120)`} filter="url(#needleGlow)">
                  <path d="M 100 44 L 104 120 L 96 120 Z" className="gauge-needle" />
                  <circle cx="100" cy="52" r="2.5" className="gauge-needle-tip" />
                </g>

                <circle cx="100" cy="120" r="12" className="gauge-center-outer" />
                <circle cx="100" cy="120" r="7" className="gauge-center-inner" />
                <circle cx="100" cy="120" r="3" className="gauge-center-dot" />

                <rect x="66" y="94" width="68" height="24" rx="7" className="gauge-value-panel" />
                <text x="100" y="110" className="gauge-value">
                  {ph.toFixed(2)}
                </text>
                <text x="100" y="130" className="gauge-unit">
                  pH
                </text>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div
        className="ph-carousel-indicators"
        data-tutorial="ph-meter-dots"
        role="tablist"
        aria-label="Vistas del medidor de pH"
      >
        <button
          type="button"
          className={`ph-dot ${slideIndex === 0 ? 'active' : ''}`}
          onClick={() => goToSlide(0)}
          aria-label="Ver lectura"
        ></button>
        <button
          type="button"
          className={`ph-dot ${slideIndex === 1 ? 'active' : ''}`}
          onClick={() => goToSlide(1)}
          aria-label="Ver medidor"
        ></button>
      </div>

      <p className="ph-swipe-hint" data-tutorial="ph-swipe-hint">
        Desliza hacia los lados para cambiar vista.
      </p>
    </section>
  );
};

export default ShowpH;
