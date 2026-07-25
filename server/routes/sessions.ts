import { randomInt } from "node:crypto";

import { buildAar, canTransition, evaluateChecklist, type EngineEvent, type SessionPhase } from "@vetcrew/engine";
import {
  antsDomainSchema,
  engineEventSchema,
  authoredScenarioSchema,
} from "@vetcrew/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import { Router, type Request, type Response } from "express";
import { z } from "zod";

import type { Db } from "../db/client.js";
import { antsRatings, scenarios, sessionEvents, simSessions } from "../db/schema/index.js";
import { compileScenario } from "../scenarios.js";

const createSessionSchema = z.object({
  scenarioSlug: z.string().min(1),
  scenarioVersion: z.string().min(1).optional(),
  /** u32 — matches the engine PRNG and the DB check constraint. */
  seed: z.number().int().nonnegative().max(4294967295).optional(),
  traineeId: z.string().min(1).optional(),
  /** The progression axis — cannot be backfilled (CLAUDE.md §4). */
  traineeTimeInTrainingDays: z.number().int().nonnegative().optional(),
});

const appendEventsSchema = z.object({
  events: z.array(engineEventSchema).min(1),
});

const submitRatingsSchema = z.object({
  raterId: z.string().min(1),
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

/** Walk phase_change events through the FSM from a starting phase. */
function projectPhase(from: SessionPhase, events: readonly EngineEvent[]): SessionPhase {
  let phase = from;
  for (const event of events) {
    if (event.type === "phase_change" && canTransition(phase, event.phase)) {
      phase = event.phase;
    }
  }
  return phase;
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

export function createSessionRouter(db: Db, tenantId: string): Router {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    const rows = await db
      .select({
        id: simSessions.id,
        scenarioId: simSessions.scenarioId,
        scenarioVersion: simSessions.scenarioVersion,
        phase: simSessions.phase,
        traineeId: simSessions.traineeId,
        createdAt: simSessions.createdAt,
      })
      .from(simSessions)
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
    const inserted = await db
      .insert(simSessions)
      .values({
        tenantId,
        scenarioId: scenario.id,
        scenarioVersion: scenario.version,
        seed: input.seed ?? randomInt(1, 2 ** 31),
        traineeId: input.traineeId ?? null,
        traineeTimeInTrainingDays: input.traineeTimeInTrainingDays ?? null,
      })
      .returning();
    res.status(201).json({ session: inserted[0] });
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
    const events = parsed.data.events;
    // Every session-dependent read happens INSIDE the transaction under a row
    // lock, so concurrent appends serialize instead of racing the seq check
    // (audit R1/R4 + PR review). The DB trigger (migration 0004) backstops.
    type AppendResult =
      | { kind: "not_found" }
      | { kind: "gap"; expected: number }
      | { kind: "ok" };
    const result: AppendResult = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(simSessions)
        .where(and(eq(simSessions.tenantId, tenantId), eq(simSessions.id, id)))
        .for("update");
      const session = rows[0];
      if (session === undefined) return { kind: "not_found" };
      const maxRows = await tx
        .select({ seq: sessionEvents.seq })
        .from(sessionEvents)
        .where(eq(sessionEvents.sessionId, session.id))
        .orderBy(desc(sessionEvents.seq))
        .limit(1);
      const currentMax = maxRows[0]?.seq ?? 0;
      // Seq authority: a batch must continue the log contiguously; retroactive
      // or gapped seqs would rewrite the replay of the evidence record.
      const contiguous = events.every((event, i) => event.seq === currentMax + 1 + i);
      if (!contiguous) return { kind: "gap", expected: currentMax + 1 };
      const nextPhase = projectPhase(session.phase as SessionPhase, events);
      await tx.insert(sessionEvents).values(
        events.map((event) => ({
          tenantId,
          sessionId: session.id,
          seq: event.seq,
          type: event.type,
          role: event.type === "action" ? event.role : null,
          actorId: event.type === "action" ? event.actorId : null,
          payload: event,
        })),
      );
      if (nextPhase !== session.phase) {
        // Denormalized phase for listings; the log stays authoritative.
        await tx.update(simSessions).set({ phase: nextPhase }).where(eq(simSessions.id, session.id));
      }
      return { kind: "ok" };
    });
    switch (result.kind) {
      case "not_found":
        res.status(404).json({ error: "session not found" });
        return;
      case "gap":
        res.status(409).json({
          error: `events must continue the log contiguously from seq ${result.expected}`,
        });
        return;
      case "ok":
        res.status(201).json({ appended: events.length });
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
    const aar = buildAar(session.seed, events, compileScenario(authored));
    const checklist = evaluateChecklist(events, authored.checklist);
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
    // Phase guard, evidence check, and seq derivation all read session state,
    // so they run INSIDE the transaction under a row lock — a concurrent
    // append cannot make the debrief check stale or collide the scored seq.
    type RatingsResult =
      | { kind: "not_found" }
      | { kind: "wrong_phase"; phase: string }
      | { kind: "no_time_in_training" }
      | { kind: "unknown_evidence"; seqs: number[] }
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
      // Evidence must point at events that actually exist in THIS session —
      // a rating with fabricated evidence is worse than no rating (§2.3).
      const existingSeqRows = await tx
        .select({ seq: sessionEvents.seq })
        .from(sessionEvents)
        .where(eq(sessionEvents.sessionId, session.id));
      const existingSeqs = new Set(existingSeqRows.map((row) => row.seq));
      const unknownSeqs = parsed.data.ratings
        .flatMap((rating) => rating.evidenceEventSeqs)
        .filter((seq) => !existingSeqs.has(seq));
      if (unknownSeqs.length > 0) {
        return { kind: "unknown_evidence", seqs: [...new Set(unknownSeqs)] };
      }
      let currentMax = 0;
      for (const seq of existingSeqs) {
        if (seq > currentMax) currentMax = seq;
      }
      // The scored transition goes THROUGH the log (audit F-b): replaying the
      // events must yield the same phase the projection column reports.
      const scoredEvent: EngineEvent = {
        seq: currentMax + 1,
        type: "phase_change",
        phase: "scored",
      };
      await tx.insert(antsRatings).values(
        parsed.data.ratings.map((rating) => ({
          tenantId,
          sessionId: session.id,
          raterId: parsed.data.raterId,
          domain: rating.domain,
          score: rating.score,
          evidenceEventSeqs: rating.evidenceEventSeqs,
        })),
      );
      await tx.insert(sessionEvents).values({
        tenantId,
        sessionId: session.id,
        seq: scoredEvent.seq,
        type: scoredEvent.type,
        role: null,
        actorId: null,
        payload: scoredEvent,
      });
      await tx.update(simSessions).set({ phase: "scored" }).where(eq(simSessions.id, session.id));
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
