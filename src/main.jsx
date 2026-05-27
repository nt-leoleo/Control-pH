import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import App from "./App.jsx";
import DeviceSetup from "./DeviceSetup.jsx";
import { PHProvider } from "./PHContext";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";

const tryNotifyAppReady = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await CapacitorUpdater.notifyAppReady();
    console.log('[OTA] notifyAppReady sent');
  } catch (error) {
    console.warn('[OTA] notifyAppReady failed:', error?.message || error);
  }
};

tryNotifyAppReady();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <PHProvider>
          <Routes>
            <Route path="/setup" element={<DeviceSetup />} />
            <Route path="/*" element={<App />} />
          </Routes>
        </PHProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
);
