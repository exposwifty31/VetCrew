import { expect, test } from "@playwright/test";

import { authHeaders } from "./helpers/auth.js";
import { injectTestBearer } from "./helpers/inject-token.js";
import { expectLiveConnectionPill, expectNotLiveConnectionPill } from "./helpers/live-ui.js";
import { E2E_INSTRUCTOR, E2E_TRAINEE, E2E_MANAGER, createSession } from "./helpers/session.js";

test.describe("API authz", () => {
  test("manager evidence rejects trainee bearer and accepts manager bearer", async ({ request }) => {
    await createSession(request, {
      scenarioSlug: "base-rung-resp-distress",
      traineeId: E2E_TRAINEE,
    });

    const traineeEvidence = await request.get(`/api/trainees/${E2E_TRAINEE}/evidence`, {
      headers: authHeaders(E2E_TRAINEE, "trainee"),
    });
    expect(traineeEvidence.status()).toBe(403);

    const managerEvidence = await request.get(`/api/trainees/${E2E_TRAINEE}/evidence`, {
      headers: authHeaders(E2E_MANAGER, "manager"),
    });
    expect(managerEvidence.status()).toBe(200);

    const traineeTrend = await request.get(`/api/trainees/${E2E_TRAINEE}/trend`, {
      headers: authHeaders(E2E_TRAINEE, "trainee"),
    });
    expect(traineeTrend.status()).toBe(403);

    const managerTrend = await request.get(`/api/trainees/${E2E_TRAINEE}/trend`, {
      headers: authHeaders(E2E_MANAGER, "manager"),
    });
    expect(managerTrend.status()).toBe(200);
  });

  test("session create binds instructor and trainee role stations", async ({ request }) => {
    const created = await request.post("/api/sessions", {
      headers: {
        ...authHeaders(E2E_INSTRUCTOR, "instructor"),
        "Content-Type": "application/json",
      },
      data: {
        scenarioSlug: "base-rung-stepped-tasks",
        traineeId: E2E_TRAINEE,
        traineeTimeInTrainingDays: 60,
      },
    });
    expect(created.status()).toBe(201);
    const { session } = (await created.json()) as { session: { id: string; traineeId: string } };
    expect(session.traineeId).toBe(E2E_TRAINEE);

    const unauthList = await request.get("/api/sessions");
    expect(unauthList.status()).toBe(401);
  });
});

test("socket join without bearer is rejected when test auth is on", async ({ page, request }) => {
  const sessionId = await createSession(request, {
    scenarioSlug: "base-rung-stepped-tasks",
    traineeId: E2E_TRAINEE,
  });

  await page.goto(`/#/station/${sessionId}`);
  await expectNotLiveConnectionPill(page);
  await expect(page.locator("header").getByText(/מתחבר|לא מחובר/)).toBeVisible({
    timeout: 15_000,
  });
});

test("bound trainee connects with injected test bearer", async ({ page, request }) => {
  const sessionId = await createSession(request, {
    scenarioSlug: "base-rung-stepped-tasks",
    traineeId: E2E_TRAINEE,
  });

  await injectTestBearer(page, E2E_TRAINEE, "trainee");
  await page.goto(`/#/station/${sessionId}`);
  await expectLiveConnectionPill(page).toBeVisible({ timeout: 15_000 });
});
