import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { CapacitorWifi } from '@capgo/capacitor-wifi';
import './WiFiConfig.css';

const WiFiChangeModal = ({ isOpen, onClose, esp32Ip = '192.168.4.1' }) => {
  const [networks, setNetworks] = useState([]);
  const [selectedNetwork, setSelectedNetwork] = useState('');
  const [customSsid, setCustomSsid] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const targetSsid = (useCustom ? customSsid : selectedNetwork).trim();

  const scanNetworks = async () => {
    setIsScanning(true);
    setError('');
    setNetworks([]);

    try {
      if (!Capacitor.isNativePlatform()) {
        setError('En navegador web, ingresá la red manualmente.');
        return;
      }

      try {
        const p = await Geolocation.checkPermissions();
        if (p.location !== 'granted') {
          await Geolocation.requestPermissions();
        }
      } catch (permissionError) {
        console.warn('No se pudieron verificar los permisos de ubicación:', permissionError);
      }

      try {
        const w = await CapacitorWifi.isEnabled();
        if (!w.enabled) {
          setError('Activá el WiFi en tu dispositivo.');
          return;
        }
      } catch (wifiStateError) {
        console.warn('No se pudo verificar el estado del WiFi:', wifiStateError);
      }

      try {
        await CapacitorWifi.removeAllListeners();
      } catch (cleanupError) {
        console.warn('No se pudieron limpiar listeners anteriores de WiFi:', cleanupError);
      }

      try {
        await CapacitorWifi.startScan();
        await new Promise((resolve) => setTimeout(resolve, 4000));

        const result = await CapacitorWifi.getAvailableNetworks();
        if (result?.networks?.length > 0) {
          const unique = [...new Set(result.networks.filter(n => n?.ssid?.trim()).map(n => n.ssid))].sort();
          setNetworks(unique);
          if (!unique.length) setError('No se encontraron redes.');
        } else {
          setError('No se encontraron redes.');
        }
      } catch (scanError) {
        setError('No se pudo escanear: ' + (scanError.message || 'error'));
      }
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen) { setStatus('idle'); setError(''); setSelectedNetwork(''); setCustomSsid(''); setPassword(''); setUseCustom(false); scanNetworks(); }
  }, [isOpen]);

  const handleSend = async () => {
    if (!targetSsid) { setError('Seleccioná o ingresá el nombre de tu red WiFi.'); return; }
    setIsSending(true); setStatus('sending'); setError('');
    try {
      const formData = new URLSearchParams();
      formData.append('ssid', targetSsid);
      formData.append('password', password || '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`http://${esp32Ip}/wifi/save`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: formData.toString(), signal: controller.signal });
      clearTimeout(timeoutId);
      if (response.ok) setStatus('success');
      else throw new Error(`Error del servidor: ${response.status}`);
    } catch (err) {
      if (err.name === 'AbortError') setStatus('success');
      else { setStatus('error'); setError('No se pudo conectar al ESP32. Asegurate de estar en la misma red.'); }
    } finally { setIsSending(false); }
  };

  const handleClose = () => { setStatus('idle'); setError(''); setNetworks([]); setSelectedNetwork(''); setCustomSsid(''); setPassword(''); setUseCustom(false); onClose(); };

  if (!isOpen) return null;

  return (
    <div className="wifi-config-overlay" onClick={handleClose}>
      <div className="wifi-config-modal" onClick={e => e.stopPropagation()}>
        <div className="wifi-config-header">
          <h2>Cambiar red WiFi</h2>
          <button className="close-btn" onClick={handleClose} disabled={isSending}>✕</button>
        </div>
        <div className="wifi-config-content">
          {error && <div className="error-message">⚠️ {error}</div>}
          {status === 'success' ? (
            <div className="success-message">
              <div className="success-icon">✅</div>
              <h3>¡Configuración enviada!</h3>
              <p>El ESP32 está reiniciándose y conectándose a <strong>{targetSsid}</strong>.</p>
              <p className="small-text">Esto puede tomar hasta 30 segundos.</p>
              <button className="configure-btn" onClick={handleClose} style={{ marginTop: '1.5rem' }}>Cerrar</button>
            </div>
          ) : (
            <>
              <div className="scan-section">
                <button onClick={scanNetworks} disabled={isScanning || isSending} className="scan-btn">
                  {isScanning ? '🔄 Escaneando...' : '🔍 Buscar redes disponibles'}
                </button>
              </div>
              {networks.length > 0 && (
                <div className="networks-list">
                  <h3>Redes disponibles:</h3>
                  {networks.map((network, i) => (
                    <label key={i} className="network-option">
                      <input type="radio" name="wifi-change-network" value={network} checked={selectedNetwork === network && !useCustom} onChange={e => { setSelectedNetwork(e.target.value); setUseCustom(false); }} disabled={isSending} />
                      <span className="network-name">📶 {network}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="custom-network">
                <label className="network-option">
                  <input type="radio" name="wifi-change-network" checked={useCustom} onChange={() => setUseCustom(true)} disabled={isSending} />
                  <span>Ingresar red manualmente</span>
                </label>
                {useCustom && <div className="form-section"><input type="text" placeholder="Ej: MiWiFi-2.4G" value={customSsid} onChange={e => setCustomSsid(e.target.value)} className="wifi-input" autoFocus disabled={isSending} /></div>}
              </div>
              <div className="form-section">
                <label htmlFor="wifi-change-password"><strong>Contraseña WiFi</strong></label>
                <div className="password-wrapper">
                  <input id="wifi-change-password" type={showPassword ? 'text' : 'password'} placeholder="Contraseña (vacío si es abierta)" value={password} onChange={e => setPassword(e.target.value)} className="wifi-input" disabled={isSending} />
                  <button type="button" className="toggle-password" onClick={() => setShowPassword(v => !v)} disabled={isSending}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
                </div>
              </div>
              <button className="configure-btn" onClick={handleSend} disabled={!targetSsid || isSending}>
                {isSending ? '⏳ Enviando al ESP32...' : '💾 Guardar y reiniciar ESP32'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WiFiChangeModal;
