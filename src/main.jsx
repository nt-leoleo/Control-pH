import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { PHProvider } from "./PHContext";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PHProvider>
      <App />
    </PHProvider>
  </StrictMode>
);
