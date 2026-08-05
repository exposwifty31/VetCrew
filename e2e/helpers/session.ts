import { expect, type APIRequestContext } from "@playwright/test";

import {
  ASSESSMENT_DOMAINS,
  ASSESSMENT_RATERS,
  ASSESSMENT_SLUG,
} from "../../server/test/fixtures/assessment-scenario.js";
import { demoEvents } from "../../server/test/fixtures/demo-events.js";
import { authHeaders } from "./auth.js";

const RESP_DISTRESS = "base-rung-resp-distress";
const STEPPED_TASKS = "base-rung-stepped-tasks";

export const E2E_INSTRUCTOR = "e2e-instructor";
export const E2E_TRAINEE = "e2e-trainee";
export const E2E_MANAGER = "e2e-manager";

export async function createSession(
  request: APIRequestContext,
  input: {
    scenarioSlug: string;
    traineeId: string;
    asUser?: { userId: string; role: "manager" | "instructor" | "trainee" };
  },
): Promise<string> {
  const actor = input.asUser ?? { userId: E2E_INSTRUCTOR, role: "instructor" as const };
  const created = await request.post("/api/sessions", {
    headers: {
      ...authHeaders(actor.userId, actor.role),
      "Content-Type": "application/json",
    },
    data: {
      scenarioSlug: input.scenarioSlug,
      traineeId: input.traineeId,
    },
  });
  expect(created.status()).toBe(201);
  const { session } = (await created.json()) as { session: { id: string } };
  return session.id;
}

export async function appendDemoRun(
  request: APIRequestContext,
  sessionId: string,
  traineeId: string,
  asUser = { userId: E2E_INSTRUCTOR, role: "instructor" as const },
): Promise<void> {
  const appended = await request.post(`/api/sessions/${sessionId}/events`, {
    headers: {
      ...authHeaders(asUser.userId, asUser.role),
      "Content-Type": "application/json",
    },
    data: { events: demoEvents(traineeId) },
  });
  expect(appended.status()).toBe(201);
}

/** Submit one rater's full set of the declared domains. */
export async function scoreSession(
  request: APIRequestContext,
  sessionId: string,
  asUser = { userId: E2E_INSTRUCTOR, role: "instructor" as const },
): Promise<{ complete: boolean }> {
  const rated = await request.post(`/api/sessions/${sessionId}/ratings`, {
    headers: {
      ...authHeaders(asUser.userId, asUser.role),
      "Content-Type": "application/json",
    },
    data: {
      ratings: ASSESSMENT_DOMAINS.map((domain) => ({
        domain,
        score: 4,
        evidenceEventSeqs: [4, 7],
      })),
    },
  });
  expect(rated.status()).toBe(201);
  return (await rated.json()) as { complete: boolean };
}

export async function assignRaters(
  request: APIRequestContext,
  sessionId: string,
  raterUserIds: readonly string[] = ASSESSMENT_RATERS,
): Promise<void> {
  const res = await request.put(`/api/sessions/${sessionId}/raters`, {
    headers: {
      ...authHeaders(E2E_INSTRUCTOR, "instructor"),
      "Content-Type": "application/json",
    },
    data: { raterUserIds },
  });
  expect(res.status()).toBe(200);
}

/**
 * Drive an assessment session all the way to `scored` — roster of three, run to
 * debrief, then every assigned rater covers every declared domain (D2).
 */
export async function createScoredAssessmentSession(
  request: APIRequestContext,
  traineeId: string,
): Promise<string> {
  const sessionId = await createSession(request, {
    scenarioSlug: ASSESSMENT_SLUG,
    traineeId,
  });
  await assignRaters(request, sessionId);
  await appendDemoRun(request, sessionId, traineeId);
  for (const [index, raterId] of ASSESSMENT_RATERS.entries()) {
    const { complete } = await scoreSession(request, sessionId, {
      userId: raterId,
      role: "instructor",
    });
    expect(complete).toBe(index === ASSESSMENT_RATERS.length - 1);
  }
  return sessionId;
}

/** A practice run taken to debrief — never scored, so never on the desk. */
export async function createDebriefedRespDistressSession(
  request: APIRequestContext,
  traineeId: string,
): Promise<string> {
  const sessionId = await createSession(request, {
    scenarioSlug: RESP_DISTRESS,
    traineeId,
  });
  await appendDemoRun(request, sessionId, traineeId);
  return sessionId;
}

export async function startSteppedSessionRunning(
  request: APIRequestContext,
  sessionId: string,
): Promise<void> {
  const res = await request.post(`/api/sessions/${sessionId}/events`, {
    headers: {
      ...authHeaders(E2E_INSTRUCTOR, "instructor"),
      "Content-Type": "application/json",
    },
    data: {
      events: [
        { type: "phase_change", phase: "briefing" },
        { type: "phase_change", phase: "running" },
      ],
    },
  });
  expect(res.status()).toBe(201);
}

export async function createSteppedStationSession(
  request: APIRequestContext,
  traineeId: string,
): Promise<string> {
  const sessionId = await createSession(request, {
    scenarioSlug: STEPPED_TASKS,
    traineeId,
  });
  await startSteppedSessionRunning(request, sessionId);
  return sessionId;
}
