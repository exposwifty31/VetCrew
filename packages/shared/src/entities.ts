import { z } from "zod";

import { sessionPhaseSchema } from "./contracts.js";

/**
 * Entity contracts. Every entity is tenant-scoped (CLAUDE.md §4 / §7:
 * SaaS-shaped data model even with one hospital).
 */

/**
 * Which platform a scenario belongs to (CLAUDE.md §1.1, D3).
 *
 * Mode is declared on the *scenario file*, never chosen per session: training
 * and qualification are different content, not one scenario in two settings.
 * It never enters `EngineState` — content metadata must not be able to alter
 * replay — so it follows the `clinicallyReviewed` precedent exactly: authored
 * field, mirrored column, read only by policy code.
 *
 * - `assessment` — locked. The examiner observes; pause and inject are refused
 *   at the transport layer. Runs `debrief → scored → archived`.
 * - `practice` — instructor has full flexibility. Never reaches `scored`.
 * - `tutorial` — the unscored familiarisation run (§1.5). Never reaches `scored`.
 */
export const scenarioModeSchema = z.enum(["assessment", "practice", "tutorial"]);

export type ScenarioMode = z.infer<typeof scenarioModeSchema>;

export const scenarioSchema = z
  .object({
    id: z.uuid(),
    tenantId: z.uuid(),
    slug: z.string().min(1),
    /** Scenario content version; every score records the version used. */
    version: z.string().min(1),
    mode: scenarioModeSchema,
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

export const simSessionSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  scenarioId: z.uuid(),
  scenarioVersion: z.string().min(1),
  /** PRNG seed — u32, stored per session for reproducible replay. */
  seed: z.number().int().nonnegative().max(4294967295),
  phase: sessionPhaseSchema,
  /**
   * Mode RESOLVED FROM THE SCENARIO AT CREATION and frozen here, exactly as
   * `scenarioVersion` already is. This does not weaken D3 — mode is still
   * declared on the scenario and never chosen per session — it closes the
   * mutability hole: scenario rows are re-synced from disk on every boot
   * (`syncScenarios` upserts on (tenant, slug, version)), so reading mode from
   * the live scenario row would let an edit to a file silently restate the mode
   * of every past session that used it. Policy reads the session's copy.
   */
  mode: scenarioModeSchema,
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
  /** Whose judgment this is — the assigned rater, always. */
  raterId: z.string().min(1),
  /**
   * Who physically entered it. Defaults to `raterId`; differs only for a
   * proxied entry (CLAUDE.md §1.6 — the Reviewer is 65, non-technical, and
   * will never log in). Without this field the only two outcomes were "the
   * three-rater model never runs" or "the record names the wrong person",
   * making the packet's most important claim false. A proxied rating is
   * honest, visible in the packet, and countable.
   */
  submittedByUserId: z.string().min(1),
  domain: antsDomainSchema,
  /** 1–5; per-domain scores are directional only (CLAUDE.md §4). */
  score: z.number().int().min(1).max(5),
  /** Traceability: the event seqs this rating is evidence-linked to. */
  evidenceEventSeqs: z.array(z.number().int().positive()).min(1),
});

export type AntsRating = z.infer<typeof antsRatingSchema>;
