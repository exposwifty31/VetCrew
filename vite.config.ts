import path from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

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
    proxy: {
      "/api": "http://localhost:3001",
      "/socket.io": {
        target: "http://localhost:3001",
        ws: true,
      },
    },
  },
});

