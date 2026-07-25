import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.js";
import "./main.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (typeof publishableKey !== "string" || publishableKey.length === 0) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY — run `clerk env pull --file .env`");
}

const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("#root missing");

createRoot(rootElement).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </StrictMode>,
);
