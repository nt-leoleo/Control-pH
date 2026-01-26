import { useState } from 'react'
import AdminPanel from './AdminPanel.jsx'
import UserPanel from './UserPanel.jsx'
import ToggleButton from './ToggleButton.jsx'
// import Buttons from './Buttons.jsx'
import './App.css'

const Header = () => {
  const [admin, setAdmin] = useState(false)

  const toggleAdmin = () => {
    setAdmin(!admin)
  }

  return (
    <>
      <header className="header">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6" width="2em">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>

        <span>PhOOL</span>

        <ToggleButton admin={admin} onClick={toggleAdmin} />

        <button type="button" className='config' onConfig={handleConfig}>
          <img src="" alt="" />
        </button>
      </header>

      <main>
        {admin ? <AdminPanel /> : <UserPanel />}
      </main>
    </>
  )
}

export default Header;
