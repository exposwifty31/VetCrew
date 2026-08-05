import { defineConfig } from "@playwright/test";

// Ports come from the worktree's own .env so this config, the Vite server and the
// API server all agree by construction (docs/worktrees.md). No .env → today's
// defaults, so CI is unchanged.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env — defaults below
}

const apiPort = Number(process.env["PORT"] ?? 3001);
const webPort = Number(process.env["VETCREW_WEB_PORT"] ?? 5173);

/**
 * E2E suite (plan Phase 4): full instructor-run -> AAR flow + a11y scan.
 * Run explicitly via `pnpm test:e2e`; not part of `pnpm test`.
 * Requires a local Postgres reachable through .env DATABASE_URL.
 */
export default defineConfig({
  testDir: "e2e",
  // Seeds an assessment-mode scenario; practice scenarios cannot reach `scored`,
  // so the scoring flow would otherwise have no e2e coverage at all.
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: `http://localhost:${webPort}`,
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm dev:server",
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VETCREW_TEST_AUTH: "1",
        VETCREW_ALLOW_UNREVIEWED_SCORES: "1",
      },
    },
    {
      command: "pnpm dev",
      url: `http://localhost:${webPort}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
