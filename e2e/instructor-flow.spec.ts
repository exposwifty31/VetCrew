import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Phase 4 E2E: the MVP flow end to end — a session is run (via API, the
 * trainee station is Sprint 3), its AAR opens in the browser, an instructor
 * submits an evidence-linked ANTS rating, and the stored rating renders.
 * Both surfaces are scanned with axe (WCAG 2.1 A/AA rule set).
 */

const SCENARIO_SLUG = "base-rung-resp-distress";

interface DemoEvent {
  seq: number;
  type: string;
  [key: string]: unknown;
}

function demoEvents(): DemoEvent[] {
  const events: DemoEvent[] = [];
  let seq = 0;
  let timeMs = 0;
  const tick = (upToMs: number) => {
    while (timeMs < upToMs) {
      events.push({ seq: ++seq, type: "tick", dtMs: 5000 });
      timeMs += 5000;
    }
  };
  const act = (action: string) => {
    events.push({ seq: ++seq, type: "action", role: "technician", actorId: "e2e-trainee", action });
  };
  events.push({ seq: ++seq, type: "phase_change", phase: "briefing" });
  events.push({ seq: ++seq, type: "phase_change", phase: "running" });
  tick(10_000);
  act("vitals_callout");
  tick(25_000);
  act("oxygen_on");
  tick(45_000);
  act("iv_access_attempt");
  tick(55_000);
  act("airway_pulses_check");
  tick(90_000);
  act("give_drug_sc");
  tick(120_000);
  events.push({ seq: ++seq, type: "phase_change", phase: "debrief" });
  return events;
}

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
    data: { events: demoEvents() },
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

  // Evidence-linked rating: select two action events as evidence, score all
  // three ANTS dimensions, submit.
  const evidence = page.getByRole("checkbox");
  await evidence.nth(0).check();
  await evidence.nth(1).check();
  const fours = page.getByRole("button", { name: "4", exact: true });
  const domainCount = await fours.count();
  expect(domainCount).toBe(3);
  for (let i = 0; i < domainCount; i++) {
    await fours.nth(i).click();
  }
  await page.getByRole("button", { name: "שליחת דירוג" }).click();

  // The stored ratings render back from the server, evidence seqs included.
  await expect(page.getByRole("heading", { name: "דירוגים שנשמרו" })).toBeVisible();
  await expect(page.getByText("מדורג").first()).toBeVisible();
});

test("an incomplete rating is rejected client-side", async ({ page, request }) => {
  const sessionId = await runSession(request);
  await page.goto(`/#/aar/${sessionId}`);
  await expect(page.getByRole("heading", { name: "דירוג ANTS" })).toBeVisible();
  // No evidence selected, no scores set.
  await page.getByRole("button", { name: "שליחת דירוג" }).click();
  await expect(
    page.getByText("יש לדרג את כל הממדים ולסמן לפחות אירוע אחד כעדות"),
  ).toBeVisible();
});
