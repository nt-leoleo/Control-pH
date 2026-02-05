import { ConfigButton, GoBack} from './Buttons'
import ConnectionStatus from './ConnectionStatus'
import { useAuth } from './useAuth'
import './header.css'

const Header = ({ onConfigClick }) => {
    const { user, logout } = useAuth();

    const handleLogout = async () => {
        if (confirm('¿Estás seguro que quieres cerrar sesión?')) {
            try {
                await logout();
            } catch (error) {
                alert('Error al cerrar sesión: ' + error.message);
            }
        }
    };

    return (
        <>
        <header>
            <GoBack />
            <span>Control pH</span>
            <div className="header-right">
                <ConnectionStatus />
                {user && (
                    <div className="user-info">
                        <img 
                            src={user.photoURL} 
                            alt={user.displayName}
                            className="user-avatar"
                            title={`${user.displayName} (${user.email})`}
                        />
                        <button 
                            className="logout-btn"
                            onClick={handleLogout}
                            title="Cerrar sesión"
                        >
                            🚪
                        </button>
                    </div>
                )}
                <ConfigButton onClick={onConfigClick} />
            </div>
        </header>
        <hr />
        </>
    );
}

export default Header;