import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import './WiFiQRGenerator.css';

function WiFiQRGenerator({ isOpen, onClose }) {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [qrGenerated, setQrGenerated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!ssid || !password || !deviceId) {
      alert('Por favor completa todos los campos');
      return;
    }
    setQrGenerated(true);
  };

  const handleDownload = () => {
    const svg = document.getElementById('wifi-qr-code');
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      
      const downloadLink = document.createElement('a');
      downloadLink.download = `wifi-qr-${deviceId}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleClose = () => {
    setSsid('');
    setPassword('');
    setDeviceId('');
    setQrGenerated(false);
    setShowPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  const qrUrl = `https://controlpileta.vercel.app/wifi-setup?ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(password)}&device=${encodeURIComponent(deviceId)}`;

  return (
    <div className="wifi-qr-modal-overlay" onClick={handleClose}>
      <div className="wifi-qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wifi-qr-header">
          <h2>📱 Generar Código QR WiFi</h2>
          <button className="wifi-qr-close" onClick={handleClose}>×</button>
        </div>

        {!qrGenerated ? (
          <form onSubmit={handleGenerate} className="wifi-qr-form">
            <div className="wifi-qr-field">
              <label htmlFor="qr-ssid">SSID de tu red WiFi</label>
              <input
                id="qr-ssid"
                type="text"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="Ej: MiWiFi-2.4G"
                required
              />
              <small>Asegúrate de usar la red de 2.4 GHz</small>
            </div>

            <div className="wifi-qr-field">
              <label htmlFor="qr-password">Contraseña WiFi</label>
              <div className="wifi-qr-password-wrapper">
                <input
                  id="qr-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña de tu WiFi"
                  required
                />
                <button
                  type="button"
                  className="wifi-qr-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div className="wifi-qr-field">
              <label htmlFor="qr-device">Device ID del ESP32</label>
              <input
                id="qr-device"
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="Ej: ESP32-Setup-A4F00F"
                required
              />
              <small>Encontrarás este ID en la pantalla LCD del dispositivo</small>
            </div>

            <button type="submit" className="wifi-qr-generate-btn">
              Generar Código QR
            </button>
          </form>
        ) : (
          <div className="wifi-qr-result">
            <div className="wifi-qr-code-container">
              <QRCodeSVG
                id="wifi-qr-code"
                value={qrUrl}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="wifi-qr-info">
              <p><strong>Red WiFi:</strong> {ssid}</p>
              <p><strong>Dispositivo:</strong> {deviceId}</p>
            </div>

            <div className="wifi-qr-actions">
              <button onClick={handleDownload} className="wifi-qr-action-btn">
                💾 Descargar QR
              </button>
              <button onClick={handlePrint} className="wifi-qr-action-btn">
                🖨️ Imprimir QR
              </button>
              <button onClick={() => setQrGenerated(false)} className="wifi-qr-action-btn">
                🔄 Generar Otro
              </button>
            </div>

            <div className="wifi-qr-instructions">
              <h3>📋 Instrucciones:</h3>
              <ol>
                <li>Escanea este código QR con tu teléfono</li>
                <li>Se abrirá la app con los datos precargados</li>
                <li>Sigue las instrucciones en pantalla</li>
                <li>¡Listo en 30 segundos!</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default WiFiQRGenerator;
