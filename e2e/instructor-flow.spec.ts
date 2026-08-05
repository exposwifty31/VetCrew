import { expect, test } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./helpers/a11y.js";
import { injectTestBearer } from "./helpers/inject-token.js";
import {
  E2E_INSTRUCTOR,
  E2E_TRAINEE,
  appendDemoRun,
  createSession,
} from "./helpers/session.js";

/**
 * Phase 4 E2E: the MVP flow end to end — a session is run (via API, the
 * trainee station is Sprint 3), its AAR opens in the browser, an instructor
 * submits an evidence-linked ANTS rating, and the stored rating renders.
 * Both surfaces are scanned with axe (WCAG 2.1 A/AA rule set).
 */

const SCENARIO_SLUG = "base-rung-resp-distress";

async function runSession(request: Parameters<typeof createSession>[0]): Promise<string> {
  const sessionId = await createSession(request, {
    scenarioSlug: SCENARIO_SLUG,
    traineeId: E2E_TRAINEE,
  });
  await appendDemoRun(request, sessionId, E2E_TRAINEE);
  return sessionId;
}

test("home page lists sessions and passes the a11y scan", async ({ page, request }) => {
  await runSession(request);

  await injectTestBearer(page, E2E_INSTRUCTOR, "instructor");
  await page.goto("/#/");
  await expect(page.getByRole("heading", { name: "סשנים" })).toBeVisible();
  await expect(page.getByRole("link", { name: "פתיחת תחקיר" }).first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expectNoSeriousA11yViolations(page, "home");
});

test("instructor reviews the AAR and submits an evidence-linked rating", async ({
  page,
  request,
}) => {
  const sessionId = await runSession(request);

  await injectTestBearer(page, E2E_INSTRUCTOR, "instructor");
  await page.goto(`/#/aar/${sessionId}`);

  // AAR renders from replay: vitals, checklist (with the failed priority
  // inversion), and the timeline.
  await expect(page.getByRole("heading", { name: "מדדים לאורך הריצה" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "צ'קליסט טכני" })).toBeVisible();
  await expect(page.getByText("נכשל").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "ציר זמן" })).toBeVisible();

  await expectNoSeriousA11yViolations(page, "aar");

  // Checklist evidence references are operable: each failed item links to
  // the timeline moment that produced it.
  await expect(page.getByRole("button", { name: /מעבר לאירוע \d+ בציר הזמן/ }).first()).toBeVisible();

  // Evidence-linked rating: name the rater, then for EACH ANTS domain select
  // it, mark its own evidence event, and score it (per-domain traceability).
  await page.getByLabel("שם המדרג").fill("מדריכת-בדיקה");

  for (const domain of ["ניהול משימות", "מודעות מצבית", "קבלת החלטות"] as const) {
    const row = page
      .locator("div")
      .filter({ has: page.getByRole("button", { name: domain, exact: true }) })
      .last();
    await row.getByRole("button", { name: domain, exact: true }).click();
    await page.getByRole("checkbox").first().check();
    await row.getByRole("button", { name: "4", exact: true }).click();
  }
  await page.getByRole("button", { name: "שליחת דירוג" }).click();

  // Server stamps raterId from auth when test auth is on.
  await expect(page.getByRole("heading", { name: "דירוגים שנשמרו" })).toBeVisible();
  await expect(page.getByText(E2E_INSTRUCTOR).first()).toBeVisible();
  // This is a PRACTICE session, so the rating is a formative annotation and the
  // session stays in debrief — practice never reaches "מדורג" (scored). Scoring
  // belongs to assessment and needs a complete three-rater set (CLAUDE.md §4).
  await expect(page.getByText("מדורג").first()).toBeHidden();
  await expect(page.getByText("תחקיר").first()).toBeVisible();
});

test("an incomplete rating is rejected client-side", async ({ page, request }) => {
  const sessionId = await runSession(request);

  await injectTestBearer(page, E2E_INSTRUCTOR, "instructor");
  await page.goto(`/#/aar/${sessionId}`);
  await expect(page.getByRole("heading", { name: "דירוג ANTS" })).toBeVisible();
  // No rater, no evidence, no scores.
  await page.getByRole("button", { name: "שליחת דירוג" }).click();
  await expect(
    page.getByText("יש למלא שם מדרג, לדרג כל ממד ולסמן לו לפחות אירוע עדות אחד"),
  ).toBeVisible();
});
