import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import { evaluateChecklist, evaluateTasks, type EngineEvent } from "@vetcrew/engine";
import type { EngineEventBody } from "@vetcrew/shared";
import express from "express";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { createManagerRouter } from "../routes/manager.js";
import { createSessionRouter } from "../routes/sessions.js";
import { compileScenario, loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";
import { demoEvents as buildDemoEvents } from "./fixtures/demo-events.js";

/**
 * Phase 4 + Sprint 3 integration suite (DB-backed, serial):
 *  - event-log persistence + replay round-trip (AAR is byte-stable)
 *  - append-only + server-seq authority
 *  - tenant isolation
 *  - score -> source-event traceability (evidence validation, scoring gates)
 *  - migration 0002/0003/0004 constraints hold at the database level
 */

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

const SCENARIO_SLUG = "base-rung-resp-distress";

let pool: ReturnType<typeof createDb>["pool"];
let db: ReturnType<typeof createDb>["db"];
let tenantId: string;
let server: Server;
let baseUrl: string;

/** Same shape as the seed-demo run: deliberate priority inversion included. */
function demoEvents(): EngineEventBody[] {
  return buildDemoEvents("it-trainee");
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
}

interface CreatedSession {
  id: string;
}

async function createSession(body: Record<string, unknown>): Promise<CreatedSession> {
  const res = await api("/api/sessions", { method: "POST", body: JSON.stringify(body) });
  expect(res.status).toBe(201);
  const json = (await res.json()) as { session: CreatedSession };
  return json.session;
}

async function appendEvents(sessionId: string, events: EngineEventBody[]): Promise<EngineEvent[]> {
  const res = await api(`/api/sessions/${sessionId}/events`, {
    method: "POST",
    body: JSON.stringify({ events }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { events: EngineEvent[] };
  return body.events;
}

beforeAll(async () => {
  // This suite DROPS THE SCHEMA of whatever TEST_DATABASE_URL points at.
  // Refuse to run against anything whose database name doesn't say "test",
  // so a copy-pasted DATABASE_URL can never nuke a real database.
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(
      `TEST_DATABASE_URL database "${dbName}" does not look like a test database (must contain "test")`,
    );
  }
  ({ pool, db } = createDb(TEST_DATABASE_URL));
  // Fresh schema per run: constraints and triggers are part of what we test.
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

describe("event-log persistence + replay round-trip", () => {
  test("a persisted run replays into a byte-stable AAR with the expected checklist", async () => {
    const session = await createSession({
      scenarioSlug: SCENARIO_SLUG,
      seed: 424242,
      traineeId: "it-trainee",
      traineeTimeInTrainingDays: 90,
    });
    const events = await appendEvents(session.id, demoEvents());
    expect(events[0]?.seq).toBe(1);
    expect(events.every((e, i) => e.seq === i + 1)).toBe(true);

    const first = await api(`/api/sessions/${session.id}/aar`);
    expect(first.status).toBe(200);
    const firstText = await first.text();
    const second = await api(`/api/sessions/${session.id}/aar`);
    const secondText = await second.text();
    // Replay determinism across independent requests (same log, same seed).
    expect(secondText).toBe(firstText);

    const body = JSON.parse(firstText) as {
      session: { phase: string; seed: number };
      checklist: ReturnType<typeof evaluateChecklist>;
      tasks: ReturnType<typeof evaluateTasks>;
      aar: { durationMs: number; timeline: { seq: number }[] };
    };
    expect(body.session.seed).toBe(424242);
    expect(body.aar.durationMs).toBe(120_000);

    // Traceability: the server's checklist equals a local evaluation of the
    // same (server-stamped) event log against the same authored checklist.
    const authored = loadScenarioFiles().find((s) => s.slug === SCENARIO_SLUG);
    if (authored === undefined) throw new Error("scenario file missing");
    const local = evaluateChecklist(events, authored.checklist);
    expect(body.checklist).toEqual(local);

    // Task expected-vs-actual is on the AAR wire (Sprint 5a / SRS §7).
    const localTasks = evaluateTasks(424242, events, compileScenario(authored));
    expect(body.tasks).toEqual(localTasks);
    expect(body.tasks.results.length).toBeGreaterThanOrEqual(0);

    // The deliberate priority inversion fails with evidence attached.
    const inversion = body.checklist.items.find((i) => i.id === "airway-before-iv");
    expect(inversion?.passed).toBe(false);
    expect(inversion?.evidenceSeqs.length).toBeGreaterThan(0);
  });

  test("the event log is append-only at the database level", async () => {
    await expect(pool.query("update vc_session_events set type = 'tampered' where id = (select id from vc_session_events limit 1)")).rejects.toThrow(/append-only/);
    await expect(pool.query("delete from vc_session_events where id = (select id from vc_session_events limit 1)")).rejects.toThrow(/append-only/);
  });

  test("a gapped seq cannot rewrite the log (DB trigger backstop)", async () => {
    const session = await createSession({ scenarioSlug: SCENARIO_SLUG, traineeTimeInTrainingDays: 10 });
    await appendEvents(session.id, demoEvents());

    // Clients no longer supply seq; the DB trigger still rejects a direct
    // low/gapped insert that would rewrite replay history (migration 0004).
    await expect(
      pool.query(
        `insert into vc_session_events (tenant_id, session_id, seq, type, payload)
         values ($1, $2, 3, 'tick', '{"seq":3,"type":"tick","dtMs":1000}')`,
        [tenantId, session.id],
      ),
    ).rejects.toThrow(/not contiguous/);
    await expect(
      pool.query(
        `insert into vc_session_events (tenant_id, session_id, seq, type, payload)
         values ($1, $2, 999, 'tick', '{"seq":999,"type":"tick","dtMs":1000}')`,
        [tenantId, session.id],
      ),
    ).rejects.toThrow(/not contiguous/);
  });

  test("an illegal phase jump stays in the log but the projection refuses it", async () => {
    const session = await createSession({ scenarioSlug: SCENARIO_SLUG });
    // draft -> scored is not a legal transition; the event is recorded, the
    // session's projected phase must remain draft (FSM, CLAUDE.md §4).
    await appendEvents(session.id, [{ type: "phase_change", phase: "scored" }]);
    const list = await api("/api/sessions");
    const listing = (await list.json()) as { sessions: { id: string; phase: string }[] };
    expect(listing.sessions.find((s) => s.id === session.id)?.phase).toBe("draft");
  });
});

describe("tenant isolation", () => {
  test("another tenant's session is invisible through the pilot-scoped API", async () => {
    const otherTenant = await pool.query<{ id: string }>(
      "insert into vc_tenants (slug, name) values ('other', 'Other Hospital') returning id",
    );
    const otherTenantId = otherTenant.rows[0]?.id;
    if (otherTenantId === undefined) throw new Error("failed to create tenant");
    const otherScenario = await pool.query<{ id: string }>(
      `insert into vc_scenarios (tenant_id, slug, version, clinically_reviewed, definition)
       values ($1, 'other-scenario', '0.0.1', false, '{}') returning id`,
      [otherTenantId],
    );
    const otherScenarioId = otherScenario.rows[0]?.id;
    const otherSession = await pool.query<{ id: string }>(
      `insert into vc_sim_sessions (tenant_id, scenario_id, scenario_version, seed)
       values ($1, $2, '0.0.1', 7) returning id`,
      [otherTenantId, otherScenarioId],
    );
    const otherSessionId = otherSession.rows[0]?.id;
    if (otherSessionId === undefined) throw new Error("failed to create session");

    const list = await api("/api/sessions");
    const listing = (await list.json()) as { sessions: { id: string }[] };
    expect(listing.sessions.map((s) => s.id)).not.toContain(otherSessionId);

    const aar = await api(`/api/sessions/${otherSessionId}/aar`);
    expect(aar.status).toBe(404);
  });

  test("a child row cannot reference a parent from another tenant", async () => {
    const pilotScenario = await pool.query<{ id: string }>(
      "select id from vc_scenarios where tenant_id = $1 limit 1",
      [tenantId],
    );
    // Upsert so this test does not depend on the previous test having run.
    const otherTenantId = (
      await pool.query<{ id: string }>(
        `insert into vc_tenants (slug, name) values ('other', 'Other Hospital')
         on conflict (slug) do update set name = excluded.name returning id`,
      )
    ).rows[0]?.id;
    // Session under the OTHER tenant pointing at the PILOT tenant's scenario.
    await expect(
      pool.query(
        `insert into vc_sim_sessions (tenant_id, scenario_id, scenario_version, seed)
         values ($1, $2, '0.1.0', 7)`,
        [otherTenantId, pilotScenario.rows[0]?.id],
      ),
    ).rejects.toThrow(/vc_sim_sessions_scenario_same_tenant/);
  });
});

describe("score -> source-event traceability", () => {
  test("a rating citing events that do not exist in the session is rejected", async () => {
    const session = await createSession({
      scenarioSlug: SCENARIO_SLUG,
      traineeTimeInTrainingDays: 30,
    });
    await appendEvents(session.id, demoEvents());
    const res = await api(`/api/sessions/${session.id}/ratings`, {
      method: "POST",
      body: JSON.stringify({
        raterId: "it-rater",
        ratings: [
          { domain: "task_management", score: 3, evidenceEventSeqs: [999] },
        ],
      }),
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("999");
  });

  test("a session without time-in-training cannot be scored", async () => {
    const session = await createSession({ scenarioSlug: SCENARIO_SLUG });
    await appendEvents(session.id, demoEvents());
    const res = await api(`/api/sessions/${session.id}/ratings`, {
      method: "POST",
      body: JSON.stringify({
        raterId: "it-rater",
        ratings: [{ domain: "task_management", score: 3, evidenceEventSeqs: [4] }],
      }),
    });
    expect(res.status).toBe(422);
  });

  test("a session that is not in debrief cannot be rated", async () => {
    const session = await createSession({
      scenarioSlug: SCENARIO_SLUG,
      traineeTimeInTrainingDays: 60,
    });
    // Only briefing+running appended — the session never reached debrief.
    const stamped = await appendEvents(session.id, demoEvents().slice(0, 2));
    const res = await api(`/api/sessions/${session.id}/ratings`, {
      method: "POST",
      body: JSON.stringify({
        raterId: "it-rater",
        ratings: [{ domain: "task_management", score: 3, evidenceEventSeqs: [stamped[0]!.seq] }],
      }),
    });
    expect(res.status).toBe(409);
  });

  test("a valid evidence-linked rating is stored and the session becomes scored", async () => {
    const session = await createSession({
      scenarioSlug: SCENARIO_SLUG,
      traineeTimeInTrainingDays: 365,
    });
    await appendEvents(session.id, demoEvents());
    const res = await api(`/api/sessions/${session.id}/ratings`, {
      method: "POST",
      body: JSON.stringify({
        raterId: "it-rater",
        ratings: [
          { domain: "task_management", score: 4, evidenceEventSeqs: [4, 7] },
          { domain: "situation_awareness", score: 3, evidenceEventSeqs: [4] },
          { domain: "decision_making", score: 2, evidenceEventSeqs: [7] },
        ],
      }),
    });
    expect(res.status).toBe(201);

    const aar = await api(`/api/sessions/${session.id}/aar`);
    const body = (await aar.json()) as {
      session: { phase: string };
      aar: { finalPhase: string };
      ratings: { domain: string; score: number; evidenceEventSeqs: number[] }[];
    };
    expect(body.session.phase).toBe("scored");
    // The scored transition went THROUGH the log: replay agrees with the
    // projection column (audit F-b — no derived state without a source event).
    expect(body.aar.finalPhase).toBe("scored");
    expect(body.ratings).toHaveLength(3);
    const tm = body.ratings.find((r) => r.domain === "task_management");
    expect(tm?.evidenceEventSeqs).toEqual([4, 7]);
  });
});

describe("integrity constraints (migrations 0002/0003)", () => {
  test("clinically_reviewed=true without a reviewer is rejected", async () => {
    await expect(
      pool.query(
        `insert into vc_scenarios (tenant_id, slug, version, clinically_reviewed, clinical_reviewer, definition)
         values ($1, 'bad-reviewed', '0.0.1', true, null, '{}')`,
        [tenantId],
      ),
    ).rejects.toThrow(/vc_scenarios_reviewer_required/);
  });

  test("a seed outside the u32 range is rejected", async () => {
    const scenarioId = (
      await pool.query<{ id: string }>(
        "select id from vc_scenarios where tenant_id = $1 limit 1",
        [tenantId],
      )
    ).rows[0]?.id;
    await expect(
      pool.query(
        `insert into vc_sim_sessions (tenant_id, scenario_id, scenario_version, seed)
         values ($1, $2, '0.1.0', 4294967296)`,
        [tenantId, scenarioId],
      ),
    ).rejects.toThrow(/vc_sim_sessions_seed_u32/);
  });

  test("a session cannot enter the scored phase without time-in-training", async () => {
    const session = await createSession({ scenarioSlug: SCENARIO_SLUG });
    await expect(
      pool.query("update vc_sim_sessions set phase = 'scored' where id = $1", [session.id]),
    ).rejects.toThrow(/vc_sim_sessions_scored_needs_time_in_training/);
  });
});
