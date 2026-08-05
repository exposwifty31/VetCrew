import { expect, type APIRequestContext } from "@playwright/test";

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

export async function scoreSession(
  request: APIRequestContext,
  sessionId: string,
  asUser = { userId: E2E_INSTRUCTOR, role: "instructor" as const },
): Promise<void> {
  const rated = await request.post(`/api/sessions/${sessionId}/ratings`, {
    headers: {
      ...authHeaders(asUser.userId, asUser.role),
      "Content-Type": "application/json",
    },
    data: {
      ratings: [
        { domain: "task_management", score: 4, evidenceEventSeqs: [4, 7] },
        { domain: "situation_awareness", score: 4, evidenceEventSeqs: [4] },
        { domain: "decision_making", score: 4, evidenceEventSeqs: [7] },
      ],
    },
  });
  expect(rated.status()).toBe(201);
}

export async function createScoredRespDistressSession(
  request: APIRequestContext,
  traineeId: string,
): Promise<string> {
  const sessionId = await createSession(request, {
    scenarioSlug: RESP_DISTRESS,
    traineeId,
  });
  await appendDemoRun(request, sessionId, traineeId);
  await scoreSession(request, sessionId);
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
