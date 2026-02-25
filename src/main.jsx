import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { PHProvider } from "./PHContext";
import ErrorBoundary from "./ErrorBoundary";
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import "./index.css";

// Inicializar Google Auth para web
GoogleAuth.initialize({
  clientId: '102545501878-28h1bok5jkkpbo4309f8spn7svukoo28.apps.googleusercontent.com',
  scopes: ['profile', 'email'],
  grantOfflineAccess: true,
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <PHProvider>
        <App />
      </PHProvider>
    </ErrorBoundary>
  </StrictMode>
);
