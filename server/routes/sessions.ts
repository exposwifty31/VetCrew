import { randomInt } from "node:crypto";

import {
  buildAar,
  evaluateChecklist,
  evaluateTasks,
  type EngineEvent,
} from "@vetcrew/engine";
import {
  antsDomainSchema,
  authoredScenarioSchema,
  engineEventBodySchema,
  engineEventSchema,
  type EngineEventBody,
} from "@vetcrew/shared";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import {
  readAuth,
  type AuthReader,
  type AuthSnapshot,
  type VetcrewRole,
} from "../auth.js";
import type { Db } from "../db/client.js";
import {
  antsRatings,
  roleStations,
  scenarios,
  sessionEvents,
  simSessions,
} from "../db/schema/index.js";
import { attestEvidenceSeqs, loadEventLogRows } from "../evidence-attest.js";
import { appendSessionEvents, appendSessionEventsTx } from "../live/event-append.js";
import { compileScenario } from "../scenarios.js";

/** Escape hatch for unreviewed scenarios — CI/local only; never production. */
function allowUnreviewedScores(): boolean {
  return (
    process.env.VETCREW_ALLOW_UNREVIEWED_SCORES === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

function isRaterRole(role: VetcrewRole | null): boolean {
  return role === "instructor" || role === "manager";
}

type RestEventAuthz =
  | { ok: true; bodies: EngineEventBody[] }
  | { ok: false; message: string };

/**
 * REST append is the test/admin harness beside the live socket path.
 * Instructors/managers may seed any bodies; trainees may only send their own
 * intents, with actorId stamped from auth (mirrors socket authorizeIntent).
 */
function authorizeRestEventBodies(
  auth: AuthSnapshot,
  authEnabled: boolean,
  bodies: readonly EngineEventBody[],
  assignedRoles: readonly string[],
): RestEventAuthz {
  if (!authEnabled) {
    return { ok: true, bodies: [...bodies] };
  }
  if (isRaterRole(auth.role)) {
    return { ok: true, bodies: [...bodies] };
  }
  if (auth.role !== "trainee" || auth.userId === null) {
    return { ok: false, message: "forbidden" };
  }
  const stamped: EngineEventBody[] = [];
  for (const body of bodies) {
    switch (body.type) {
      case "injection":
      case "phase_change":
      case "tick":
        return {
          ok: false,
          message: "trainee cannot inject, change session phase, or emit ticks",
        };
      case "action":
      case "task_start":
      case "task_submit": {
        if (!assignedRoles.includes(body.role)) {
          return { ok: false, message: `trainee is not assigned role "${body.role}"` };
        }
        stamped.push({ ...body, actorId: auth.userId });
        break;
      }
      default: {
        const exhaustive: never = body;
        throw new Error(`Unhandled event body: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
  return { ok: true, bodies: stamped };
}

function readAuthIfEnabled(req: Request, authEnabled: boolean, readAuthFn: AuthReader): AuthSnapshot {
  if (!authEnabled) {
    return { isAuthenticated: false, userId: null, role: null };
  }
  return readAuthFn(req);
}

export type SessionRouterOptions = {
  readonly authEnabled?: boolean;
  readonly readAuth?: AuthReader;
};

const createSessionSchema = z.object({
  scenarioSlug: z.string().min(1),
  scenarioVersion: z.string().min(1).optional(),
  /** u32 — matches the engine PRNG and the DB check constraint. */
  seed: z.number().int().nonnegative().max(4294967295).optional(),
  traineeId: z.string().min(1).optional(),
  /** The progression axis — cannot be backfilled (CLAUDE.md §4). */
  traineeTimeInTrainingDays: z.number().int().nonnegative().optional(),
});

/** Bodies only — the server stamps contiguous seqs (Sprint 3 seq authority). */
const appendEventsSchema = z.object({
  events: z.array(engineEventBodySchema).min(1),
});

const submitRatingsSchema = z.object({
  raterId: z.string().min(1).optional(),
  ratings: z
    .array(
      z.object({
        domain: antsDomainSchema,
        score: z.number().int().min(1).max(5),
        evidenceEventSeqs: z.array(z.number().int().positive()).min(1),
      }),
    )
    .min(1),
});

/** Validated UUID path param, or null — a malformed id must 404, not 500 on a pg cast. */
function paramId(req: Request): string | null {
  const value = req.params["id"];
  return typeof value === "string" && z.uuid().safeParse(value).success ? value : null;
}

async function loadSession(db: Db, tenantId: string, id: string) {
  const rows = await db
    .select()
    .from(simSessions)
    .where(and(eq(simSessions.tenantId, tenantId), eq(simSessions.id, id)));
  return rows[0];
}

async function loadEvents(db: Db, sessionId: string): Promise<EngineEvent[]> {
  const rows = await db
    .select({ payload: sessionEvents.payload })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(asc(sessionEvents.seq));
  // Payload rows were validated on write; parse defensively anyway.
  return rows.map((row) => engineEventSchema.parse(row.payload));
}

type CreateBindings = {
  readonly sessionTraineeId: string | null;
  readonly technicianUserId: string | null;
  readonly instructorUserId: string | null;
};

function assignedUserIdForStationRole(
  stationRole: string,
  bindings: CreateBindings,
): string | null {
  switch (stationRole) {
    case "technician":
      return bindings.technicianUserId;
    case "instructor":
      return bindings.instructorUserId;
    default:
      return null;
  }
}

function buildRoleStationRows(
  tenantId: string,
  sessionId: string,
  scenarioRoles: string[],
  bindings: CreateBindings,
  authEnabled: boolean,
): {
  tenantId: string;
  sessionId: string;
  role: string;
  assignedUserId: string | null;
}[] {
  const rows = scenarioRoles.map((role) => ({
    tenantId,
    sessionId,
    role,
    assignedUserId: authEnabled ? assignedUserIdForStationRole(role, bindings) : null,
  }));
  if (authEnabled && bindings.instructorUserId !== null && !scenarioRoles.includes("instructor")) {
    rows.push({
      tenantId,
      sessionId,
      role: "instructor",
      assignedUserId: bindings.instructorUserId,
    });
  }
  return rows;
}

/**
 * Floor wedge: only instructor/manager may create sessions when auth is on.
 * Trainees join via deep-link `#/station/:sessionId` after role_stations bind.
 */
function resolveCreateBindings(
  auth: AuthSnapshot,
  traineeId: string | undefined,
): CreateBindings | "forbidden" {
  if (!auth.isAuthenticated || auth.userId === null) {
    return "forbidden";
  }
  const role = auth.role;
  switch (role) {
    case "trainee":
      return "forbidden";
    case "instructor":
    case "manager": {
      return {
        sessionTraineeId: traineeId ?? null,
        technicianUserId: traineeId ?? null,
        instructorUserId: auth.userId,
      };
    }
    case null:
      return "forbidden";
    default: {
      const exhaustive: never = role;
      throw new Error(`Unhandled role: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Live join allowlist — sessionId + scenario role must match assigned_user_id. */
export async function assertRoleStationBinding(
  db: Db,
  tenantId: string,
  sessionId: string,
  role: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ assignedUserId: roleStations.assignedUserId })
    .from(roleStations)
    .where(
      and(
        eq(roleStations.tenantId, tenantId),
        eq(roleStations.sessionId, sessionId),
        eq(roleStations.role, role),
      ),
    );
  const row = rows[0];
  return row !== undefined && row.assignedUserId === userId;
}

/** REST ownership — manager/instructor see all; trainees only assigned stations. */
async function assertSessionAccess(
  db: Db,
  tenantId: string,
  sessionId: string,
  auth: AuthSnapshot,
  authEnabled: boolean,
): Promise<boolean> {
  if (!authEnabled) {
    return true;
  }
  const role = auth.role;
  switch (role) {
    case "manager":
    case "instructor":
      return true;
    case "trainee":
    case null:
      break;
    default: {
      const exhaustive: never = role;
      throw new Error(`Unhandled role: ${JSON.stringify(exhaustive)}`);
    }
  }
  if (auth.userId === null) {
    return false;
  }
  const rows = await db
    .select({ assignedUserId: roleStations.assignedUserId })
    .from(roleStations)
    .where(and(eq(roleStations.tenantId, tenantId), eq(roleStations.sessionId, sessionId)));
  return rows.some((row) => row.assignedUserId === auth.userId);
}

export function createSessionRouter(
  db: Db,
  tenantId: string,
  options: SessionRouterOptions = {},
): Router {
  const authEnabled = options.authEnabled ?? false;
  const readAuthFn = options.readAuth ?? readAuth;
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    const auth = readAuthIfEnabled(req, authEnabled, readAuthFn);
    const conditions = [eq(simSessions.tenantId, tenantId)];
    if (authEnabled) {
      const role = auth.role;
      switch (role) {
        case "manager":
        case "instructor":
          break;
        case "trainee":
        case null: {
          if (auth.userId === null) {
            res.json({ sessions: [] });
            return;
          }
          const assigned = await db
            .select({ sessionId: roleStations.sessionId })
            .from(roleStations)
            .where(
              and(
                eq(roleStations.tenantId, tenantId),
                eq(roleStations.assignedUserId, auth.userId),
              ),
            );
          const sessionIds = assigned.map((row) => row.sessionId);
          if (sessionIds.length === 0) {
            res.json({ sessions: [] });
            return;
          }
          conditions.push(inArray(simSessions.id, sessionIds));
          break;
        }
        default: {
          const exhaustive: never = role;
          throw new Error(`Unhandled role: ${JSON.stringify(exhaustive)}`);
        }
      }
    }
    const rows = await db
      .select({
        id: simSessions.id,
        scenarioId: simSessions.scenarioId,
        scenarioSlug: scenarios.slug,
        scenarioVersion: simSessions.scenarioVersion,
        phase: simSessions.phase,
        traineeId: simSessions.traineeId,
        createdAt: simSessions.createdAt,
      })
      .from(simSessions)
      .innerJoin(scenarios, eq(scenarios.id, simSessions.scenarioId))
      .where(and(...conditions))
      .orderBy(desc(simSessions.createdAt));
    res.json({ sessions: rows });
  });

  router.post("/", async (req: Request, res: Response) => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }
    const input = parsed.data;
    let bindings: CreateBindings = {
      sessionTraineeId: input.traineeId ?? null,
      technicianUserId: null,
      instructorUserId: null,
    };
    if (authEnabled) {
      const resolved = resolveCreateBindings(readAuthIfEnabled(req, authEnabled, readAuthFn), input.traineeId);
      if (resolved === "forbidden") {
        res.status(403).json({ error: "forbidden" });
        return;
      }
      bindings = resolved;
    }
    const conditions = [eq(scenarios.tenantId, tenantId), eq(scenarios.slug, input.scenarioSlug)];
    if (input.scenarioVersion !== undefined) {
      conditions.push(eq(scenarios.version, input.scenarioVersion));
    }
    const scenarioRows = await db
      .select()
      .from(scenarios)
      .where(and(...conditions))
      .orderBy(desc(scenarios.createdAt));
    const scenario = scenarioRows[0];
    if (scenario === undefined) {
      res.status(404).json({ error: "scenario not found" });
      return;
    }
    const authored = authoredScenarioSchema.parse(scenario.definition);
    const inserted = await db
      .insert(simSessions)
      .values({
        tenantId,
        scenarioId: scenario.id,
        scenarioVersion: scenario.version,
        seed: input.seed ?? randomInt(1, 2 ** 31),
        traineeId: bindings.sessionTraineeId,
        traineeTimeInTrainingDays: input.traineeTimeInTrainingDays ?? null,
      })
      .returning();
    const session = inserted[0];
    if (session === undefined) {
      res.status(500).json({ error: "failed to create session" });
      return;
    }
    await db.insert(roleStations).values(
      buildRoleStationRows(tenantId, session.id, authored.roles, bindings, authEnabled),
    );
    res.status(201).json({
      session: {
        ...session,
        scenarioSlug: authored.slug,
        roles: authored.roles,
      },
    });
  });

  router.post("/:id/events", async (req: Request, res: Response) => {
    const parsed = appendEventsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }
    const id = paramId(req);
    if (id === null) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    const session = await loadSession(db, tenantId, id);
    if (session === undefined) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    const auth = readAuthIfEnabled(req, authEnabled, readAuthFn);
    const allowed = await assertSessionAccess(db, tenantId, id, auth, authEnabled);
    if (!allowed) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    let assignedRoles: string[] = [];
    if (authEnabled && auth.role === "trainee" && auth.userId !== null) {
      const stations = await db
        .select({ role: roleStations.role })
        .from(roleStations)
        .where(
          and(
            eq(roleStations.tenantId, tenantId),
            eq(roleStations.sessionId, id),
            eq(roleStations.assignedUserId, auth.userId),
          ),
        );
      assignedRoles = stations.map((row) => row.role);
    }
    const authz = authorizeRestEventBodies(auth, authEnabled, parsed.data.events, assignedRoles);
    if (!authz.ok) {
      res.status(403).json({ error: authz.message });
      return;
    }
    const result = await appendSessionEvents(db, {
      tenantId,
      sessionId: id,
      bodies: authz.bodies,
    });
    switch (result.kind) {
      case "not_found":
        res.status(404).json({ error: "session not found" });
        return;
      case "ok":
        res.status(201).json({
          appended: result.events.length,
          phase: result.phase,
          events: result.events,
        });
        return;
      default: {
        const exhaustive: never = result;
        throw new Error(`Unhandled result: ${JSON.stringify(exhaustive)}`);
      }
    }
  });

  router.get("/:id/aar", async (req: Request, res: Response) => {
    const id = paramId(req);
    const session = id === null ? undefined : await loadSession(db, tenantId, id);
    if (session === undefined) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    const auth = readAuthIfEnabled(req, authEnabled, readAuthFn);
    const allowed = await assertSessionAccess(db, tenantId, session.id, auth, authEnabled);
    if (!allowed) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const scenarioRows = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, session.scenarioId));
    const scenarioRow = scenarioRows[0];
    if (scenarioRow === undefined) {
      res.status(500).json({ error: "session references missing scenario" });
      return;
    }
    const authored = authoredScenarioSchema.parse(scenarioRow.definition);
    const events = await loadEvents(db, session.id);
    const compiled = compileScenario(authored);
    const aar = buildAar(session.seed, events, compiled);
    const checklist = evaluateChecklist(events, authored.checklist);
    const tasks = evaluateTasks(session.seed, events, compiled);
    const ratings = await db
      .select()
      .from(antsRatings)
      .where(eq(antsRatings.sessionId, session.id));
    res.json({
      session: {
        id: session.id,
        phase: session.phase,
        seed: session.seed,
        traineeId: session.traineeId,
        traineeTimeInTrainingDays: session.traineeTimeInTrainingDays,
        scenarioVersion: session.scenarioVersion,
      },
      scenario: {
        slug: authored.slug,
        version: authored.version,
        title: authored.title,
        titleHe: authored.titleHe,
        clinicallyReviewed: authored.clinicallyReviewed,
        actions: authored.actions,
        scoringDimensions: authored.scoringDimensions,
      },
      aar: {
        durationMs: aar.durationMs,
        timeline: aar.timeline,
        vitalsSeries: aar.vitalsSeries,
        finalPhase: aar.finalState.phase,
      },
      checklist,
      tasks,
      ratings,
    });
  });

  router.post("/:id/ratings", async (req: Request, res: Response) => {
    const parsed = submitRatingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues });
      return;
    }
    const id = paramId(req);
    if (id === null) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    const auth = readAuthIfEnabled(req, authEnabled, readAuthFn);
    const allowed = await assertSessionAccess(db, tenantId, id, auth, authEnabled);
    if (!allowed) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    // ANTS is instructor/manager formative feedback — trainees must not self-rate.
    if (authEnabled && !isRaterRole(auth.role)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const raterId = authEnabled ? auth.userId : parsed.data.raterId;
    if (raterId === null || raterId === undefined || raterId.length === 0) {
      res.status(400).json({ error: "raterId required" });
      return;
    }
    const sessionForGate = await loadSession(db, tenantId, id);
    if (sessionForGate === undefined) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    const scenarioForGate = await db
      .select({ clinicallyReviewed: scenarios.clinicallyReviewed })
      .from(scenarios)
      .where(eq(scenarios.id, sessionForGate.scenarioId));
    const scenarioRow = scenarioForGate[0];
    if (scenarioRow === undefined) {
      res.status(500).json({ error: "session references missing scenario" });
      return;
    }
    if (!scenarioRow.clinicallyReviewed && !allowUnreviewedScores()) {
      res.status(403).json({ error: "scenario_not_clinically_reviewed" });
      return;
    }
    // Phase guard, evidence check, and seq derivation all read session state,
    // so they run INSIDE the transaction under a row lock — a concurrent
    // append cannot make the debrief check stale or collide the scored seq.
    type RatingsResult =
      | { kind: "not_found" }
      | { kind: "wrong_phase"; phase: string }
      | { kind: "no_time_in_training" }
      | { kind: "unknown_evidence"; seqs: number[] }
      | { kind: "non_role_attributed"; seqs: number[] }
      | { kind: "ok" };
    const result: RatingsResult = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(simSessions)
        .where(and(eq(simSessions.tenantId, tenantId), eq(simSessions.id, id)))
        .for("update");
      const session = rows[0];
      if (session === undefined) return { kind: "not_found" };
      // FSM guard (audit F-d): scoring is the debrief -> scored transition; a
      // session in any other phase cannot be rated.
      if (session.phase !== "debrief") return { kind: "wrong_phase", phase: session.phase };
      // Scoring gate: time-in-training must exist before a session can be
      // scored — it is the progression axis and cannot be backfilled (§4).
      if (session.traineeTimeInTrainingDays === null) return { kind: "no_time_in_training" };
      // Evidence must point at role-attributed human acts in THIS session —
      // a rating with fabricated or tick-only evidence is worse than no rating (§2.3).
      // Freeze log head (seq + hash) before appending phase=scored.
      const logRows = await loadEventLogRows(tx, session.id);
      const allEvidenceSeqs = parsed.data.ratings.flatMap((rating) => rating.evidenceEventSeqs);
      const attested = attestEvidenceSeqs(logRows, allEvidenceSeqs);
      if (attested.kind === "empty_evidence") {
        return { kind: "unknown_evidence", seqs: [] };
      }
      if (attested.kind === "unknown_evidence") {
        return { kind: "unknown_evidence", seqs: attested.seqs };
      }
      if (attested.kind === "non_role_attributed") {
        return { kind: "non_role_attributed", seqs: attested.seqs };
      }
      const { logHeadSeq, logHeadHash } = attested.attestation;
      await tx.insert(antsRatings).values(
        parsed.data.ratings.map((rating) => ({
          tenantId,
          sessionId: session.id,
          raterId,
          domain: rating.domain,
          score: rating.score,
          evidenceEventSeqs: rating.evidenceEventSeqs,
          logHeadSeq,
          logHeadHash,
        })),
      );
      // Scored transition goes THROUGH the log via the sole seq authority
      // (audit F-b / Sprint 3) — no second INSERT path into vc_session_events.
      const scored = await appendSessionEventsTx(tx, {
        tenantId,
        sessionId: session.id,
        bodies: [{ type: "phase_change", phase: "scored" }],
      });
      if (scored.kind === "not_found") return { kind: "not_found" };
      return { kind: "ok" };
    });
    switch (result.kind) {
      case "not_found":
        res.status(404).json({ error: "session not found" });
        return;
      case "wrong_phase":
        res.status(409).json({
          error: `session is in phase "${result.phase}"; ratings are submitted from debrief`,
        });
        return;
      case "no_time_in_training":
        res.status(422).json({ error: "session has no trainee time-in-training; cannot score" });
        return;
      case "unknown_evidence":
        res.status(422).json({
          error: `evidence references events not in this session: ${result.seqs.join(", ")}`,
        });
        return;
      case "non_role_attributed":
        res.status(422).json({
          error: `evidence must cite role-attributed human acts (action/task_start/task_submit): ${result.seqs.join(", ")}`,
        });
        return;
      case "ok":
        res.status(201).json({ rated: parsed.data.ratings.length });
        return;
      default: {
        const exhaustive: never = result;
        throw new Error(`Unhandled result: ${JSON.stringify(exhaustive)}`);
      }
    }
  });

  return router;
}
