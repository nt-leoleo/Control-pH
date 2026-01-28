import { ConfigButton, GoBack} from './Buttons'
import './header.css'

const Header = ({ onConfigClick }) => {
    return (
        <>
        <header>
            <GoBack />
            <span>Control pH</span>
            <ConfigButton onClick={onConfigClick} />
        </header>
        <hr />
        </>
    );
}

export default Header;