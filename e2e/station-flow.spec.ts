import { expect, test } from "@playwright/test";

import { injectTestBearer } from "./helpers/inject-token.js";
import { expectLiveConnectionPill } from "./helpers/live-ui.js";
import { E2E_TRAINEE, createSteppedStationSession } from "./helpers/session.js";

test("trainee station connects and completes the first stepped task", async ({ page, request }) => {
  const sessionId = await createSteppedStationSession(request, E2E_TRAINEE);

  await injectTestBearer(page, E2E_TRAINEE, "trainee");
  await page.goto(`/#/station/${sessionId}`);

  await expectLiveConnectionPill(page).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "מדדים ראשוניים" })).toBeVisible();

  await page.getByRole("button", { name: "התחלה" }).click();

  await page.getByLabel("חום").fill("38.4");
  await page.getByLabel("דופק").fill("92");
  await page.getByLabel("נשימות").fill("24");
  await page.getByRole("button", { name: "שליחה" }).click();

  await expect(page.getByRole("heading", { name: "מדידת לחץ דם" })).toBeVisible({
    timeout: 10_000,
  });
});
