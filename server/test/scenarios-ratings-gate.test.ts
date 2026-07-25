import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { EngineEventBody } from "@vetcrew/shared";
import express from "express";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { createSessionRouter } from "../routes/sessions.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";
import { demoEvents as buildDemoEvents } from "./fixtures/demo-events.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

const SCENARIO_SLUG = "base-rung-resp-distress";
const ORIGINAL_ALLOW_UNREVIEWED = process.env.VETCREW_ALLOW_UNREVIEWED_SCORES;

let pool: ReturnType<typeof createDb>["pool"];
let db: ReturnType<typeof createDb>["db"];
let tenantId: string;
let server: Server;
let baseUrl: string;

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

async function createAndRateSession(): Promise<{ sessionId: string; rateRes: Response }> {
  const createRes = await api("/api/sessions", {
    method: "POST",
    body: JSON.stringify({
      scenarioSlug: SCENARIO_SLUG,
      traineeId: "gate-trainee",
      traineeTimeInTrainingDays: 90,
    }),
  });
  expect(createRes.status).toBe(201);
  const { session } = (await createRes.json()) as { session: { id: string } };

  const appendRes = await api(`/api/sessions/${session.id}/events`, {
    method: "POST",
    body: JSON.stringify({ events: buildDemoEvents("gate-trainee") as EngineEventBody[] }),
  });
  expect(appendRes.status).toBe(201);

  const rateRes = await api(`/api/sessions/${session.id}/ratings`, {
    method: "POST",
    body: JSON.stringify({
      raterId: "gate-rater",
      ratings: [{ domain: "task_management", score: 4, evidenceEventSeqs: [4] }],
    }),
  });
  return { sessionId: session.id, rateRes };
}

beforeAll(async () => {
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

  const app = express();
  app.use(express.json());
  app.use("/api/sessions", createSessionRouter(db, tenantId));
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => {
  if (ORIGINAL_ALLOW_UNREVIEWED === undefined) {
    delete process.env.VETCREW_ALLOW_UNREVIEWED_SCORES;
  } else {
    process.env.VETCREW_ALLOW_UNREVIEWED_SCORES = ORIGINAL_ALLOW_UNREVIEWED;
  }
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

describe("unreviewed scenario ratings gate", () => {
  test("session create stays allowed for unreviewed scenarios", async () => {
    delete process.env.VETCREW_ALLOW_UNREVIEWED_SCORES;
    const res = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ scenarioSlug: SCENARIO_SLUG, traineeTimeInTrainingDays: 10 }),
    });
    expect(res.status).toBe(201);
  });

  test("ratings on unreviewed scenario return 403 when allow flag is unset", async () => {
    delete process.env.VETCREW_ALLOW_UNREVIEWED_SCORES;
    const { rateRes } = await createAndRateSession();
    expect(rateRes.status).toBe(403);
    const body = (await rateRes.json()) as { error: string };
    expect(body.error).toBe("scenario_not_clinically_reviewed");
  });

  test("ratings on unreviewed scenario succeed when VETCREW_ALLOW_UNREVIEWED_SCORES=1", async () => {
    process.env.VETCREW_ALLOW_UNREVIEWED_SCORES = "1";
    const { rateRes } = await createAndRateSession();
    expect(rateRes.status).toBe(201);
  });
});
