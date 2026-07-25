import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// DB-backed integration suite (plan Phase 4): serial, against TEST_DATABASE_URL.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env — CI provides TEST_DATABASE_URL directly
}

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Match Vite: consume workspace TypeScript sources in tests; prod Node uses dist/.
    conditions: ["development", "import", "module", "default"],
    alias: {
      "@vetcrew/engine": path.join(rootDir, "packages/engine/src/index.ts"),
      "@vetcrew/shared": path.join(rootDir, "packages/shared/src/index.ts"),
    },
  },
  test: {
    include: ["server/test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
