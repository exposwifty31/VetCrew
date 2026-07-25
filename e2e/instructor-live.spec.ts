import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./helpers/a11y.js";
import { injectTestBearer } from "./helpers/inject-token.js";
import { expectLiveConnectionPill } from "./helpers/live-ui.js";
import { E2E_INSTRUCTOR, E2E_TRAINEE, createSession } from "./helpers/session.js";

test("instructor console connects and passes the a11y scan", async ({ page, request }) => {
  const sessionId = await createSession(request, {
    scenarioSlug: "base-rung-resp-distress",
    traineeId: E2E_TRAINEE,
  });

  await injectTestBearer(page, E2E_INSTRUCTOR, "instructor");
  await page.goto(`/#/instructor/${sessionId}`);

  await expect(page.getByText("תחנות מחוברות", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expectLiveConnectionPill(page).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

  await expectNoSeriousA11yViolations(page, "instructor-console");
});
