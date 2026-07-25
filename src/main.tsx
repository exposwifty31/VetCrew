import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.js";
import "./main.css";

const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("#root missing");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
