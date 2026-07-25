import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import type { EngineEventBody } from "@vetcrew/shared";
import express from "express";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { createManagerRouter } from "../routes/manager.js";
import { createSessionRouter } from "../routes/sessions.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";
import { demoEvents as buildDemoEvents } from "./fixtures/demo-events.js";

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

const SCENARIO_SLUG = "base-rung-resp-distress";
const TRAINEE = "manager-evidence-trainee";

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

async function createSession(body: Record<string, unknown>): Promise<{ id: string }> {
  const res = await api("/api/sessions", { method: "POST", body: JSON.stringify(body) });
  expect(res.status).toBe(201);
  const json = (await res.json()) as { session: { id: string } };
  return json.session;
}

async function appendEvents(sessionId: string, events: EngineEventBody[]): Promise<void> {
  const res = await api(`/api/sessions/${sessionId}/events`, {
    method: "POST",
    body: JSON.stringify({ events }),
  });
  expect(res.status).toBe(201);
}

async function scoreSession(sessionId: string, score: number): Promise<void> {
  const res = await api(`/api/sessions/${sessionId}/ratings`, {
    method: "POST",
    body: JSON.stringify({
      raterId: "manager-test-rater",
      ratings: [
        { domain: "task_management", score, evidenceEventSeqs: [4, 7] },
        { domain: "situation_awareness", score, evidenceEventSeqs: [4] },
        { domain: "decision_making", score, evidenceEventSeqs: [7] },
        { domain: "team_working", score, evidenceEventSeqs: [4] },
      ],
    }),
  });
  expect(res.status).toBe(201);
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
  app.use("/api", createManagerRouter(db, tenantId));
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => (err ? reject(err) : resolve()));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
  await pool.end();
});

describe("manager evidence + trend", () => {
  test("lists scored sessions for a trainee and withholds cohort bands", async () => {
    const early = await createSession({
      scenarioSlug: SCENARIO_SLUG,
      traineeId: TRAINEE,
      traineeTimeInTrainingDays: 30,
      seed: 111,
    });
    await appendEvents(early.id, buildDemoEvents(TRAINEE));
    await scoreSession(early.id, 3);

    const later = await createSession({
      scenarioSlug: SCENARIO_SLUG,
      traineeId: TRAINEE,
      traineeTimeInTrainingDays: 90,
      seed: 222,
    });
    await appendEvents(later.id, buildDemoEvents(TRAINEE));
    await scoreSession(later.id, 4);

    // Non-scored session must not appear.
    await createSession({
      scenarioSlug: SCENARIO_SLUG,
      traineeId: TRAINEE,
      traineeTimeInTrainingDays: 10,
    });

    const evidenceRes = await api(`/api/trainees/${TRAINEE}/evidence`);
    expect(evidenceRes.status).toBe(200);
    const evidence = (await evidenceRes.json()) as {
      bandStatus: string;
      sessions: {
        sessionId: string;
        technicalPercent: number;
        overallAnts: number | null;
        traineeTimeInTrainingDays: number;
        clinicallyReviewed: boolean;
      }[];
    };
    expect(evidence.bandStatus).toBe("cohort_insufficient");
    expect(evidence.sessions).toHaveLength(2);
    expect(evidence.sessions.every((s) => s.overallAnts !== null)).toBe(true);
    expect(evidence.sessions.some((s) => s.clinicallyReviewed === false)).toBe(true);

    const trendRes = await api(`/api/trainees/${TRAINEE}/trend`);
    expect(trendRes.status).toBe(200);
    const trend = (await trendRes.json()) as {
      bandStatus: string;
      overallDrift: string;
      series: { sessionId: string; timeInTrainingDays: number }[];
    };
    expect(trend.bandStatus).toBe("cohort_insufficient");
    expect(trend.series.map((p) => p.timeInTrainingDays)).toEqual([30, 90]);
    expect(trend.overallDrift).toMatch(/none|up|down/);
  });

  test("does not leak another tenant's trainee rows", async () => {
    const otherTenant = await pool.query<{ id: string }>(
      `insert into vc_tenants (slug, name) values ('mgr-other', 'Other')
       on conflict (slug) do update set name = excluded.name returning id`,
    );
    const otherTenantId = otherTenant.rows[0]?.id;
    if (otherTenantId === undefined) throw new Error("other tenant missing");
    const scenario = await pool.query<{ id: string }>(
      `insert into vc_scenarios (tenant_id, slug, version, clinically_reviewed, definition)
       values ($1, 'mgr-other-scenario', '0.0.1', false, '{}') returning id`,
      [otherTenantId],
    );
    await pool.query(
      `insert into vc_sim_sessions
         (tenant_id, scenario_id, scenario_version, seed, phase, trainee_id, trainee_time_in_training_days)
       values ($1, $2, '0.0.1', 9, 'scored', $3, 40)`,
      [otherTenantId, scenario.rows[0]?.id, TRAINEE],
    );

    const evidenceRes = await api(`/api/trainees/${TRAINEE}/evidence`);
    const evidence = (await evidenceRes.json()) as { sessions: { scenarioSlug: string }[] };
    expect(evidence.sessions.every((s) => s.scenarioSlug !== "mgr-other-scenario")).toBe(true);
  });
});
