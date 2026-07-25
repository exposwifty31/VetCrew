import { expect, type Page } from "@playwright/test";

/** Connection pill in station/instructor headers — avoids matching "נוכחיים" substrings. */
export function expectLiveConnectionPill(page: Page) {
  return expect(page.locator("header").getByText("חי", { exact: true }));
}

export function expectNotLiveConnectionPill(page: Page) {
  return expect(page.locator("header").getByText("חי", { exact: true })).not.toBeVisible();
}
