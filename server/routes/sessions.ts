import { randomInt } from "node:crypto";

import {
  buildAar,
  canTransition,
  evaluateChecklist,
  evaluateTasks,
  type EngineEvent,
  type SessionPhase,
} from "@vetcrew/engine";
import {
  antsDomainSchema,
  authoredScenarioSchema,
  engineEventBodySchema,
  engineEventSchema,
  scenarioModeSchema,
} from "@vetcrew/shared";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import {
  readAuth,
  type AuthReader,
  type AuthSnapshot,
} from "../auth.js";
import type { Db } from "../db/client.js";
import {
  antsRatings,
  roleStations,
  scenarios,
  sessionEvents,
  sessionRaters,
  simSessions,
} from "../db/schema/index.js";
import { isBypassEnabled } from "../env.js";
import { attestEvidenceSeqs, loadEventLogRows } from "../evidence-attest.js";
import { appendSessionEvents, appendSessionEventsTx } from "../live/event-append.js";
import { isScorable, refuseClientPhaseChange, refuseInjection } from "../mode-policy.js";
import { compileScenario } from "../scenarios.js";

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
});

/** Bodies only — the server stamps contiguous seqs (Sprint 3 seq authority). */
const appendEventsSchema = z.object({
  events: z.array(engineEventBodySchema).min(1),
});

/**
 * Consequential (hiring) judgments need three raters — the threshold the CPR
 * reliability literature and AVECCTN's own practice independently converge on
 * (CLAUDE.md §2.2). A vet, the Reviewer, and a senior technician who is not the
 * candidate's mentor.
 */
const REQUIRED_RATERS = 3;

const setRatersSchema = z.object({
  raterUserIds: z.array(z.string().min(1)).max(16),
});

const submitRatingsSchema = z.object({
  /**
   * Whose judgment this is. Omitted for the ordinary self-rating case; supplied
   * only when a manager enters an off-system rater's scores (see the route).
   */
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

/**
 * CI/local escape hatch for scoring `clinically_reviewed: false` scenarios.
 * Never honoured in production (CLAUDE.md §2.5, §8); `loadEnv` also refuses to
 * boot production with the flag set, so this is defence in depth.
 */
function allowUnreviewedScores(): boolean {
  return isBypassEnabled("VETCREW_ALLOW_UNREVIEWED_SCORES");
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

/** Is this user on the session's rater roster? */
async function isAssignedRater(
  db: Db,
  tenantId: string,
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ raterUserId: sessionRaters.raterUserId })
    .from(sessionRaters)
    .where(
      and(
        eq(sessionRaters.tenantId, tenantId),
        eq(sessionRaters.sessionId, sessionId),
        eq(sessionRaters.raterUserId, userId),
        // A removed rater loses access with the assignment.
        isNull(sessionRaters.removedAt),
      ),
    );
  return rows.length > 0;
}

/**
 * REST ownership — manager/instructor see all; trainees only assigned stations;
 * assigned raters get read + rate on the session they were asked to rate.
 *
 * The rater clause is load-bearing: a vet and a senior technician are neither
 * manager/instructor nor holders of a `role_stations` row, so without it every
 * rater but the instructor is 403'd off both the AAR and the ratings route —
 * and the only workaround would be handing all three the `instructor` Clerk
 * role, which also lets them create and run sessions. That is not a permission
 * model (design-alignment §2.4).
 */
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
  if (rows.some((row) => row.assignedUserId === auth.userId)) {
    return true;
  }
  return isAssignedRater(db, tenantId, sessionId, auth.userId);
}

export function createSessionRouter(
  db: Db,
  tenantId: string,
  options: SessionRouterOptions = {},
): Router {
  const authEnabled = options.authEnabled ?? false;
  const readAuthFn = options.readAuth ?? readAuth;
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
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
      .where(eq(simSessions.tenantId, tenantId))
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
    // Identical conditions is a hard product rule for the locked platform: the
    // reducer draws jitter per vital per tick, so a random per-session seed
    // would give two candidates different vitals traces on the same scenario.
    // An assessment therefore runs on the seed pinned in the scenario file and
    // ignores any client-supplied one (the schema already requires it there).
    const seed =
      authored.mode === "assessment"
        ? (authored.seed ?? randomInt(1, 2 ** 31))
        : (input.seed ?? randomInt(1, 2 ** 31));
    const inserted = await db
      .insert(simSessions)
      .values({
        tenantId,
        scenarioId: scenario.id,
        scenarioVersion: scenario.version,
        // Resolved from the scenario and frozen, exactly like scenarioVersion.
        mode: authored.mode,
        seed,
        traineeId: bindings.sessionTraineeId,
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
      // This result was previously computed and then never read, so the route
      // authorized nobody — every other session route enforces it.
      res.status(403).json({ error: "forbidden" });
      return;
    }
    // Mode is withheld capability, not honour system (CLAUDE.md §1.1) — the
    // REST append path has to refuse exactly what the socket refuses, or the
    // locked platform is one curl away from being unlocked. The refusal is
    // evaluated inside the append transaction, against the locked session row,
    // so a concurrent phase change cannot make this decision stale.
    const result = await appendSessionEvents(db, {
      tenantId,
      sessionId: id,
      bodies: parsed.data.events,
      clientOriginated: true,
    });
    switch (result.kind) {
      case "not_found":
        res.status(404).json({ error: "session not found" });
        return;
      case "refused":
        res.status(409).json({ error: result.reason });
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
    // Rater blinding (design-alignment §2.1). The whole justification for three
    // raters is inter-rater agreement; if rater 2 opens the AAR and sees that
    // rater 1 gave a 2 on decision-making before entering her own, that is one
    // judgment and two anchorings — and the packet would still claim three.
    // So while an assessment is still being rated, each rater sees only their
    // own rows. Once the set is complete and the session is scored, the whole
    // picture opens up: comparison is the point at that stage.
    const sessionMode = scenarioModeSchema.parse(session.mode);
    const blindRatings =
      isScorable(sessionMode) && session.phase !== "scored" && session.phase !== "archived";
    const ratingRows = await db
      .select()
      .from(antsRatings)
      .where(eq(antsRatings.sessionId, session.id));
    // Own = "my judgment" (raterId) OR "what I typed" (submittedByUserId). Both
    // clauses are needed once proxying exists: filtering on the submitter alone
    // hid a proxied rating from the rater it belongs to while showing it to the
    // person who transcribed it — exactly backwards. The submitter clause stays
    // so a manager who entered the Reviewer's sheet can still see what they
    // filed; they typed it, so it anchors nothing they did not already know.
    const ratings =
      blindRatings && authEnabled
        ? ratingRows.filter(
            (row) =>
              auth.userId !== null &&
              (row.raterId === auth.userId || row.submittedByUserId === auth.userId),
          )
        : ratingRows;
    res.json({
      session: {
        id: session.id,
        phase: session.phase,
        mode: sessionMode,
        seed: session.seed,
        traineeId: session.traineeId,
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

  router.get("/:id/raters", async (req: Request, res: Response) => {
    const id = paramId(req);
    const session = id === null ? undefined : await loadSession(db, tenantId, id);
    if (session === undefined || id === null) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    const auth = readAuthIfEnabled(req, authEnabled, readAuthFn);
    if (!(await assertSessionAccess(db, tenantId, id, auth, authEnabled))) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const rows = await db
      .select({
        raterUserId: sessionRaters.raterUserId,
        assignedByUserId: sessionRaters.assignedByUserId,
        removedAt: sessionRaters.removedAt,
        removedByUserId: sessionRaters.removedByUserId,
        createdAt: sessionRaters.createdAt,
      })
      .from(sessionRaters)
      .where(and(eq(sessionRaters.tenantId, tenantId), eq(sessionRaters.sessionId, id)))
      .orderBy(asc(sessionRaters.createdAt));
    res.json({
      sessionId: id,
      required: REQUIRED_RATERS,
      raterUserIds: rows.filter((row) => row.removedAt === null).map((row) => row.raterUserId),
      // Amendment history: who was dropped, by whom, when. Swapping a rater is
      // the sanctioned alternative to archiving an assessment unscored, so the
      // swap has to leave a trace of its own.
      history: rows.map((row) => ({
        raterUserId: row.raterUserId,
        assignedByUserId: row.assignedByUserId,
        assignedAt: row.createdAt.toISOString(),
        removedAt: row.removedAt?.toISOString() ?? null,
        removedByUserId: row.removedByUserId,
      })),
    });
  });

  /**
   * Replace the rater roster. Amendable while the session is before `debrief`
   * (founder decision 2026-08-05): the invariant that matters — scored requires
   * three distinct assigned raters with complete sets — is enforced at scoring
   * time and is untouched by when the roster is set. Freezing it at creation
   * bought only a permanently unscorable session the first time a rater went on
   * leave or the candidate objected to one, with a re-sit for the candidate and
   * archive-unscored as the sole exit. Locking at `debrief` is what stops the
   * roster being reshuffled once anyone has seen the run.
   */
  router.put("/:id/raters", async (req: Request, res: Response) => {
    const parsed = setRatersSchema.safeParse(req.body);
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
    if (authEnabled && auth.role !== "manager" && auth.role !== "instructor") {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    // Every roster row records who made the change, and the column is NOT NULL
    // — a nullable actor makes "nobody recorded it" indistinguishable from "we
    // forgot to". With auth off (dev/CI) there is no authenticated actor, so
    // say that in the row rather than leaving a hole; production always has one.
    const rosterActor = auth.userId ?? "dev-bypass";
    const raterUserIds = [...new Set(parsed.data.raterUserIds)];
    const outcome = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(simSessions)
        .where(and(eq(simSessions.tenantId, tenantId), eq(simSessions.id, id)))
        .for("update");
      const session = rows[0];
      if (session === undefined) return { kind: "not_found" as const };
      if (session.phase === "debrief" || session.phase === "scored" || session.phase === "archived") {
        return { kind: "locked" as const, phase: session.phase };
      }
      // Amend rather than overwrite: drop nobody's row, just mark the ones
      // leaving the roster as removed, and add only the genuinely new names.
      // A hard replace would erase the fact that a rater was ever assigned,
      // which is the one thing a swap needs to leave behind.
      const live = await tx
        .select({ id: sessionRaters.id, raterUserId: sessionRaters.raterUserId })
        .from(sessionRaters)
        .where(
          and(
            eq(sessionRaters.tenantId, tenantId),
            eq(sessionRaters.sessionId, id),
            isNull(sessionRaters.removedAt),
          ),
        );
      const keep = new Set(raterUserIds);
      const removedIds = live.filter((row) => !keep.has(row.raterUserId)).map((row) => row.id);
      if (removedIds.length > 0) {
        await tx
          .update(sessionRaters)
          .set({ removedAt: new Date(), removedByUserId: rosterActor })
          .where(inArray(sessionRaters.id, removedIds));
      }
      const alreadyLive = new Set(live.map((row) => row.raterUserId));
      const added = raterUserIds.filter((raterUserId) => !alreadyLive.has(raterUserId));
      if (added.length > 0) {
        await tx.insert(sessionRaters).values(
          added.map((raterUserId) => ({
            tenantId,
            sessionId: id,
            raterUserId,
            assignedByUserId: rosterActor,
          })),
        );
      }
      return { kind: "ok" as const };
    });
    if (outcome.kind === "not_found") {
      res.status(404).json({ error: "session not found" });
      return;
    }
    if (outcome.kind === "locked") {
      res.status(409).json({
        error: `session is in phase "${outcome.phase}"; the rater roster is fixed from debrief onward`,
      });
      return;
    }
    res.json({ sessionId: id, required: REQUIRED_RATERS, raterUserIds });
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
    // Two distinct identities (design-alignment §3.5). `raterId` is WHOSE
    // JUDGMENT this is; `submittedByUserId` is who physically typed it. They
    // differ only for a proxied entry — the Reviewer is 65, non-technical, and
    // will never log in, so the alternative was either losing her from the
    // three-rater model entirely or recording her scores under someone else's
    // name, which makes the packet's central claim false.
    const submittedByUserId = authEnabled ? auth.userId : (parsed.data.raterId ?? "dev-rater");
    if (submittedByUserId === null || submittedByUserId.length === 0) {
      res.status(400).json({ error: "raterId required" });
      return;
    }
    const raterId = parsed.data.raterId ?? submittedByUserId;
    if (raterId.length === 0) {
      res.status(400).json({ error: "raterId required" });
      return;
    }
    // Proxying is a manager action. Without this, any assigned rater could file
    // scores under a colleague's name — forgery wearing an audit trail.
    if (authEnabled && raterId !== submittedByUserId && auth.role !== "manager") {
      res.status(403).json({ error: "only a manager may submit ratings on another rater's behalf" });
      return;
    }
    const sessionForGate = await loadSession(db, tenantId, id);
    if (sessionForGate === undefined) {
      res.status(404).json({ error: "session not found" });
      return;
    }
    const scenarioForGate = await db
      .select({
        clinicallyReviewed: scenarios.clinicallyReviewed,
        definition: scenarios.definition,
      })
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
    const gateScenario = authoredScenarioSchema.parse(scenarioRow.definition);
    const declaredDomains = gateScenario.scoringDimensions;
    // D2 as amended: completion is measured against the domains the scenario
    // DECLARES, so a rating outside that set can never count toward it and
    // would sit in the record as an orphan.
    const undeclared = parsed.data.ratings
      .map((rating) => rating.domain)
      .filter((domain) => !declaredDomains.includes(domain));
    if (undeclared.length > 0) {
      res.status(422).json({
        error: `scenario does not declare ANTS domain(s): ${[...new Set(undeclared)].join(", ")}`,
      });
      return;
    }
    // Phase guard, evidence check, and seq derivation all read session state,
    // so they run INSIDE the transaction under a row lock — a concurrent
    // append cannot make the debrief check stale or collide the scored seq.
    type RatingsResult =
      | { kind: "not_found" }
      | { kind: "wrong_phase"; phase: string }
      | { kind: "not_assigned" }
      | { kind: "unknown_evidence"; seqs: number[] }
      | { kind: "ok"; complete: boolean; ratersComplete: number; ratersAssigned: number };
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
      const mode = scenarioModeSchema.parse(session.mode);

      const roster = await tx
        .select({ raterUserId: sessionRaters.raterUserId })
        .from(sessionRaters)
        .where(
          and(
            eq(sessionRaters.tenantId, tenantId),
            eq(sessionRaters.sessionId, session.id),
            isNull(sessionRaters.removedAt),
          ),
        );
      const assigned = roster.map((row) => row.raterUserId);
      // Assessment scores come only from the named three. "All three submitted"
      // is otherwise uncheckable — rater_id is free text, so a distinct-count
      // would be satisfied by any three people, including the mentor whose
      // exclusion is the entire point of the separation of duties (§1.6).
      if (isScorable(mode) && !assigned.includes(raterId)) {
        return { kind: "not_assigned" };
      }

      // Evidence must point at events that actually exist in THIS session —
      // a rating with fabricated evidence is worse than no rating (§2.3).
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
      const { logHeadSeq, logHeadHash } = attested.attestation;
      // A rater correcting their own entry supersedes the previous row rather
      // than erasing it: the old score, the evidence seqs it cited and its
      // log-head attestation are archived first. Append-only does not mean
      // values are immutable, it means corrections leave the original readable
      // — and a hiring record that silently changed underneath a reviewer is
      // exactly what §2.3 traceability forbids.
      const domains = parsed.data.ratings.map((rating) => rating.domain);
      await tx.execute(sql`
        insert into vc_ants_ratings_archive
          (id, tenant_id, session_id, rater_id, submitted_by_user_id, domain, score,
           evidence_event_seqs, log_head_seq, log_head_hash, created_at, archived_reason)
        select id, tenant_id, session_id, rater_id, submitted_by_user_id, domain, score,
               evidence_event_seqs, log_head_seq, log_head_hash, created_at,
               'superseded by a later submission from the same rater'
          from vc_ants_ratings
         where session_id = ${session.id}
           and rater_id = ${raterId}
           and domain in ${domains}
        on conflict (id) do nothing
      `);
      // Upsert: one live rating per (session, rater, domain). Completion is a
      // query over these rows, so duplicates would make it unanswerable.
      await tx
        .insert(antsRatings)
        .values(
          parsed.data.ratings.map((rating) => ({
            tenantId,
            sessionId: session.id,
            raterId,
            submittedByUserId,
            domain: rating.domain,
            score: rating.score,
            evidenceEventSeqs: rating.evidenceEventSeqs,
            logHeadSeq,
            logHeadHash,
          })),
        )
        .onConflictDoUpdate({
          target: [antsRatings.sessionId, antsRatings.raterId, antsRatings.domain],
          set: {
            score: sql`excluded.score`,
            submittedByUserId: sql`excluded.submitted_by_user_id`,
            evidenceEventSeqs: sql`excluded.evidence_event_seqs`,
            logHeadSeq: sql`excluded.log_head_seq`,
            logHeadHash: sql`excluded.log_head_hash`,
          },
        });

      // D2: the set is complete when EVERY assigned rater has covered EVERY
      // domain the scenario declares — not when the first one submits. The old
      // behaviour flipped the session to `scored` on submission one, which
      // 409'd raters two and three out of the session they were assigned to
      // and left the packet claiming three judgments it never collected.
      const stored = await tx
        .select({ raterId: antsRatings.raterId, domain: antsRatings.domain })
        .from(antsRatings)
        .where(and(eq(antsRatings.tenantId, tenantId), eq(antsRatings.sessionId, session.id)));
      const byRater = new Map<string, Set<string>>();
      for (const row of stored) {
        const domains = byRater.get(row.raterId) ?? new Set<string>();
        domains.add(row.domain);
        byRater.set(row.raterId, domains);
      }
      const completeRaters = assigned.filter((rater) => {
        const domains = byRater.get(rater);
        return domains !== undefined && declaredDomains.every((domain) => domains.has(domain));
      });
      const complete =
        isScorable(mode) &&
        assigned.length >= REQUIRED_RATERS &&
        completeRaters.length === assigned.length;

      if (complete) {
        // Scored transition goes THROUGH the log via the sole seq authority
        // (audit F-b / Sprint 3) — no second INSERT path into vc_session_events.
        const scored = await appendSessionEventsTx(tx, {
          tenantId,
          sessionId: session.id,
          bodies: [{ type: "phase_change", phase: "scored" }],
        });
        if (scored.kind === "not_found") return { kind: "not_found" };
      }
      return {
        kind: "ok",
        complete,
        ratersComplete: completeRaters.length,
        ratersAssigned: assigned.length,
      };
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
      case "not_assigned":
        res.status(403).json({ error: "rater is not assigned to this session" });
        return;
      case "unknown_evidence":
        res.status(422).json({
          error: `evidence references events not in this session: ${result.seqs.join(", ")}`,
        });
        return;
      case "ok":
        res.status(201).json({
          rated: parsed.data.ratings.length,
          complete: result.complete,
          ratersComplete: result.ratersComplete,
          ratersAssigned: result.ratersAssigned,
        });
        return;
      default: {
        const exhaustive: never = result;
        throw new Error(`Unhandled result: ${JSON.stringify(exhaustive)}`);
      }
    }
  });

  return router;
}
