import { ConfigButton, GoBack} from './Buttons'
// import HandleAdmin from './HandleAdmin.jsx'
import './header.css'

const Header = () => {
    return (
        <>
        <header>
            <GoBack />
            <span>Control pH</span>
            <ConfigButton />
            {/* <SettingsPanel /> */}
            {/*    Header
            <     Control pH     +
            */}
        </header>
        <hr />
        </>
    );
}

export default Header;