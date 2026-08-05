import {
  evaluateChecklist,
  evaluateTasks,
  overallAnts,
  buildTraineeTrend,
  technicalPercent,
  type EngineEvent,
} from "@vetcrew/engine";
import {
  antsDomainSchema,
  authoredScenarioSchema,
  engineEventSchema,
  traineeEvidenceResponseSchema,
  traineeTrendResponseSchema,
  type AntsDomain,
} from "@vetcrew/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { Router, type Request, type Response } from "express";

import { readAuth, requireRole, requireSignedIn, type AuthReader } from "../auth.js";
import type { Db } from "../db/client.js";
import { antsRatings, scenarios, sessionEvents, simSessions } from "../db/schema/index.js";
import { compileScenario } from "../scenarios.js";

/**
 * The evidence desk keys on `archived` as well as `scored`, which was safe only
 * while `archived` was reachable exclusively THROUGH `scored`. Widening the FSM
 * to `debrief → archived` (so practice sessions have a terminal state at all)
 * breaks that implication: without the mode filter below, every archived
 * practice session would surface on the hiring desk carrying an "overall ANTS"
 * computed from whatever partial formative ratings someone attached to it.
 *
 * So both halves are required, together: assessment mode AND a terminal phase.
 */
const EVIDENCE_PHASES = ["scored", "archived"] as const;
const EVIDENCE_MODE = "assessment";

export type ManagerRouterOptions = {
  authEnabled: boolean;
  clerkEnabled: boolean;
  readAuth?: AuthReader;
};

async function loadEventsBySessionIds(
  db: Db,
  sessionIds: string[],
): Promise<Map<string, EngineEvent[]>> {
  if (sessionIds.length === 0) {
    return new Map();
  }
  const rows = await db
    .select({
      sessionId: sessionEvents.sessionId,
      seq: sessionEvents.seq,
      payload: sessionEvents.payload,
    })
    .from(sessionEvents)
    .where(inArray(sessionEvents.sessionId, sessionIds));

  const grouped = new Map<string, { seq: number; event: EngineEvent }[]>();
  for (const row of rows) {
    const list = grouped.get(row.sessionId) ?? [];
    list.push({ seq: row.seq, event: engineEventSchema.parse(row.payload) });
    grouped.set(row.sessionId, list);
  }

  const eventsBySession = new Map<string, EngineEvent[]>();
  for (const [sessionId, list] of grouped) {
    list.sort((a, b) => a.seq - b.seq);
    eventsBySession.set(
      sessionId,
      list.map((entry) => entry.event),
    );
  }
  return eventsBySession;
}

/**
 * Manager read models — tenant-scoped evidence list + within-person trend.
 * No hiring verdicts. bandStatus is always cohort_insufficient in Sprint 5a.
 * Security: Clerk manager-role binding is still open (standing veto); tenant
 * filter is mandatory on every query.
 */
export function createManagerRouter(
  db: Db,
  tenantId: string,
  options?: ManagerRouterOptions,
): Router {
  const router = Router();
  if (options !== undefined) {
    const readAuthFn = options.readAuth ?? readAuth;
    router.use(requireSignedIn(options.clerkEnabled, readAuthFn));
    router.use(requireRole("manager", options.authEnabled, readAuthFn));
  }

  router.get("/trainees/:traineeId/evidence", async (req: Request, res: Response) => {
    const traineeId = req.params["traineeId"];
    if (typeof traineeId !== "string" || traineeId.length === 0) {
      res.status(400).json({ error: "traineeId required" });
      return;
    }

    const rows = await db
      .select({
        sessionId: simSessions.id,
        phase: simSessions.phase,
        scenarioSlug: scenarios.slug,
        scenarioVersion: simSessions.scenarioVersion,
        clinicallyReviewed: scenarios.clinicallyReviewed,
        seed: simSessions.seed,
        createdAt: simSessions.createdAt,
        definition: scenarios.definition,
      })
      .from(simSessions)
      .innerJoin(scenarios, eq(scenarios.id, simSessions.scenarioId))
      .where(
        and(
          eq(simSessions.tenantId, tenantId),
          eq(simSessions.traineeId, traineeId),
          eq(simSessions.mode, EVIDENCE_MODE),
          inArray(simSessions.phase, [...EVIDENCE_PHASES]),
        ),
      )
      .orderBy(asc(simSessions.createdAt));

    const eventsBySession = await loadEventsBySessionIds(
      db,
      rows.map((row) => row.sessionId),
    );

    const sessions = [];
    for (const row of rows) {
      const authored = authoredScenarioSchema.parse(row.definition);
      const events = eventsBySession.get(row.sessionId) ?? [];
      const compiled = compileScenario(authored);
      const checklist = evaluateChecklist(events, authored.checklist);
      const tasks = evaluateTasks(row.seed, events, compiled);
      const ratings = await db
        .select({
          domain: antsRatings.domain,
          score: antsRatings.score,
          logHeadSeq: antsRatings.logHeadSeq,
          logHeadHash: antsRatings.logHeadHash,
        })
        .from(antsRatings)
        .where(and(eq(antsRatings.tenantId, tenantId), eq(antsRatings.sessionId, row.sessionId)));
      const scores = ratings.map((r) => r.score);
      const head = ratings[0];
      const rawHash = head?.logHeadHash ?? null;
      const rawSeq = head?.logHeadSeq ?? null;
      const attested =
        rawSeq !== null &&
        rawSeq > 0 &&
        rawHash !== null &&
        /^[a-f0-9]{64}$/.test(rawHash);
      sessions.push({
        sessionId: row.sessionId,
        phase: row.phase as "scored" | "archived",
        scenarioSlug: row.scenarioSlug,
        scenarioVersion: row.scenarioVersion,
        clinicallyReviewed: row.clinicallyReviewed,
        technicalPercent: technicalPercent(checklist, tasks),
        overallAnts: overallAnts(scores),
        ratedDomainCount: scores.length,
        createdAt: row.createdAt.toISOString(),
        // Never surface unattested/legacy rows as if they had a real bind.
        logHeadSeq: attested ? rawSeq : null,
        logHeadHash: attested ? rawHash : null,
      });
    }

    const body = traineeEvidenceResponseSchema.parse({
      traineeId,
      bandStatus: "cohort_insufficient",
      sessions,
    });
    res.json(body);
  });

  router.get("/trainees/:traineeId/trend", async (req: Request, res: Response) => {
    const traineeId = req.params["traineeId"];
    if (typeof traineeId !== "string" || traineeId.length === 0) {
      res.status(400).json({ error: "traineeId required" });
      return;
    }
    const scenarioSlug =
      typeof req.query["scenarioSlug"] === "string" ? req.query["scenarioSlug"] : undefined;

    const conditions = [
      eq(simSessions.tenantId, tenantId),
      eq(simSessions.traineeId, traineeId),
      eq(simSessions.mode, EVIDENCE_MODE),
      inArray(simSessions.phase, [...EVIDENCE_PHASES]),
    ];
    if (scenarioSlug !== undefined) {
      conditions.push(eq(scenarios.slug, scenarioSlug));
    }

    const rows = await db
      .select({
        sessionId: simSessions.id,
        seed: simSessions.seed,
        createdAt: simSessions.createdAt,
        clinicallyReviewed: scenarios.clinicallyReviewed,
        definition: scenarios.definition,
      })
      .from(simSessions)
      .innerJoin(scenarios, eq(scenarios.id, simSessions.scenarioId))
      .where(and(...conditions))
      .orderBy(asc(simSessions.createdAt));

    const eventsBySession = await loadEventsBySessionIds(
      db,
      rows.map((row) => row.sessionId),
    );

    const points = [];
    for (const row of rows) {
      const authored = authoredScenarioSchema.parse(row.definition);
      const events = eventsBySession.get(row.sessionId) ?? [];
      const compiled = compileScenario(authored);
      const checklist = evaluateChecklist(events, authored.checklist);
      const tasks = evaluateTasks(row.seed, events, compiled);
      const ratings = await db
        .select({ domain: antsRatings.domain, score: antsRatings.score })
        .from(antsRatings)
        .where(and(eq(antsRatings.tenantId, tenantId), eq(antsRatings.sessionId, row.sessionId)));
      const domainScores: Partial<Record<AntsDomain, number>> = {};
      for (const rating of ratings) {
        const domain = antsDomainSchema.safeParse(rating.domain);
        if (domain.success) domainScores[domain.data] = rating.score;
      }
      const scores = ratings.map((r) => r.score);
      points.push({
        sessionId: row.sessionId,
        createdAtMs: row.createdAt.getTime(),
        technicalPercent: technicalPercent(checklist, tasks),
        overallAnts: overallAnts(scores),
        domainScores,
        clinicallyReviewed: row.clinicallyReviewed,
      });
    }

    const model = buildTraineeTrend(points);
    const domainHints = model.domainHints.flatMap((hint) => {
      const domain = antsDomainSchema.safeParse(hint.domain);
      if (!domain.success) return [];
      return [{ domain: domain.data, delta: hint.delta, direction: hint.direction }];
    });

    const body = traineeTrendResponseSchema.parse({
      traineeId,
      series: model.series.map((p) => ({
        sessionId: p.sessionId,
        createdAtMs: p.createdAtMs,
        technicalPercent: p.technicalPercent,
        overallAnts: p.overallAnts,
        clinicallyReviewed: p.clinicallyReviewed,
      })),
      overallDrift: model.overallDrift,
      domainHints,
      bandStatus: model.bandStatus,
    });
    res.json(body);
  });

  return router;
}
