import { useEffect, useState } from 'react';
import { ConfigButton } from './Buttons';
import ConnectionStatus from './ConnectionStatus';
import { useAuth } from './useAuth';
import './header.css';

const Header = ({ onConfigClick }) => {
  const { user, logout } = useAuth();
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

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

  const handleLogout = async () => {
    if (confirm('Estas seguro que quieres cerrar sesion?')) {
      try {
        await logout();
      } catch (error) {
        alert('Error al cerrar sesion: ' + error.message);
      }
    }
  };

  const displayName = (user?.displayName || user?.email || 'Usuario').trim();
  const shortName = displayName.split(' ')[0];
  const initials = shortName.slice(0, 1).toUpperCase();

  return (
    <header className={`app-header ${isCompact ? 'is-compact' : ''} ${isHidden ? 'is-hidden' : ''}`}>
      <div className="header-main-row">
        <div className="header-brand">
          <h1 className="header-title">Control Pileta</h1>
          <p className="header-subtitle">Monitoreo de pH en tiempo real</p>
        </div>

        <div className="header-actions">
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
          <ConfigButton onClick={onConfigClick} />
          {user && (
            <button className="logout-btn" onClick={handleLogout} title="Cerrar sesion">
              Salir
            </button>
          )}
        </div>
      </div>

      <div className="header-status-row">
        <ConnectionStatus compact />
      </div>
    </header>
  );
};

export default Header;
