import { ClerkProvider } from "@clerk/react";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.js";
import "./main.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const hasClerkKey = typeof publishableKey === "string" && publishableKey.length > 0;

const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("#root missing");

function Root({ children }: { children: ReactNode }) {
  if (!hasClerkKey) {
    // E2E / local without keys: render the shell; auth chrome stays off.
    console.warn(
      "VITE_CLERK_PUBLISHABLE_KEY missing — running without ClerkProvider (dev/e2e only)",
    );
    return children;
  }
  return (
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <Root>
      <App />
    </Root>
  </StrictMode>,
);
