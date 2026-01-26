import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import Header from './Header.jsx';
// import ShowpH from './ShowpH.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Header />
    {/* <main>
      <ShowpH />
    </main> */}
  </StrictMode>,
)
