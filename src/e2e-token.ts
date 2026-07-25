/** Playwright injects `window.__VETCREW_TEST_TOKEN__` via addInitScript (dev/e2e only). */
export function readE2ETestToken(): string | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { __VETCREW_TEST_TOKEN__?: string };
  return typeof w.__VETCREW_TEST_TOKEN__ === "string" ? w.__VETCREW_TEST_TOKEN__ : null;
}
