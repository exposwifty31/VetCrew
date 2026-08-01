import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./helpers/a11y.js";
import { injectTestBearer } from "./helpers/inject-token.js";
import { E2E_MANAGER, E2E_TRAINEE, createScoredRespDistressSession } from "./helpers/session.js";

test("manager evidence desk lists scored sessions with internal badge", async ({ page, request }) => {
  await createScoredRespDistressSession(request, E2E_TRAINEE);

  await injectTestBearer(page, E2E_MANAGER, "manager");
  await page.goto(`/#/manager/${E2E_TRAINEE}`);

  await expect(page.getByRole("heading", { name: "שולחן ראיות" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "סשנים מדורגים" })).toBeVisible();
  // Unreviewed sessions stay hidden until the manager opts in (§2.5).
  const showInternal = page.getByRole("checkbox", {
    name: /סשנים לבדיקה פנימית/,
  });
  await expect(showInternal).toBeVisible();
  await showInternal.check();
  await expect(page.getByText("פנימי בלבד").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "פתיחת תחקיר" }).first()).toBeVisible();

  await expectNoSeriousA11yViolations(page, "manager-evidence");
});
