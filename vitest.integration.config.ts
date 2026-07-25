import { defineConfig } from "vitest/config";

// DB-backed integration suite (plan Phase 4): serial, against TEST_DATABASE_URL.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env — CI provides TEST_DATABASE_URL directly
}

export default defineConfig({
  test: {
    include: ["server/test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
