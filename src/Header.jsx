import { useEffect, useState } from 'react';
import { ConfigButton } from './Buttons';
import ConnectionStatus from './ConnectionStatus';
import ConfirmDialog from './ConfirmDialog';
import ErrorNotification from './ErrorNotification';
import { useAuth } from './useAuth';
import { Capacitor } from '@capacitor/core';
import './header.css';

const Header = ({ onConfigClick }) => {
  const { user, logout } = useAuth();
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [uiMessage, setUiMessage] = useState(null);

  useEffect(() => {
    setAvatarBroken(false);
  }, [user?.photoURL]);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const handleScroll = () => {
      const currentY = window.scrollY;

      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        setIsCompact(currentY > 14);

        if (currentY <= 24) {
          setIsHidden(false);
        } else {
          const delta = currentY - lastY;
          if (delta > 6) setIsHidden(true);
          if (delta < -4) setIsHidden(false);
        }

        lastY = currentY;
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const notify = (type, message) => {
    setUiMessage({
      id: Date.now(),
      type,
      message
    });
  };

  const confirmLogout = async () => {
    setShowLogoutConfirm(false);

    try {
      await logout();
    } catch (error) {
      notify('error', `No se pudo cerrar sesion: ${error.message}`);
    }
  };

  const displayName = (user?.displayName || user?.email || 'Usuario').trim();
  const shortName = displayName.split(' ')[0];
  const initials = shortName.slice(0, 1).toUpperCase();
  const isWeb = !Capacitor.isNativePlatform();

  const handleDownloadApp = () => {
    window.location.href = '/control-pileta.apk';
  };

  return (
    <header className={`app-header ${isCompact ? 'is-compact' : ''} ${isHidden ? 'is-hidden' : ''}`}>
      <div className="header-main-row">
        <div className="header-brand">
          <h1 className="header-title">Control Pileta</h1>
          <p className="header-subtitle">Monitoreo de pH en tiempo real</p>
        </div>

        <div className="header-actions">
          {isWeb && (
            <button className="download-app-btn" onClick={handleDownloadApp} title="Descargar app Android">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Descargar App</span>
            </button>
          )}
          {user && (
            <div className="user-chip" title={`${displayName}${user.email ? ` (${user.email})` : ''}`}>
              {!avatarBroken && user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={displayName}
                  className="user-avatar"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <span className="user-avatar user-avatar-fallback">{initials}</span>
              )}
              <span className="user-name">{shortName}</span>
            </div>
          )}
          <ConfigButton onClick={onConfigClick} data-tutorial="open-settings" />
          {user && (
            <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)} title="Cerrar sesion">
              Salir
            </button>
          )}
        </div>
      </div>

      <div className="header-status-row">
        <ConnectionStatus compact />
      </div>

      {uiMessage && (
        <ErrorNotification
          key={uiMessage.id}
          message={uiMessage.message}
          type={uiMessage.type}
          duration={4500}
        />
      )}

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Cerrar sesion"
        message="Vas a salir de tu cuenta en este navegador."
        details="Podras volver a entrar con Google cuando quieras."
        confirmLabel="Cerrar sesion"
        onCancel={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
      />
    </header>
  );
};

export default Header;
