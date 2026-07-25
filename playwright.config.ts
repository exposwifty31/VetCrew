import { defineConfig } from "@playwright/test";

/**
 * E2E suite (plan Phase 4): full instructor-run -> AAR flow + a11y scan.
 * Run explicitly via `pnpm test:e2e`; not part of `pnpm test`.
 * Requires a local Postgres reachable through .env DATABASE_URL.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:5173",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm dev:server",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "pnpm dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
