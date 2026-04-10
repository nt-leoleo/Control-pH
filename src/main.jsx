import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import DeviceSetup from "./DeviceSetup.jsx";
import { PHProvider } from "./PHContext";
import ErrorBoundary from "./ErrorBoundary";
import "./index.css";

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
