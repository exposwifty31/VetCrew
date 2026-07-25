import { z } from "zod";

import { sessionPhaseSchema } from "./contracts.js";

/**
 * Entity contracts. Every entity is tenant-scoped (CLAUDE.md §4 / §7:
 * SaaS-shaped data model even with one hospital).
 */

export const scenarioSchema = z
  .object({
    id: z.uuid(),
    tenantId: z.uuid(),
    slug: z.string().min(1),
    /** Scenario content version; every score records the version used. */
    version: z.string().min(1),
    /** Liability boundary (CLAUDE.md §2.5): unreviewed = internal-testing only. */
    clinicallyReviewed: z.boolean(),
    clinicalReviewer: z.string().nullable(),
    /** Scenario definition is data (YAML/JSON), versioned independently. */
    definition: z.unknown(),
  })
  .superRefine((scenario, ctx) => {
    if (scenario.clinicallyReviewed && (scenario.clinicalReviewer ?? "").trim() === "") {
      ctx.addIssue({
        code: "custom",
        message: "clinically reviewed scenarios must name their reviewer (CLAUDE.md §2.5)",
      });
    }
  });

export type Scenario = z.infer<typeof scenarioSchema>;

export const simSessionSchema = z
  .object({
    id: z.uuid(),
    tenantId: z.uuid(),
    scenarioId: z.uuid(),
    scenarioVersion: z.string().min(1),
    /** PRNG seed — u32, stored per session for reproducible replay. */
    seed: z.number().int().nonnegative().max(4294967295),
    phase: sessionPhaseSchema,
    /**
     * Time-in-training of the trainee at session start, in days.
     * Captured on every scored session from the first one — it is the axis
     * the whole progression is measured against and cannot be backfilled
     * (CLAUDE.md §4).
     */
    traineeTimeInTrainingDays: z.number().int().nonnegative().nullable(),
  })
  .superRefine((session, ctx) => {
    if (session.phase === "scored" && session.traineeTimeInTrainingDays === null) {
      ctx.addIssue({
        code: "custom",
        message: "a scored session must carry time-in-training (CLAUDE.md §4)",
      });
    }
  });

export type SimSession = z.infer<typeof simSessionSchema>;

/** ANTS domains (CLAUDE.md §4 — default non-technical instrument). */
export const antsDomainSchema = z.enum([
  "task_management",
  "team_working",
  "situation_awareness",
  "decision_making",
]);

export type AntsDomain = z.infer<typeof antsDomainSchema>;

export const antsRatingSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  sessionId: z.uuid(),
  raterId: z.string().min(1),
  domain: antsDomainSchema,
  /** 1–5; per-domain scores are directional only (CLAUDE.md §4). */
  score: z.number().int().min(1).max(5),
  /** Traceability: the event seqs this rating is evidence-linked to. */
  evidenceEventSeqs: z.array(z.number().int().positive()).min(1),
});

export type AntsRating = z.infer<typeof antsRatingSchema>;
