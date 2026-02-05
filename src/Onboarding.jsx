import { useContext, useState } from 'react';
import { PHContext } from './PHContext';
import './Onboarding.css';

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

    const [step, setStep] = useState(1);
    const [poolVol, setPoolVol] = useState('');
    const [alkLevel, setAlkLevel] = useState('100');
    const [chlorType, setChlorType] = useState('sodium-hypochlorite');
    const [acdType, setAcdType] = useState('muriatic');
    const [idealPH, setIdealPH] = useState('7.4');
    const [tolerance, setTolerance] = useState('0.5');

    const handleNext = async () => {
        if (step === 1) {
            if (!poolVol || poolVol <= 0) {
                setError({ type: 'error', message: 'Ingresá un volumen válido' });
                return;
            }
            setStep(2);
        } else if (step === 2) {
            setStep(3);
        } else if (step === 3) {
            setStep(4);
        } else if (step === 4) {
            await finishOnboarding();
        }
    };

    const finishOnboarding = async () => {
        try {
            console.log('🎯 [Onboarding] Guardando configuración inicial...');
            
            // Guardar toda la configuración de una vez
            await Promise.all([
                setPoolVolume(parseFloat(poolVol)),
                setAlkalinity(parseFloat(alkLevel)),
                setChlorineType(chlorType),
                setAcidType(acdType),
                setPhTolerance(parseFloat(idealPH)),
                setPhToleranceRange(parseFloat(tolerance)),
                setIsConfigured(true)
            ]);
            
            console.log('✅ [Onboarding] Configuración guardada exitosamente');
        } catch (err) {
            console.error('❌ [Onboarding] Error guardando configuración:', err);
            setError({ type: 'error', message: 'Error al guardar configuración: ' + err.message });
        }
    };

    return (
        <div className="onboardingContainer">
            <div className="onboardingContent">
                <div className="onboardingHeader">
                    <h1>Control pH Piscina</h1>
                    <p>Configuración inicial</p>
                </div>

                {/* Step 1: Pool Volume */}
                {step === 1 && (
                    <div className="onboardingStep">
                        <div className="stepIcon">💧</div>
                        <h2>¿Cuántos litros tiene tu piscina?</h2>
                        <p>Este dato es fundamental para calcular la dosificación</p>
                        <input
                            type="number"
                            min="100"
                            step="100"
                            value={poolVol}
                            onChange={(e) => setPoolVol(e.target.value)}
                            placeholder="Ej: 50000"
                            className="onboardingInput"
                        />
                        <span className="inputHint">Litros</span>
                    </div>
                )}

                {/* Step 2: Alkalinity */}
                {step === 2 && (
                    <div className="onboardingStep">
                        <div className="stepIcon">⚖️</div>
                        <h2>Alcalinidad Total (TA)</h2>
                        <p>El "amortiguador" que estabiliza el pH</p>
                        <div className="infoBox">
                            <strong>Rango ideal:</strong> 80-120 ppm<br/>
                            <strong>Muy baja:</strong> pH inestable<br/>
                            <strong>Muy alta:</strong> pH sube descontroladamente
                        </div>
                        <div className="radioGroup">
                            <label>
                                <input type="radio" value="80" checked={alkLevel === '80'} onChange={(e) => setAlkLevel(e.target.value)} />
                                80 ppm (Baja)
                            </label>
                            <label>
                                <input type="radio" value="100" checked={alkLevel === '100'} onChange={(e) => setAlkLevel(e.target.value)} />
                                100 ppm (Recomendado)
                            </label>
                            <label>
                                <input type="radio" value="120" checked={alkLevel === '120'} onChange={(e) => setAlkLevel(e.target.value)} />
                                120 ppm (Alta)
                            </label>
                        </div>
                        <div style={{ marginTop: '1em' }}>
                            <label>Valor personalizado (ppm):</label>
                            <input
                                type="number"
                                min="50"
                                max="200"
                                value={alkLevel}
                                onChange={(e) => setAlkLevel(e.target.value)}
                                className="onboardingInput"
                            />
                        </div>
                    </div>
                )}

                {/* Step 3: Chemicals */}
                {step === 3 && (
                    <div className="onboardingStep">
                        <div className="stepIcon">🧪</div>
                        <h2>Productos químicos</h2>
                        <p>¿Cuáles usas para ajustar pH?</p>
                        
                        <div className="chemicalSection">
                            <h3>Para SUBIR pH (Cloro):</h3>
                            <div className="radioGroup">
                                <label>
                                    <input type="radio" value="sodium-hypochlorite" checked={chlorType === 'sodium-hypochlorite'} onChange={(e) => setChlorType(e.target.value)} />
                                    Hipoclorito de Sodio (NaClO) - Sube pH
                                </label>
                                <label>
                                    <input type="radio" value="calcium-hypochlorite" checked={chlorType === 'calcium-hypochlorite'} onChange={(e) => setChlorType(e.target.value)} />
                                    Hipoclorito de Calcio (Ca(ClO)₂) - Sube más pH
                                </label>
                                <label>
                                    <input type="radio" value="chlorine-gas" checked={chlorType === 'chlorine-gas'} onChange={(e) => setChlorType(e.target.value)} />
                                    Cloro Gas (Cl₂) - Baja levemente pH
                                </label>
                            </div>
                        </div>

                        <div className="chemicalSection">
                            <h3>Para BAJAR pH (Ácido):</h3>
                            <div className="radioGroup">
                                <label>
                                    <input type="radio" value="muriatic" checked={acdType === 'muriatic'} onChange={(e) => setAcdType(e.target.value)} />
                                    Ácido Muriático (HCl) - Más rápido
                                </label>
                                <label>
                                    <input type="radio" value="bisulfate" checked={acdType === 'bisulfate'} onChange={(e) => setAcdType(e.target.value)} />
                                    Bisulfato de Sodio - Más suave
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4: Settings */}
                {step === 4 && (
                    <div className="onboardingStep">
                        <div className="stepIcon">⚙️</div>
                        <h2>Parámetros de control</h2>
                        <p>pH ideal y rango de tolerancia</p>
                        
                        <div className="settingGroup">
                            <label>pH ideal para tu piscina:</label>
                            <input
                                type="number"
                                min="6"
                                max="8"
                                step="0.1"
                                value={idealPH}
                                onChange={(e) => setIdealPH(e.target.value)}
                                className="onboardingInput"
                            />
                            <span className="inputHint">Rango recomendado: 7.2 - 7.8</span>
                        </div>

                        <div className="settingGroup">
                            <label>Rango de tolerancia (±):</label>
                            <input
                                type="number"
                                min="0.1"
                                max="1"
                                step="0.1"
                                value={tolerance}
                                onChange={(e) => setTolerance(e.target.value)}
                                className="onboardingInput"
                            />
                            <span className="inputHint">Ej: 0.5 significa 7.4 ±0.5 (6.9 - 7.9)</span>
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <div className="onboardingFooter">
                    <div className="stepIndicator">
                        {[1, 2, 3, 4].map(s => (
                            <div key={s} className={`dot ${s <= step ? 'active' : ''}`} />
                        ))}
                    </div>
                    <button
                        onClick={handleNext}
                        className="nextBtn"
                    >
                        {step === 4 ? '✓ Comenzar' : 'Siguiente →'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
