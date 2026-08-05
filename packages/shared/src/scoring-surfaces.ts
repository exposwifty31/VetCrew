import { z } from "zod";

import { antsDomainSchema } from "./entities.js";

/**
 * Manager evidence / trend wire contracts (Sprint 5a).
 * No hiring-verdict enums — bands stay cohort_insufficient until N exists.
 */

export const cohortBandStatusSchema = z.literal("cohort_insufficient");
export const overallDriftSchema = z.enum(["none", "up", "down"]);

export const evidenceSessionSchema = z.object({
  sessionId: z.string().uuid(),
  phase: z.enum(["scored", "archived"]),
  scenarioSlug: z.string().min(1),
  scenarioVersion: z.string().min(1),
  clinicallyReviewed: z.boolean(),
  technicalPercent: z.number().min(0).max(100),
  overallAnts: z.number().min(1).max(5).nullable(),
  ratedDomainCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  /** Frozen event-log head when ANTS was submitted — evidence bind, not a verdict. */
  logHeadSeq: z.number().int().nonnegative().nullable(),
  /** Canonical sha256 hex of the ordered log through logHeadSeq; null if unattested. */
  logHeadHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
});

export const traineeEvidenceResponseSchema = z.object({
  traineeId: z.string().min(1),
  bandStatus: cohortBandStatusSchema,
  sessions: z.array(evidenceSessionSchema),
});

export const domainHintSchema = z.object({
  domain: antsDomainSchema,
  delta: z.number(),
  direction: z.enum(["up", "down", "flat"]),
});

export const trendPointSchema = z.object({
  sessionId: z.string().uuid(),
  createdAtMs: z.number().int().nonnegative(),
  technicalPercent: z.number().min(0).max(100),
  overallAnts: z.number().min(1).max(5).nullable(),
  clinicallyReviewed: z.boolean(),
});

export const traineeTrendResponseSchema = z.object({
  traineeId: z.string().min(1),
  series: z.array(trendPointSchema),
  overallDrift: overallDriftSchema,
  domainHints: z.array(domainHintSchema),
  bandStatus: cohortBandStatusSchema,
});

export type EvidenceSession = z.infer<typeof evidenceSessionSchema>;
export type TraineeEvidenceResponse = z.infer<typeof traineeEvidenceResponseSchema>;
export type TraineeTrendResponse = z.infer<typeof traineeTrendResponseSchema>;
