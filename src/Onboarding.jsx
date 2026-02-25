import { useContext, useMemo, useState } from 'react';
import { PHContext } from './PHContext';
import { useAuth } from './useAuth';
import {
  DEVICE_ID_REGEX,
  normalizeDeviceId,
  persistUserDeviceLink,
  syncSharedDeviceLink
} from './deviceLinking';
import QRScanner from './QRScanner';
import './Onboarding.css';

const TOTAL_STEPS = 3;

const Onboarding = () => {
  const {
    setIsConfigured,
    setPoolVolume,
    setAlkalinity,
    setChlorineType,
    setAcidType,
    setPhTolerance,
    setPhToleranceRange,
    setError,
    saveConfigToFirebase
  } = useContext(PHContext);
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [poolVol, setPoolVol] = useState('');
  const [alkLevel, setAlkLevel] = useState('100');
  const [chlorType, setChlorType] = useState('sodium-hypochlorite');
  const [acdType, setAcdType] = useState('muriatic');
  const [pumpFlow, setPumpFlow] = useState('1.5');
  const [idealPH, setIdealPH] = useState('7.4');
  const [tolerance, setTolerance] = useState('0.3');
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const summaryRange = useMemo(() => {
    const center = parseFloat(idealPH) || 7.4;
    const range = parseFloat(tolerance) || 0.3;
    return {
      min: Math.max(0, center - range).toFixed(1),
      max: Math.min(14, center + range).toFixed(1)
    };
  }, [idealPH, tolerance]);

  const validateStep = () => {
    if (step === 1) {
      const parsedVolume = parseFloat(poolVol);
      if (Number.isNaN(parsedVolume) || parsedVolume <= 0) {
        setError({ type: 'error', message: 'Ingresa los litros de la piscina.' });
        return false;
      }
    }

    if (step === 2) {
      const parsedFlow = parseFloat(pumpFlow);
      if (Number.isNaN(parsedFlow) || parsedFlow <= 0) {
        setError({ type: 'error', message: 'El caudal debe ser mayor a 0.' });
        return false;
      }
    }

    if (step === 3) {
      const target = parseFloat(idealPH);
      const range = parseFloat(tolerance);

      if (Number.isNaN(target) || target < 0 || target > 14) {
        setError({ type: 'error', message: 'El pH objetivo debe estar entre 0 y 14.' });
        return false;
      }

      if (Number.isNaN(range) || range <= 0 || range > 5) {
        setError({ type: 'error', message: 'La tolerancia debe estar entre 0.1 y 5.' });
        return false;
      }

      const normalizedDeviceId = normalizeDeviceId(deviceId);
      if (!normalizedDeviceId) {
        setError({ type: 'error', message: 'Ingresa el Device ID para continuar.' });
        return false;
      }

      if (!DEVICE_ID_REGEX.test(normalizedDeviceId)) {
        setError({
          type: 'error',
          message: 'El Device ID solo puede tener letras, numeros, guion o guion bajo (6 a 64 caracteres).'
        });
        return false;
      }

      if (normalizedDeviceId !== deviceId) {
        setDeviceId(normalizedDeviceId);
      }
    }

    return true;
  };

  const registerDevice = async () => {
    const trimmedDeviceId = normalizeDeviceId(deviceId);
    if (!trimmedDeviceId || !user?.uid) {
      return true;
    }

    if (!DEVICE_ID_REGEX.test(trimmedDeviceId)) {
      throw new Error('Device ID invalido. Verifica el valor del ESP32.');
    }

    await persistUserDeviceLink({
      uid: user.uid,
      deviceId: trimmedDeviceId,
      deviceName
    });

    const sharedSync = await syncSharedDeviceLink({
      uid: user.uid,
      userEmail: user.email,
      deviceId: trimmedDeviceId,
      deviceName,
      source: 'onboarding'
    });

    localStorage.setItem('esp32_device_id', trimmedDeviceId);
    if (sharedSync.warning) {
      setError({ type: 'info', message: sharedSync.warning });
    }
    return true;
  };

  const finishOnboarding = async (skipDeviceRegistration = false) => {
    setIsSaving(true);
    try {
      if (!skipDeviceRegistration) {
        await registerDevice();
      }

      // Guardar configuración básica
      await setPoolVolume(parseFloat(poolVol));
      await setAlkalinity(parseFloat(alkLevel));
      await setChlorineType(chlorType);
      await setAcidType(acdType);
      await setPhTolerance(parseFloat(idealPH));
      await setPhToleranceRange(parseFloat(tolerance));

      // Crear la primera piscina en el gestor de piscinas
      const firstPool = {
        id: '1',
        name: deviceName || 'Piscina principal',
        volume: parseFloat(poolVol),
        alkalinity: parseFloat(alkLevel),
        chlorineType: chlorType,
        acidType: acdType,
        location: '',
        notes: 'Configurada durante el onboarding',
        createdAt: new Date().toISOString()
      };

      // Guardar la piscina y marcarla como activa
      await saveConfigToFirebase({
        pools: [firstPool],
        currentPoolId: '1',
        pumpFlowRate: parseFloat(pumpFlow)
      });

      await setIsConfigured(true);
    } catch (error) {
      setError({ type: 'error', message: `No se pudo guardar la configuracion: ${error.message}` });
      setIsSaving(false);
      return;
    }
    setIsSaving(false);
  };

  const handleContinue = async () => {
    if (!validateStep()) {
      return;
    }

    if (step < TOTAL_STEPS) {
      setStep((prev) => prev + 1);
      return;
    }

    await finishOnboarding(false);
  };

  const handleConfigureLater = async () => {
    if (step !== 3 || isSaving) return;
    await finishOnboarding(true);
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
    }
  };

  const handleQRScan = (scannedText) => {
    const normalized = normalizeDeviceId(scannedText);
    if (normalized && DEVICE_ID_REGEX.test(normalized)) {
      setDeviceId(normalized);
      setShowQRScanner(false);
      setShowManualInput(false);
      setError({ type: 'success', message: 'Device ID escaneado correctamente' });
    } else {
      setError({ type: 'error', message: 'El código QR no contiene un Device ID válido' });
      setShowQRScanner(false);
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <header className="onboarding-header">
          <span className="onboarding-kicker">Configuracion inicial</span>
          <h1>Empecemos en 3 pasos</h1>
          <p>Todo queda guardado en tu cuenta. Luego podras cambiarlo desde Ajustes.</p>
        </header>

        {step === 1 && (
          <section className="onboarding-step">
            <h2>1. Datos de tu piscina</h2>
            <label className="onboarding-label" htmlFor="poolVolume">
              Litros de la piscina
            </label>
            <input
              id="poolVolume"
              className="onboarding-input"
              type="number"
              step="100"
              value={poolVol}
              onChange={(e) => setPoolVol(e.target.value)}
              placeholder="Ej: 50000"
            />

            <label className="onboarding-label" htmlFor="alkLevel">
              Alcalinidad (ppm)
            </label>
            <select
              id="alkLevel"
              className="onboarding-input"
              value={alkLevel}
              onChange={(e) => setAlkLevel(e.target.value)}
            >
              <option value="80">80 (baja)</option>
              <option value="100">100 (recomendada)</option>
              <option value="120">120 (alta)</option>
            </select>
          </section>
        )}

        {step === 2 && (
          <section className="onboarding-step">
            <h2>2. Productos que usas</h2>
            <p className="onboarding-help">Elegi los productos para subir y bajar pH.</p>

            <label className="onboarding-label" htmlFor="raisePhProduct">
              Para subir pH
            </label>
            <select
              id="raisePhProduct"
              className="onboarding-input"
              value={chlorType}
              onChange={(e) => setChlorType(e.target.value)}
            >
              <option value="sodium-hypochlorite">Hipoclorito de sodio</option>
              <option value="calcium-hypochlorite">Hipoclorito de calcio</option>
              <option value="chlorine-gas">Cloro gas</option>
            </select>

            <label className="onboarding-label" htmlFor="lowerPhProduct">
              Para bajar pH
            </label>
            <select
              id="lowerPhProduct"
              className="onboarding-input"
              value={acdType}
              onChange={(e) => setAcdType(e.target.value)}
            >
              <option value="muriatic">Acido muriatico</option>
              <option value="bisulfate">Bisulfato de sodio</option>
            </select>

            <label className="onboarding-label" htmlFor="pumpFlowInput">
              Caudal de la bomba dosificadora (L/h)
            </label>
            <input
              id="pumpFlowInput"
              className="onboarding-input"
              type="number"
              step="0.1"
              value={pumpFlow}
              onChange={(e) => setPumpFlow(e.target.value)}
              placeholder="Ej: 1.5"
            />
            <p className="onboarding-help-small">
              El caudal típico de bombas dosificadoras es entre 1.5 y 3 L/h. Este valor se usa para calcular tiempos de dosificación.
            </p>
          </section>
        )}

        {step === 3 && (
          <section className="onboarding-step">
            <h2>3. Objetivo de pH</h2>
            <label className="onboarding-label" htmlFor="idealPhInput">
              pH objetivo
            </label>
            <input
              id="idealPhInput"
              className="onboarding-input"
              type="number"
              step="0.1"
              value={idealPH}
              onChange={(e) => setIdealPH(e.target.value)}
            />

            <label className="onboarding-label" htmlFor="toleranceInput">
              Tolerancia (+/-)
            </label>
            <input
              id="toleranceInput"
              className="onboarding-input"
              type="number"
              step="0.1"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
            />

            <div className="onboarding-summary">
              Rango automatico: {summaryRange.min} - {summaryRange.max}
            </div>

            <div className="onboarding-device-box">
              <h3 className="onboarding-device-title">Conecta tu dispositivo</h3>
              
              <label className="onboarding-label" htmlFor="deviceNameInput">
                Nombre del dispositivo
              </label>
              <input
                id="deviceNameInput"
                className="onboarding-input"
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="Crea un nombre para tu piscina"
              />

              <div className="onboarding-device-instructions">
                <p className="onboarding-instruction-main">
                  Escanea el código QR
                </p>
                <p className="onboarding-instruction-detail">
                  (El código QR está en la parte de abajo de la caja del dispositivo)
                </p>
                
                <button
                  type="button"
                  className="onboarding-qr-btn-large"
                  onClick={() => setShowQRScanner(true)}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                  Escanear código QR
                </button>

                {deviceId && (
                  <div className="onboarding-scanned-id">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>ID: {deviceId}</span>
                  </div>
                )}

                <div className="onboarding-divider">
                  <span>O</span>
                </div>

                <button
                  type="button"
                  className="onboarding-manual-btn"
                  onClick={() => setShowManualInput(!showManualInput)}
                >
                  {showManualInput ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                      Cancelar ingreso manual
                    </>
                  ) : (
                    'Pon el código ID manualmente'
                  )}
                </button>
              </div>

              {showManualInput && (
                <div className="onboarding-manual-input-section">
                  <label className="onboarding-label" htmlFor="deviceIdInput">
                    Código ID del dispositivo
                  </label>
                  <input
                    id="deviceIdInput"
                    className="onboarding-input"
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="Ej: A1B2C3D4E5F6"
                    autoFocus
                  />
                </div>
              )}

              <button type="button" className="onboarding-skip-link" onClick={handleConfigureLater} disabled={isSaving}>
                Quiero configurar despues
              </button>
            </div>
          </section>
        )}

        <footer className="onboarding-footer">
          <div className="onboarding-dots" aria-label={`Paso ${step} de ${TOTAL_STEPS}`}>
            {[1, 2, 3].map((dotStep) => (
              <span key={dotStep} className={`onboarding-dot ${dotStep <= step ? 'active' : ''}`} />
            ))}
          </div>

          <div className="onboarding-actions">
            <button className="onboarding-btn secondary" onClick={handleBack} disabled={step === 1 || isSaving}>
              Atras
            </button>
            <button className="onboarding-btn primary" onClick={handleContinue} disabled={isSaving}>
              {isSaving ? 'Guardando...' : step === TOTAL_STEPS ? 'Finalizar' : 'Continuar'}
            </button>
          </div>
        </footer>
      </div>

      {showQRScanner && (
        <QRScanner
          onScan={handleQRScan}
          onClose={() => setShowQRScanner(false)}
        />
      )}
    </div>
  );
};

export default Onboarding;
