import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Vite resolves this config before loading .env itself, so read it here — same
// idiom as vitest.integration.config.ts. Parallel worktrees each set their own
// ports (docs/worktrees.md); with no .env the defaults are today's values, so CI
// behaviour is unchanged.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env — defaults below
}

const apiPort = Number(process.env["PORT"] ?? 3001);
const webPort = Number(process.env["VETCREW_WEB_PORT"] ?? 5173);
const apiTarget = `http://localhost:${apiPort}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev/build against workspace TypeScript sources; Node prod uses package dist/.
  resolve: {
    alias: {
      "@vetcrew/engine": path.join(rootDir, "packages/engine/src/index.ts"),
      "@vetcrew/shared": path.join(rootDir, "packages/shared/src/index.ts"),
    },
  },
  server: {
    port: webPort,
    // strictPort matters for worktrees: without it a busy port makes Vite hop to
    // the next one while Playwright's baseURL still points here — which is how a
    // suite silently drives another worktree's server.
    strictPort: true,
    proxy: {
      "/api": apiTarget,
      "/socket.io": {
        target: apiTarget,
        ws: true,
      },
    },
  },
});

