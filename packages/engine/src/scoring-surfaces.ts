import type { ChecklistResult } from "./checklist.js";
import type { TaskEvaluation } from "./evaluate-tasks.js";

/**
 * Pure scoring-surface helpers for manager evidence views (Sprint 5a).
 * No I/O. No ML. Cross-person readiness bands are withheld until cohort N exists.
 */

export type CohortBandStatus = "cohort_insufficient";
export type OverallDrift = "none" | "up" | "down";

/**
 * Prefer weighted checklist % when authored; fall back to task expected-vs-actual
 * pass rate for base-rung scenarios with an empty checklist (Scenario #2).
 */
export function technicalPercent(
  checklist: ChecklistResult,
  tasks: TaskEvaluation,
): number {
  if (checklist.maxScore > 0) return checklist.percent;
  if (tasks.totalCount > 0) {
    return Math.round((tasks.passedCount / tasks.totalCount) * 100);
  }
  return 0;
}

export interface TrendPointInput {
  readonly sessionId: string;
  readonly createdAtMs: number;
  readonly timeInTrainingDays: number;
  readonly technicalPercent: number;
  readonly overallAnts: number | null;
  /** Per-domain scores for directional hints only — never drives overallDrift. */
  readonly domainScores?: Readonly<Record<string, number>> | undefined;
  readonly clinicallyReviewed: boolean;
}

export interface DomainHint {
  readonly domain: string;
  readonly delta: number;
  readonly direction: "up" | "down" | "flat";
}

export interface TraineeTrendModel {
  readonly series: readonly TrendPointInput[];
  readonly overallDrift: OverallDrift;
  readonly domainHints: readonly DomainHint[];
  readonly bandStatus: CohortBandStatus;
}

/** Arithmetic mean of present 1–5 domain scores; null if empty (not zero-filled). */
export function overallAnts(domainScores: readonly number[]): number | null {
  if (domainScores.length === 0) return null;
  let sum = 0;
  for (const score of domainScores) {
    sum += score;
  }
  return Math.round((sum / domainScores.length) * 10) / 10;
}

/**
 * Sprint 5: always withhold cross-person bands — no synthetic norms.
 * Argument reserved for a future cohort-size gate.
 */
export function cohortBandStatus(_n: number): CohortBandStatus {
  return "cohort_insufficient";
}

function driftFromSeries(values: readonly (number | null)[]): OverallDrift {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return "none";
  const first = present[0];
  const last = present[present.length - 1];
  if (first === undefined || last === undefined) return "none";
  const delta = last - first;
  if (Math.abs(delta) < 0.05) return "none";
  return delta > 0 ? "up" : "down";
}

/**
 * Within-person trend. Overall drift uses technical % primarily, then overall
 * ANTS if technical is flat. Domain hints are directional only.
 */
export function buildTraineeTrend(points: readonly TrendPointInput[]): TraineeTrendModel {
  const series = [...points].sort((a, b) => {
    if (a.timeInTrainingDays !== b.timeInTrainingDays) {
      return a.timeInTrainingDays - b.timeInTrainingDays;
    }
    return a.createdAtMs - b.createdAtMs;
  });

  const technicalDrift = driftFromSeries(series.map((p) => p.technicalPercent));
  const antsDrift = driftFromSeries(series.map((p) => p.overallAnts));
  const overallDrift: OverallDrift =
    technicalDrift !== "none" ? technicalDrift : antsDrift;

  const domainHints: DomainHint[] = [];
  if (series.length >= 2) {
    const first = series[0];
    const last = series[series.length - 1];
    if (first?.domainScores !== undefined && last?.domainScores !== undefined) {
      const domains = new Set([
        ...Object.keys(first.domainScores),
        ...Object.keys(last.domainScores),
      ]);
      for (const domain of domains) {
        const a = first.domainScores[domain];
        const b = last.domainScores[domain];
        if (a === undefined || b === undefined) continue;
        const delta = Math.round((b - a) * 10) / 10;
        const direction: DomainHint["direction"] =
          Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
        domainHints.push({ domain, delta, direction });
      }
    }
  }

  return {
    series,
    overallDrift,
    domainHints,
    bandStatus: cohortBandStatus(series.length),
  };
}
