import { ConfigButton, GoBack} from './Buttons'
import ConnectionStatus from './ConnectionStatus'
import './header.css'

const Header = ({ onConfigClick }) => {
    return (
        <>
        <header>
            <GoBack />
            <span>Control pH</span>
            <div className="header-right">
                <ConnectionStatus />
                <ConfigButton onClick={onConfigClick} />
            </div>
        </header>
        <hr />
        </>
    );
}

export default Header;