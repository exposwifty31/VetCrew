import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { EngineEventBody } from "@vetcrew/shared";
import { eq } from "drizzle-orm";
import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { isAuthEnabled, readAuth, requireSignedIn } from "../auth.js";
import { createDb } from "../db/client.js";
import { roleStations } from "../db/schema/index.js";
import { runMigrations } from "../db/migrate.js";
import { createSessionRouter } from "../routes/sessions.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";
import { demoEvents as buildDemoEvents } from "./fixtures/demo-events.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

const SCENARIO_SLUG = "base-rung-resp-distress";
const ORIGINAL_TEST_AUTH = process.env.VETCREW_TEST_AUTH;
const ORIGINAL_ALLOW_UNREVIEWED = process.env.VETCREW_ALLOW_UNREVIEWED_SCORES;

let pool: ReturnType<typeof createDb>["pool"];
let db: ReturnType<typeof createDb>["db"];
let tenantId: string;
let server: Server;
let baseUrl: string;

function authHeader(userId: string, role: "manager" | "instructor" | "trainee"): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer test:${userId}:${role}`,
  };
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, init);
}

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
  if (ORIGINAL_TEST_AUTH === undefined) {
    delete process.env.VETCREW_TEST_AUTH;
  } else {
    process.env.VETCREW_TEST_AUTH = ORIGINAL_TEST_AUTH;
  }
  if (ORIGINAL_ALLOW_UNREVIEWED === undefined) {
    delete process.env.VETCREW_ALLOW_UNREVIEWED_SCORES;
  } else {
    process.env.VETCREW_ALLOW_UNREVIEWED_SCORES = ORIGINAL_ALLOW_UNREVIEWED;
  }
});

beforeEach(() => {
  process.env.VETCREW_TEST_AUTH = "1";
});

beforeAll(async () => {
  process.env.VETCREW_TEST_AUTH = "1";
  process.env.VETCREW_ALLOW_UNREVIEWED_SCORES = "1";
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(
      `TEST_DATABASE_URL database "${dbName}" does not look like a test database (must contain "test")`,
    );
  }
  ({ pool, db } = createDb(TEST_DATABASE_URL));
  await pool.query("drop schema public cascade");
  await pool.query("create schema public");
  await runMigrations(pool);
  tenantId = await ensurePilotTenant(db);
  await syncScenarios(db, tenantId, loadScenarioFiles());

  const clerkEnabled = false;
  const authEnabled = isAuthEnabled(clerkEnabled);
  const app = express();
  app.use(express.json());
  app.use(
    "/api/sessions",
    requireSignedIn(clerkEnabled, readAuth),
    createSessionRouter(db, tenantId, { authEnabled, readAuth }),
  );
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

describe("session create binds role_stations", () => {
  test("trainee cannot create a session for another traineeId", async () => {
    const res = await api("/api/sessions", {
      method: "POST",
      headers: authHeader("trainee-a", "trainee"),
      body: JSON.stringify({
        scenarioSlug: SCENARIO_SLUG,
        traineeId: "trainee-b",
        traineeTimeInTrainingDays: 10,
      }),
    });
    expect(res.status).toBe(403);
  });

  test("trainee binds technician station to self", async () => {
    const res = await api("/api/sessions", {
      method: "POST",
      headers: authHeader("trainee-self", "trainee"),
      body: JSON.stringify({
        scenarioSlug: SCENARIO_SLUG,
        traineeTimeInTrainingDays: 10,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { session: { id: string; traineeId: string } };
    expect(body.session.traineeId).toBe("trainee-self");

    const stations = await db
      .select()
      .from(roleStations)
      .where(eq(roleStations.sessionId, body.session.id));
    const technician = stations.find((s) => s.role === "technician");
    expect(technician?.assignedUserId).toBe("trainee-self");
  });

  test("instructor can create for any trainee and binds stations", async () => {
    const res = await api("/api/sessions", {
      method: "POST",
      headers: authHeader("inst-1", "instructor"),
      body: JSON.stringify({
        scenarioSlug: SCENARIO_SLUG,
        traineeId: "named-trainee",
        traineeTimeInTrainingDays: 20,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { session: { id: string; traineeId: string } };
    expect(body.session.traineeId).toBe("named-trainee");

    const stations = await db
      .select()
      .from(roleStations)
      .where(eq(roleStations.sessionId, body.session.id));
    const technician = stations.find((s) => s.role === "technician");
    expect(technician?.assignedUserId).toBe("named-trainee");
  });
});

describe("session REST ownership", () => {
  async function createAsInstructor(traineeId: string): Promise<string> {
    const res = await api("/api/sessions", {
      method: "POST",
      headers: authHeader("inst-owner", "instructor"),
      body: JSON.stringify({
        scenarioSlug: SCENARIO_SLUG,
        traineeId,
        traineeTimeInTrainingDays: 30,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { session: { id: string } };
    return body.session.id;
  }

  test("unassigned trainee gets 403 on AAR", async () => {
    const sessionId = await createAsInstructor("bound-trainee");
    const res = await api(`/api/sessions/${sessionId}/aar`, {
      headers: authHeader("other-trainee", "trainee"),
    });
    expect(res.status).toBe(403);
  });

  test("assigned trainee can read AAR and append events", async () => {
    const traineeId = "aar-trainee";
    const sessionId = await createAsInstructor(traineeId);
    const aar = await api(`/api/sessions/${sessionId}/aar`, {
      headers: authHeader(traineeId, "trainee"),
    });
    expect(aar.status).toBe(200);

    const events: EngineEventBody[] = buildDemoEvents(traineeId).slice(0, 1);
    const append = await api(`/api/sessions/${sessionId}/events`, {
      method: "POST",
      headers: authHeader(traineeId, "trainee"),
      body: JSON.stringify({ events }),
    });
    expect(append.status).toBe(201);
  });

  test("manager can access any session AAR", async () => {
    const sessionId = await createAsInstructor("mgr-target");
    const res = await api(`/api/sessions/${sessionId}/aar`, {
      headers: authHeader("mgr-1", "manager"),
    });
    expect(res.status).toBe(200);
  });
});

describe("ratings stamp raterId from auth", () => {
  test("ignores client raterId when auth is enabled", async () => {
    const traineeId = "rated-trainee";
    const createRes = await api("/api/sessions", {
      method: "POST",
      headers: authHeader("inst-rater", "instructor"),
      body: JSON.stringify({
        scenarioSlug: SCENARIO_SLUG,
        traineeId,
        traineeTimeInTrainingDays: 45,
      }),
    });
    expect(createRes.status).toBe(201);
    const { session } = (await createRes.json()) as { session: { id: string } };

    const appendRes = await api(`/api/sessions/${session.id}/events`, {
      method: "POST",
      headers: authHeader("inst-rater", "instructor"),
      body: JSON.stringify({ events: buildDemoEvents(traineeId) }),
    });
    expect(appendRes.status).toBe(201);

    const rateRes = await api(`/api/sessions/${session.id}/ratings`, {
      method: "POST",
      headers: authHeader("inst-rater", "instructor"),
      body: JSON.stringify({
        raterId: "client-should-be-ignored",
        ratings: [{ domain: "task_management", score: 4, evidenceEventSeqs: [4] }],
      }),
    });
    expect(rateRes.status).toBe(201);

    const aarRes = await api(`/api/sessions/${session.id}/aar`, {
      headers: authHeader("inst-rater", "instructor"),
    });
    const aar = (await aarRes.json()) as { ratings: { raterId: string }[] };
    expect(aar.ratings.every((r) => r.raterId === "inst-rater")).toBe(true);
  });
});
