import type { AntsDomain } from "@vetcrew/shared";
import { authoredScenarioSchema, type AuthoredScenario } from "@vetcrew/shared";

import type { Db } from "../../db/client.js";
import { loadScenarioFiles, syncScenarios } from "../../scenarios.js";

/**
 * An assessment-mode scenario for tests.
 *
 * The two shipped scenarios are `practice`, and practice sessions never reach
 * `scored` (CLAUDE.md §4 — the lifecycle forks on mode), so anything exercising
 * the scoring path needs assessment content. Deriving it from a real scenario
 * file keeps it a genuinely valid scenario rather than a hand-rolled stub that
 * could drift from the authored contract.
 *
 * The first *real* assessment scenario is the merge of the two shipped ones and
 * is a separate piece of work; this fixture exists so the rules can be tested
 * before that content is authored.
 */
export const ASSESSMENT_SLUG = "test-assessment-scenario";

/** An assessment must declare at least three domains (D2, as amended). */
export const ASSESSMENT_DOMAINS: readonly AntsDomain[] = [
  "task_management",
  "situation_awareness",
  "decision_making",
];

/** A vet, the Reviewer, and a senior technician who is not the mentor (§1.6). */
export const ASSESSMENT_RATERS = ["rater-vet", "rater-reviewer", "rater-senior-tech"] as const;

export function buildAssessmentScenario(): AuthoredScenario {
  const base = loadScenarioFiles().find((s) => s.slug === "base-rung-resp-distress");
  if (base === undefined) throw new Error("base-rung-resp-distress fixture scenario missing");
  return authoredScenarioSchema.parse({
    ...base,
    slug: ASSESSMENT_SLUG,
    mode: "assessment",
    // Assessment pins its seed so every candidate faces an identical run.
    seed: 424242,
    scoringDimensions: [...ASSESSMENT_DOMAINS],
  });
}

export async function seedAssessmentScenario(db: Db, tenantId: string): Promise<void> {
  await syncScenarios(db, tenantId, [buildAssessmentScenario()]);
}
