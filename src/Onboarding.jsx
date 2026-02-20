import { useContext, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { PHContext } from './PHContext';
import { db } from './firebase';
import { useAuth } from './useAuth';
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
    setError
  } = useContext(PHContext);
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [poolVol, setPoolVol] = useState('');
  const [alkLevel, setAlkLevel] = useState('100');
  const [chlorType, setChlorType] = useState('sodium-hypochlorite');
  const [acdType, setAcdType] = useState('muriatic');
  const [idealPH, setIdealPH] = useState('7.4');
  const [tolerance, setTolerance] = useState('0.3');
  const [registerNow, setRegisterNow] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('Piscina principal');
  const [isSaving, setIsSaving] = useState(false);

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

      if (registerNow && !deviceId.trim()) {
        setError({ type: 'error', message: 'Si deseas registrar ahora, ingresa el Device ID.' });
        return false;
      }
    }

    return true;
  };

  const registerDevice = async () => {
    const trimmedDeviceId = deviceId.trim().toUpperCase();
    if (!trimmedDeviceId || !user?.uid) {
      return true;
    }

    const deviceDoc = await getDoc(doc(db, 'devices', trimmedDeviceId));
    if (deviceDoc.exists()) {
      const existingData = deviceDoc.data();
      if (existingData.userId !== user.uid) {
        throw new Error('Ese Device ID ya esta vinculado a otra cuenta.');
      }
    }

    await setDoc(doc(db, 'devices', trimmedDeviceId), {
      userId: user.uid,
      name: deviceName.trim() || 'Piscina principal',
      createdAt: new Date(),
      lastSeen: new Date(),
      metadata: {
        registeredFrom: 'onboarding',
        userEmail: user.email || ''
      }
    });

    localStorage.setItem('esp32_device_id', trimmedDeviceId);
    return true;
  };

  const finishOnboarding = async () => {
    setIsSaving(true);
    try {
      if (registerNow) {
        await registerDevice();
      }

      await setPoolVolume(parseFloat(poolVol));
      await setAlkalinity(parseFloat(alkLevel));
      await setChlorineType(chlorType);
      await setAcidType(acdType);
      await setPhTolerance(parseFloat(idealPH));
      await setPhToleranceRange(parseFloat(tolerance));
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

    await finishOnboarding();
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
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
              min="100"
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
              min="0"
              max="14"
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
              min="0.1"
              max="5"
              step="0.1"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
            />

            <div className="onboarding-summary">
              Rango automatico: {summaryRange.min} - {summaryRange.max}
            </div>

            <label className="onboarding-check">
              <input
                type="checkbox"
                checked={registerNow}
                onChange={(e) => setRegisterNow(e.target.checked)}
              />
              Registrar mi ESP32 ahora
            </label>

            {registerNow && (
              <div className="onboarding-device-box">
                <label className="onboarding-label" htmlFor="deviceIdInput">
                  Device ID
                </label>
                <input
                  id="deviceIdInput"
                  className="onboarding-input"
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value.toUpperCase())}
                  placeholder="Ej: A1B2C3D4E5F6"
                />

                <label className="onboarding-label" htmlFor="deviceNameInput">
                  Nombre del dispositivo
                </label>
                <input
                  id="deviceNameInput"
                  className="onboarding-input"
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  placeholder="Ej: Piscina principal"
                />
              </div>
            )}
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
    </div>
  );
};

export default Onboarding;
