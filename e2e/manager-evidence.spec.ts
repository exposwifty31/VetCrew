import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./helpers/a11y.js";
import { injectTestBearer } from "./helpers/inject-token.js";
import {
  E2E_MANAGER,
  E2E_TRAINEE,
  createDebriefedRespDistressSession,
  createScoredAssessmentSession,
} from "./helpers/session.js";

test("manager evidence desk lists scored sessions with internal badge", async ({ page, request }) => {
  // A trainee of its own: the e2e database is not reset between runs, so a
  // shared id would make the row count cumulative and the leak check useless.
  const trainee = `${E2E_TRAINEE}-desk-${Date.now()}`;
  await createScoredAssessmentSession(request, trainee);
  // A practice run for the same trainee must not appear beside it: the desk is
  // assessment-only, and practice ratings are formative annotations (§2.2).
  await createDebriefedRespDistressSession(request, trainee);

  await injectTestBearer(page, E2E_MANAGER, "manager");
  await page.goto(`/#/manager/${trainee}`);

  await expect(page.getByRole("heading", { name: "שולחן ראיות" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "סשנים מדורגים" })).toBeVisible();
  await expect(page.getByText("פנימי בלבד").first()).toBeVisible();
  const openAar = page.getByRole("link", { name: "פתיחת תחקיר" });
  await expect(openAar.first()).toBeVisible();
  await expect(openAar).toHaveCount(1);

  await expectNoSeriousA11yViolations(page, "manager-evidence");
});
