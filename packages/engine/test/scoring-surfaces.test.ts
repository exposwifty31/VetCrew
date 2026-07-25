import { describe, expect, test } from "vitest";

import {
  buildTraineeTrend,
  cohortBandStatus,
  overallAnts,
  technicalPercent,
} from "../src/scoring-surfaces.js";

describe("overallAnts", () => {
  test("returns null for empty input (not zero-filled)", () => {
    expect(overallAnts([])).toBeNull();
  });

  test("means rated domains only", () => {
    expect(overallAnts([3, 4, 5])).toBe(4);
    expect(overallAnts([3, 4])).toBe(3.5);
  });
});

describe("technicalPercent", () => {
  test("prefers checklist when maxScore > 0", () => {
    expect(
      technicalPercent(
        { items: [], score: 2, maxScore: 4, percent: 50 },
        { results: [], passedCount: 9, totalCount: 10, escalation: null },
      ),
    ).toBe(50);
  });

  test("falls back to task pass rate when checklist is empty", () => {
    expect(
      technicalPercent(
        { items: [], score: 0, maxScore: 0, percent: 0 },
        { results: [], passedCount: 9, totalCount: 10, escalation: null },
      ),
    ).toBe(90);
  });
});

describe("cohortBandStatus", () => {
  test("always withholds cross-person bands in Sprint 5", () => {
    expect(cohortBandStatus(0)).toBe("cohort_insufficient");
    expect(cohortBandStatus(100)).toBe("cohort_insufficient");
  });
});

describe("buildTraineeTrend", () => {
  test("orders by time-in-training then createdAt", () => {
    const model = buildTraineeTrend([
      {
        sessionId: "b",
        createdAtMs: 2,
        timeInTrainingDays: 90,
        technicalPercent: 80,
        overallAnts: 4,
        clinicallyReviewed: false,
      },
      {
        sessionId: "a",
        createdAtMs: 1,
        timeInTrainingDays: 30,
        technicalPercent: 50,
        overallAnts: 3,
        clinicallyReviewed: false,
      },
    ]);
    expect(model.series.map((p) => p.sessionId)).toEqual(["a", "b"]);
    expect(model.overallDrift).toBe("up");
    expect(model.bandStatus).toBe("cohort_insufficient");
  });

  test("single point has no drift", () => {
    const model = buildTraineeTrend([
      {
        sessionId: "a",
        createdAtMs: 1,
        timeInTrainingDays: 30,
        technicalPercent: 70,
        overallAnts: 3,
        clinicallyReviewed: false,
      },
    ]);
    expect(model.overallDrift).toBe("none");
    expect(model.domainHints).toEqual([]);
  });

  test("domain hints are directional and do not alone set overallDrift when technical is flat", () => {
    const model = buildTraineeTrend([
      {
        sessionId: "a",
        createdAtMs: 1,
        timeInTrainingDays: 30,
        technicalPercent: 70,
        overallAnts: 3,
        domainScores: { situation_awareness: 4, decision_making: 2 },
        clinicallyReviewed: false,
      },
      {
        sessionId: "b",
        createdAtMs: 2,
        timeInTrainingDays: 60,
        technicalPercent: 70,
        overallAnts: 3,
        domainScores: { situation_awareness: 2, decision_making: 4 },
        clinicallyReviewed: false,
      },
    ]);
    expect(model.overallDrift).toBe("none");
    expect(model.domainHints.length).toBe(2);
    const sa = model.domainHints.find((h) => h.domain === "situation_awareness");
    expect(sa?.direction).toBe("down");
  });
});
