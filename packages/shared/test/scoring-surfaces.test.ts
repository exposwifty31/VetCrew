import { describe, expect, test } from "vitest";

import {
  evidenceSessionSchema,
  traineeEvidenceResponseSchema,
  traineeTrendResponseSchema,
} from "../src/scoring-surfaces.js";

describe("scoring surface contracts", () => {
  test("rejects invalid ANTS overall and accepts empty evidence lists", () => {
    expect(
      evidenceSessionSchema.safeParse({
        sessionId: "11111111-1111-4111-8111-111111111111",
        phase: "scored",
        scenarioSlug: "s",
        scenarioVersion: "0.1.0",
        clinicallyReviewed: false,
        traineeTimeInTrainingDays: 30,
        technicalPercent: 70,
        overallAnts: 0,
        ratedDomainCount: 1,
        createdAt: new Date().toISOString(),
      }).success,
    ).toBe(false);

    const empty = traineeEvidenceResponseSchema.safeParse({
      traineeId: "pitch-trainee",
      bandStatus: "cohort_insufficient",
      sessions: [],
    });
    expect(empty.success).toBe(true);
  });

  test("trend always carries cohort_insufficient — no hiring band enum", () => {
    const parsed = traineeTrendResponseSchema.safeParse({
      traineeId: "pitch-trainee",
      series: [],
      overallDrift: "none",
      domainHints: [],
      bandStatus: "cohort_insufficient",
    });
    expect(parsed.success).toBe(true);
    expect(
      traineeTrendResponseSchema.safeParse({
        traineeId: "x",
        series: [],
        overallDrift: "none",
        domainHints: [],
        bandStatus: "ready",
      }).success,
    ).toBe(false);
  });
});
