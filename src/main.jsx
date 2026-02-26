import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { PHProvider } from "./PHContext";
import ErrorBoundary from "./ErrorBoundary";
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import "./index.css";

// Configurar StatusBar para Android
if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: true }).catch(err => {
    console.log('StatusBar overlay error:', err);
  });
  
  StatusBar.setStyle({ style: Style.Dark }).catch(err => {
    console.log('StatusBar style error:', err);
  });
  
  StatusBar.setBackgroundColor({ color: '#09141d' }).catch(err => {
    console.log('StatusBar background error:', err);
  });
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <PHProvider>
        <App />
      </PHProvider>
    </ErrorBoundary>
  </StrictMode>
);
