import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { demoEvents } from "../server/test/fixtures/demo-events.js";

/**
 * Phase 4 E2E: the MVP flow end to end — a session is run (via API, the
 * trainee station is Sprint 3), its AAR opens in the browser, an instructor
 * submits an evidence-linked ANTS rating, and the stored rating renders.
 * Both surfaces are scanned with axe (WCAG 2.1 A/AA rule set).
 */

const SCENARIO_SLUG = "base-rung-resp-distress";

async function runSession(request: APIRequestContext): Promise<string> {
  const created = await request.post("/api/sessions", {
    data: {
      scenarioSlug: SCENARIO_SLUG,
      traineeId: "e2e-trainee",
      traineeTimeInTrainingDays: 120,
    },
  });
  expect(created.status()).toBe(201);
  const { session } = (await created.json()) as { session: { id: string } };
  const appended = await request.post(`/api/sessions/${session.id}/events`, {
    data: { events: demoEvents("e2e-trainee") },
  });
  expect(appended.status()).toBe(201);
  return session.id;
}

async function expectNoSeriousA11yViolations(page: Page, surface: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(
    serious,
    `${surface}: ${serious.map((v) => `${v.id} (${v.impact}): ${v.help}`).join("; ")}`,
  ).toEqual([]);
}

test("home page lists sessions and passes the a11y scan", async ({ page, request }) => {
  await runSession(request);
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
  const domainButtons = page.locator("button[aria-pressed]");
  const fours = page.getByRole("button", { name: "4", exact: true });
  const domainCount = await domainButtons.count();
  expect(domainCount).toBe(3);
  for (let i = 0; i < domainCount; i++) {
    await domainButtons.nth(i).click();
    await page.getByRole("checkbox").nth(i).check();
    await fours.nth(i).click();
  }
  await page.getByRole("button", { name: "שליחת דירוג" }).click();

  // The stored ratings render back from the server, rater + evidence included.
  await expect(page.getByRole("heading", { name: "דירוגים שנשמרו" })).toBeVisible();
  await expect(page.getByText("מדריכת-בדיקה").first()).toBeVisible();
  await expect(page.getByText("מדורג").first()).toBeVisible();
});

test("an incomplete rating is rejected client-side", async ({ page, request }) => {
  const sessionId = await runSession(request);
  await page.goto(`/#/aar/${sessionId}`);
  await expect(page.getByRole("heading", { name: "דירוג ANTS" })).toBeVisible();
  // No rater, no evidence, no scores.
  await page.getByRole("button", { name: "שליחת דירוג" }).click();
  await expect(
    page.getByText("יש למלא שם מדרג, לדרג כל ממד ולסמן לו לפחות אירוע עדות אחד"),
  ).toBeVisible();
});
