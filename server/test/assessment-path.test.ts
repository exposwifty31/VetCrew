import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { isAuthEnabled, readAuth, requireSignedIn } from "../auth.js";
import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { createManagerRouter } from "../routes/manager.js";
import { createSessionRouter } from "../routes/sessions.js";
import { loadScenarioFiles, syncScenarios } from "../scenarios.js";
import { ensurePilotTenant } from "../tenancy.js";
import {
  ASSESSMENT_DOMAINS,
  ASSESSMENT_RATERS,
  ASSESSMENT_SLUG,
  seedAssessmentScenario,
} from "./fixtures/assessment-scenario.js";
import { demoEvents as buildDemoEvents } from "./fixtures/demo-events.js";

/**
 * The assessment path's own rules (design-alignment §2.1–§3.5): mode as
 * withheld capability, the rater roster, the D2 completion rule, and the
 * evidence-desk boundary. Auth is ON throughout — every rule here is about who
 * may do what.
 */

const TEST_DATABASE_URL =
  process.env["TEST_DATABASE_URL"] ?? "postgres://localhost:5432/vetcrew_test";

const PRACTICE_SLUG = "base-rung-resp-distress";
const ORIGINAL_TEST_AUTH = process.env.VETCREW_TEST_AUTH;
const ORIGINAL_ALLOW_UNREVIEWED = process.env.VETCREW_ALLOW_UNREVIEWED_SCORES;

let pool: ReturnType<typeof createDb>["pool"];
let db: ReturnType<typeof createDb>["db"];
let tenantId: string;
let server: Server;
let baseUrl: string;

type Role = "manager" | "instructor" | "trainee";

function authHeader(userId: string, role: Role): Record<string, string> {
  return { "content-type": "application/json", authorization: `Bearer test:${userId}:${role}` };
}

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${baseUrl}${path}`, init);
}

const INSTRUCTOR = authHeader("assess-instructor", "instructor");
const MANAGER = authHeader("assess-manager", "manager");

async function createSession(slug: string, traineeId: string): Promise<string> {
  const res = await api("/api/sessions", {
    method: "POST",
    headers: INSTRUCTOR,
    body: JSON.stringify({ scenarioSlug: slug, traineeId }),
  });
  expect(res.status).toBe(201);
  const { session } = (await res.json()) as { session: { id: string } };
  return session.id;
}

async function assignRaters(sessionId: string, raters: readonly string[]): Promise<Response> {
  return api(`/api/sessions/${sessionId}/raters`, {
    method: "PUT",
    headers: INSTRUCTOR,
    body: JSON.stringify({ raterUserIds: raters }),
  });
}

async function runToDebrief(sessionId: string, traineeId: string): Promise<void> {
  const res = await api(`/api/sessions/${sessionId}/events`, {
    method: "POST",
    headers: INSTRUCTOR,
    body: JSON.stringify({ events: buildDemoEvents(traineeId) }),
  });
  expect(res.status).toBe(201);
}

async function rate(sessionId: string, raterId: string, score = 4): Promise<Response> {
  return api(`/api/sessions/${sessionId}/ratings`, {
    method: "POST",
    headers: authHeader(raterId, "trainee"),
    body: JSON.stringify({
      ratings: ASSESSMENT_DOMAINS.map((domain) => ({
        domain,
        score,
        evidenceEventSeqs: [4, 7],
      })),
    }),
  });
}

beforeEach(() => {
  process.env.VETCREW_TEST_AUTH = "1";
});

beforeAll(async () => {
  process.env.VETCREW_TEST_AUTH = "1";
  process.env.VETCREW_ALLOW_UNREVIEWED_SCORES = "1";
  const dbName = new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
  if (!/test/i.test(dbName)) {
    throw new Error(`TEST_DATABASE_URL database "${dbName}" must contain "test"`);
  }
  ({ pool, db } = createDb(TEST_DATABASE_URL));
  await pool.query("drop schema public cascade");
  await pool.query("create schema public");
  await runMigrations(pool);
  tenantId = await ensurePilotTenant(db);
  await syncScenarios(db, tenantId, loadScenarioFiles());
  await seedAssessmentScenario(db, tenantId);

  const clerkEnabled = false;
  const authEnabled = isAuthEnabled(clerkEnabled);
  const app = express();
  app.use(express.json());
  app.use(
    "/api/sessions",
    requireSignedIn(clerkEnabled, readAuth),
    createSessionRouter(db, tenantId, { authEnabled, readAuth }),
  );
  app.use("/api", createManagerRouter(db, tenantId, { authEnabled, clerkEnabled, readAuth }));
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
  if (ORIGINAL_TEST_AUTH === undefined) delete process.env.VETCREW_TEST_AUTH;
  else process.env.VETCREW_TEST_AUTH = ORIGINAL_TEST_AUTH;
  if (ORIGINAL_ALLOW_UNREVIEWED === undefined) delete process.env.VETCREW_ALLOW_UNREVIEWED_SCORES;
  else process.env.VETCREW_ALLOW_UNREVIEWED_SCORES = ORIGINAL_ALLOW_UNREVIEWED;
});

describe("mode is frozen onto the session, and pins the assessment seed", () => {
  test("an assessment runs on the scenario's pinned seed, ignoring any client seed", async () => {
    // Identical conditions is the point of the locked platform: the reducer
    // draws jitter per vital per tick, so a random seed per session would give
    // two candidates different vitals traces on the same scenario.
    const res = await api("/api/sessions", {
      method: "POST",
      headers: INSTRUCTOR,
      body: JSON.stringify({
        scenarioSlug: ASSESSMENT_SLUG,
        traineeId: "seed-candidate",
        seed: 999,
      }),
    });
    expect(res.status).toBe(201);
    const { session } = (await res.json()) as { session: { seed: number; mode: string } };
    expect(session.seed).toBe(424242);
    expect(session.mode).toBe("assessment");
  });

  test("two candidates on the same assessment get the same seed", async () => {
    const a = await createSession(ASSESSMENT_SLUG, "cand-a");
    const b = await createSession(ASSESSMENT_SLUG, "cand-b");
    const seeds = await pool.query<{ seed: string }>(
      "select seed from vc_sim_sessions where id = any($1::uuid[])",
      [[a, b]],
    );
    expect(new Set(seeds.rows.map((r) => Number(r.seed))).size).toBe(1);
  });

  test("a practice session still gets its client-supplied seed", async () => {
    const res = await api("/api/sessions", {
      method: "POST",
      headers: INSTRUCTOR,
      body: JSON.stringify({ scenarioSlug: PRACTICE_SLUG, traineeId: "p", seed: 999 }),
    });
    const { session } = (await res.json()) as { session: { seed: number; mode: string } };
    expect(session.seed).toBe(999);
    expect(session.mode).toBe("practice");
  });
});

describe("the rater roster is amendable until debrief, then fixed", () => {
  test("it can be replaced while the session is still running", async () => {
    const id = await createSession(ASSESSMENT_SLUG, "roster-candidate");
    expect((await assignRaters(id, ASSESSMENT_RATERS)).status).toBe(200);

    // A rater goes on leave — swap them rather than stranding the candidate.
    const swapped = ["rater-vet", "rater-reviewer", "rater-stand-in"];
    expect((await assignRaters(id, swapped)).status).toBe(200);

    const read = await api(`/api/sessions/${id}/raters`, { headers: INSTRUCTOR });
    const body = (await read.json()) as { raterUserIds: string[]; required: number };
    expect(body.raterUserIds.sort()).toEqual([...swapped].sort());
    expect(body.required).toBe(3);
  });

  test("it is refused from debrief onward, once anyone has seen the run", async () => {
    const id = await createSession(ASSESSMENT_SLUG, "roster-locked-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, "roster-locked-candidate");
    const late = await assignRaters(id, ["a", "b", "c"]);
    expect(late.status).toBe(409);
  });

  test("a trainee cannot set the roster", async () => {
    const id = await createSession(ASSESSMENT_SLUG, "roster-authz-candidate");
    const res = await api(`/api/sessions/${id}/raters`, {
      method: "PUT",
      headers: authHeader("some-trainee", "trainee"),
      body: JSON.stringify({ raterUserIds: ASSESSMENT_RATERS }),
    });
    expect(res.status).toBe(403);
  });
});

describe("D2: the set is complete only when every assigned rater covers every declared domain", () => {
  test("an unassigned rater is refused", async () => {
    // Otherwise "three raters submitted" is satisfied by any three people —
    // including the mentor, whose exclusion is the point (§1.6).
    const id = await createSession(ASSESSMENT_SLUG, "unassigned-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, "unassigned-candidate");
    const res = await rate(id, "the-mentor");
    expect(res.status).toBe(403);
  });

  test("a partial domain set from an assigned rater does not complete them", async () => {
    const id = await createSession(ASSESSMENT_SLUG, "partial-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, "partial-candidate");
    const res = await api(`/api/sessions/${id}/ratings`, {
      method: "POST",
      headers: authHeader(ASSESSMENT_RATERS[0], "trainee"),
      body: JSON.stringify({
        ratings: [{ domain: ASSESSMENT_DOMAINS[0], score: 4, evidenceEventSeqs: [4] }],
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { complete: boolean; ratersComplete: number };
    expect(body.complete).toBe(false);
    expect(body.ratersComplete).toBe(0);
  });

  test("a rater correcting themselves supersedes the prior row, which is archived", async () => {
    // The amendment path: append-only does not mean values are immutable, it
    // means the original stays readable. Nothing else exercises a SECOND
    // submission for the same (session, rater, domain), which is the only way
    // the archive-then-upsert ever runs.
    const id = await createSession(ASSESSMENT_SLUG, "amend-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, "amend-candidate");

    expect((await rate(id, ASSESSMENT_RATERS[0], 2)).status).toBe(201);
    expect((await rate(id, ASSESSMENT_RATERS[0], 5)).status).toBe(201);

    const live = await pool.query<{ domain: string; score: number }>(
      "select domain, score from vc_ants_ratings where session_id = $1 and rater_id = $2",
      [id, ASSESSMENT_RATERS[0]],
    );
    // One live row per declared domain, carrying the corrected score.
    expect(live.rows).toHaveLength(ASSESSMENT_DOMAINS.length);
    expect(live.rows.every((r) => r.score === 5)).toBe(true);

    const archived = await pool.query<{ score: number; archived_reason: string }>(
      "select score, archived_reason from vc_ants_ratings_archive where session_id = $1 and rater_id = $2",
      [id, ASSESSMENT_RATERS[0]],
    );
    // ...and the superseded score is still readable rather than gone.
    expect(archived.rows).toHaveLength(ASSESSMENT_DOMAINS.length);
    expect(archived.rows.every((r) => r.score === 2)).toBe(true);
  });

  test("a domain the scenario does not declare is refused", async () => {
    const id = await createSession(ASSESSMENT_SLUG, "undeclared-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, "undeclared-candidate");
    const res = await api(`/api/sessions/${id}/ratings`, {
      method: "POST",
      headers: authHeader(ASSESSMENT_RATERS[0], "trainee"),
      body: JSON.stringify({
        ratings: [{ domain: "team_working", score: 4, evidenceEventSeqs: [4] }],
      }),
    });
    expect(res.status).toBe(422);
  });

  test("raters two and three are not locked out by rater one", async () => {
    // The single blocking contradiction Unit B exists to fix: the first
    // submission used to flip the session to `scored`, 409ing the other two.
    const id = await createSession(ASSESSMENT_SLUG, "three-rater-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, "three-rater-candidate");
    for (const [index, raterId] of ASSESSMENT_RATERS.entries()) {
      const res = await rate(id, raterId);
      expect(res.status).toBe(201);
      const body = (await res.json()) as { complete: boolean; ratersComplete: number };
      expect(body.ratersComplete).toBe(index + 1);
      expect(body.complete).toBe(index === 2);
    }
  });

  test("fewer than three assigned raters can never complete a set", async () => {
    const id = await createSession(ASSESSMENT_SLUG, "two-rater-candidate");
    await assignRaters(id, ASSESSMENT_RATERS.slice(0, 2));
    await runToDebrief(id, "two-rater-candidate");
    for (const raterId of ASSESSMENT_RATERS.slice(0, 2)) {
      const res = await rate(id, raterId);
      expect(res.status).toBe(201);
      expect(((await res.json()) as { complete: boolean }).complete).toBe(false);
    }
  });

  test("a manager-proxied rating counts toward the roster it names", async () => {
    // The Reviewer never logs in, so the ONLY way she completes her third of an
    // assessment is proxied. If proxy entries did not count toward completion,
    // the three-rater model would be unreachable in the one configuration it
    // was designed for.
    const id = await createSession(ASSESSMENT_SLUG, "proxy-completion-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, "proxy-completion-candidate");

    expect((await rate(id, ASSESSMENT_RATERS[0])).status).toBe(201);
    expect((await rate(id, ASSESSMENT_RATERS[1])).status).toBe(201);

    const proxied = await api(`/api/sessions/${id}/ratings`, {
      method: "POST",
      headers: MANAGER,
      body: JSON.stringify({
        raterId: ASSESSMENT_RATERS[2],
        ratings: ASSESSMENT_DOMAINS.map((domain) => ({
          domain,
          score: 4,
          evidenceEventSeqs: [4, 7],
        })),
      }),
    });
    expect(proxied.status).toBe(201);
    const body = (await proxied.json()) as { complete: boolean; ratersComplete: number };
    expect(body.ratersComplete).toBe(3);
    expect(body.complete).toBe(true);

    // And the record keeps both identities on the proxied third.
    const aar = await api(`/api/sessions/${id}/aar`, { headers: MANAGER });
    const rows = (await aar.json()) as {
      ratings: { raterId: string; submittedByUserId: string }[];
    };
    const proxiedRows = rows.ratings.filter((r) => r.raterId === ASSESSMENT_RATERS[2]);
    expect(proxiedRows).toHaveLength(ASSESSMENT_DOMAINS.length);
    expect(proxiedRows.every((r) => r.submittedByUserId === "assess-manager")).toBe(true);
  });
});

describe("a rater swap leaves a trace (§3.2)", () => {
  test("the removed rater is retained in the roster history and loses access", async () => {
    // Swapping a rater is the sanctioned alternative to archiving an assessment
    // unscored — which is only defensible if the swap is itself recorded.
    const id = await createSession(ASSESSMENT_SLUG, "swap-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await assignRaters(id, ["rater-vet", "rater-reviewer", "rater-stand-in"]);

    const read = await api(`/api/sessions/${id}/raters`, { headers: INSTRUCTOR });
    const body = (await read.json()) as {
      raterUserIds: string[];
      history: {
        raterUserId: string;
        assignedByUserId: string | null;
        removedAt: string | null;
        removedByUserId: string | null;
      }[];
    };
    expect(body.raterUserIds).not.toContain("rater-senior-tech");

    const dropped = body.history.find((row) => row.raterUserId === "rater-senior-tech");
    expect(dropped?.removedAt).not.toBeNull();
    expect(dropped?.removedByUserId).toBe("assess-instructor");
    const replacement = body.history.find((row) => row.raterUserId === "rater-stand-in");
    expect(replacement?.removedAt).toBeNull();
    expect(replacement?.assignedByUserId).toBe("assess-instructor");

    // Access follows the live roster, not the history.
    await runToDebrief(id, "swap-candidate");
    expect((await rate(id, "rater-senior-tech")).status).toBe(403);
    expect((await rate(id, "rater-stand-in")).status).toBe(201);
  });
});

describe("raters can reach the session they were assigned to (§2.4)", () => {
  test("an assigned rater who is neither instructor nor manager may read the AAR and rate", async () => {
    // A vet and a senior technician hold no role_stations row. Before the
    // roster clause they were 403'd off both routes, and the only workaround
    // was handing all three the instructor role — which also lets them create
    // and run sessions. That is not a permission model.
    const id = await createSession(ASSESSMENT_SLUG, "rater-access-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, "rater-access-candidate");

    const aar = await api(`/api/sessions/${id}/aar`, {
      headers: authHeader(ASSESSMENT_RATERS[0], "trainee"),
    });
    expect(aar.status).toBe(200);
    expect((await rate(id, ASSESSMENT_RATERS[0])).status).toBe(201);
  });

  test("someone off the roster is still refused", async () => {
    const id = await createSession(ASSESSMENT_SLUG, "stranger-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    const res = await api(`/api/sessions/${id}/aar`, {
      headers: authHeader("passing-stranger", "trainee"),
    });
    expect(res.status).toBe(403);
  });
});

describe("raters are blinded to each other until the session is scored (§2.1)", () => {
  test("rater two sees only their own rows mid-rating, and everything once scored", async () => {
    // The entire justification for three raters is inter-rater agreement. If
    // rater 2 sees rater 1's scores first, that is one judgment and two
    // anchorings — while the packet still claims three.
    const id = await createSession(ASSESSMENT_SLUG, "blinding-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, "blinding-candidate");

    expect((await rate(id, ASSESSMENT_RATERS[0], 5)).status).toBe(201);

    const midway = await api(`/api/sessions/${id}/aar`, {
      headers: authHeader(ASSESSMENT_RATERS[1], "trainee"),
    });
    const midwayBody = (await midway.json()) as { ratings: { raterId: string }[] };
    expect(midwayBody.ratings).toHaveLength(0);

    expect((await rate(id, ASSESSMENT_RATERS[1], 3)).status).toBe(201);
    const ownRows = await api(`/api/sessions/${id}/aar`, {
      headers: authHeader(ASSESSMENT_RATERS[1], "trainee"),
    });
    const ownBody = (await ownRows.json()) as { ratings: { raterId: string }[] };
    expect(ownBody.ratings).toHaveLength(ASSESSMENT_DOMAINS.length);
    expect(ownBody.ratings.every((r) => r.raterId === ASSESSMENT_RATERS[1])).toBe(true);

    // Third rater completes the set; blinding lifts.
    expect((await rate(id, ASSESSMENT_RATERS[2], 4)).status).toBe(201);
    const scored = await api(`/api/sessions/${id}/aar`, {
      headers: authHeader(ASSESSMENT_RATERS[1], "trainee"),
    });
    const scoredBody = (await scored.json()) as {
      session: { phase: string };
      ratings: { raterId: string }[];
    };
    expect(scoredBody.session.phase).toBe("scored");
    expect(scoredBody.ratings).toHaveLength(
      ASSESSMENT_RATERS.length * ASSESSMENT_DOMAINS.length,
    );
  });

  test("a practice session does not blind — its ratings are formative", async () => {
    const id = await createSession(PRACTICE_SLUG, "practice-blinding-trainee");
    await runToDebrief(id, "practice-blinding-trainee");
    const res = await api(`/api/sessions/${id}/ratings`, {
      method: "POST",
      headers: INSTRUCTOR,
      body: JSON.stringify({
        ratings: [{ domain: "decision_making", score: 3, evidenceEventSeqs: [4] }],
      }),
    });
    expect(res.status).toBe(201);
    const aar = await api(`/api/sessions/${id}/aar`, { headers: MANAGER });
    expect(((await aar.json()) as { ratings: unknown[] }).ratings).toHaveLength(1);
  });
});

describe("the evidence desk is assessment-only (§2.2)", () => {
  test("an archived practice session carrying ratings never reaches the desk", async () => {
    // Widening the FSM so practice has a terminal state makes `archived` stop
    // implying `scored`. Without the mode filter, this session would appear on
    // the hiring desk with an overall ANTS built from one formative rating.
    const trainee = "desk-leak-trainee";
    const id = await createSession(PRACTICE_SLUG, trainee);
    await runToDebrief(id, trainee);
    const rated = await api(`/api/sessions/${id}/ratings`, {
      method: "POST",
      headers: INSTRUCTOR,
      body: JSON.stringify({
        ratings: [{ domain: "decision_making", score: 5, evidenceEventSeqs: [4] }],
      }),
    });
    expect(rated.status).toBe(201);

    const archived = await api(`/api/sessions/${id}/events`, {
      method: "POST",
      headers: INSTRUCTOR,
      body: JSON.stringify({ events: [{ type: "phase_change", phase: "archived" }] }),
    });
    expect(archived.status).toBe(201);
    expect(((await archived.json()) as { phase: string }).phase).toBe("archived");

    const evidence = await api(`/api/trainees/${trainee}/evidence`, { headers: MANAGER });
    expect(evidence.status).toBe(200);
    expect(((await evidence.json()) as { sessions: unknown[] }).sessions).toHaveLength(0);

    const trend = await api(`/api/trainees/${trainee}/trend`, { headers: MANAGER });
    expect(((await trend.json()) as { series: unknown[] }).series).toHaveLength(0);
  });

  test("a scored assessment does reach the desk", async () => {
    const trainee = "desk-real-candidate";
    const id = await createSession(ASSESSMENT_SLUG, trainee);
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, trainee);
    for (const raterId of ASSESSMENT_RATERS) {
      expect((await rate(id, raterId)).status).toBe(201);
    }
    const evidence = await api(`/api/trainees/${trainee}/evidence`, { headers: MANAGER });
    const body = (await evidence.json()) as {
      sessions: { sessionId: string; overallAnts: number | null }[];
      bandStatus: string;
    };
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0]?.sessionId).toBe(id);
    expect(body.sessions[0]?.overallAnts).not.toBeNull();
    // Cross-person bands stay withheld until cohort N exists (§6.2).
    expect(body.bandStatus).toBe("cohort_insufficient");
  });
});

describe("an assessment cannot be buried, a practice run can be closed", () => {
  test("archiving an assessment straight out of debrief is refused", async () => {
    const id = await createSession(ASSESSMENT_SLUG, "burial-candidate");
    await assignRaters(id, ASSESSMENT_RATERS);
    await runToDebrief(id, "burial-candidate");
    const res = await api(`/api/sessions/${id}/events`, {
      method: "POST",
      headers: INSTRUCTOR,
      body: JSON.stringify({ events: [{ type: "phase_change", phase: "archived" }] }),
    });
    expect(res.status).toBe(409);
  });

  test("a practice session may archive from debrief — its only terminal state", async () => {
    const id = await createSession(PRACTICE_SLUG, "practice-archive-trainee");
    await runToDebrief(id, "practice-archive-trainee");
    const res = await api(`/api/sessions/${id}/events`, {
      method: "POST",
      headers: INSTRUCTOR,
      body: JSON.stringify({ events: [{ type: "phase_change", phase: "archived" }] }),
    });
    expect(res.status).toBe(201);
  });

  test("an assessment refuses a live injection over REST", async () => {
    const id = await createSession(ASSESSMENT_SLUG, "inject-candidate");
    const res = await api(`/api/sessions/${id}/events`, {
      method: "POST",
      headers: INSTRUCTOR,
      body: JSON.stringify({
        events: [
          { type: "phase_change", phase: "briefing" },
          { type: "injection", injection: "owner_distressed" },
        ],
      }),
    });
    expect(res.status).toBe(409);
  });
});
