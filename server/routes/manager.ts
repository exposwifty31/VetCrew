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
import { Router, type Request, type Response, type RequestHandler } from "express";

import type { Db } from "../db/client.js";
import { antsRatings, scenarios, sessionEvents, simSessions } from "../db/schema/index.js";
import { compileScenario } from "../scenarios.js";

const EVIDENCE_PHASES = ["scored", "archived"] as const;

async function loadEvents(db: Db, sessionId: string): Promise<EngineEvent[]> {
  const rows = await db
    .select({ payload: sessionEvents.payload })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(asc(sessionEvents.seq));
  return rows.map((row) => engineEventSchema.parse(row.payload));
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
  requireAuth: RequestHandler = (_req, _res, next) => next(),
): Router {
  const router = Router();
  router.use(requireAuth);

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
        traineeTimeInTrainingDays: simSessions.traineeTimeInTrainingDays,
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
          inArray(simSessions.phase, [...EVIDENCE_PHASES]),
        ),
      )
      .orderBy(asc(simSessions.createdAt));

    const sessions = [];
    for (const row of rows) {
      const authored = authoredScenarioSchema.parse(row.definition);
      const events = await loadEvents(db, row.sessionId);
      const compiled = compileScenario(authored);
      const checklist = evaluateChecklist(events, authored.checklist);
      const tasks = evaluateTasks(row.seed, events, compiled);
      const ratings = await db
        .select({ domain: antsRatings.domain, score: antsRatings.score })
        .from(antsRatings)
        .where(and(eq(antsRatings.tenantId, tenantId), eq(antsRatings.sessionId, row.sessionId)));
      const scores = ratings.map((r) => r.score);
      sessions.push({
        sessionId: row.sessionId,
        phase: row.phase as "scored" | "archived",
        scenarioSlug: row.scenarioSlug,
        scenarioVersion: row.scenarioVersion,
        clinicallyReviewed: row.clinicallyReviewed,
        traineeTimeInTrainingDays: row.traineeTimeInTrainingDays ?? 0,
        technicalPercent: technicalPercent(checklist, tasks),
        overallAnts: overallAnts(scores),
        ratedDomainCount: scores.length,
        createdAt: row.createdAt.toISOString(),
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
        traineeTimeInTrainingDays: simSessions.traineeTimeInTrainingDays,
        clinicallyReviewed: scenarios.clinicallyReviewed,
        definition: scenarios.definition,
      })
      .from(simSessions)
      .innerJoin(scenarios, eq(scenarios.id, simSessions.scenarioId))
      .where(and(...conditions))
      .orderBy(asc(simSessions.createdAt));

    const points = [];
    for (const row of rows) {
      const authored = authoredScenarioSchema.parse(row.definition);
      const events = await loadEvents(db, row.sessionId);
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
        timeInTrainingDays: row.traineeTimeInTrainingDays ?? 0,
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
        timeInTrainingDays: p.timeInTrainingDays,
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
