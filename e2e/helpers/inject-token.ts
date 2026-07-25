import type { Page } from "@playwright/test";

import { testBearer } from "./auth.js";

declare global {
  interface Window {
    __VETCREW_TEST_TOKEN__?: string;
  }
}

export async function injectTestBearer(
  page: Page,
  userId: string,
  role: "manager" | "instructor" | "trainee",
): Promise<void> {
  const token = testBearer(userId, role);
  await page.addInitScript((value) => {
    window.__VETCREW_TEST_TOKEN__ = value;
  }, token);
}
