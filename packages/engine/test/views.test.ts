import { describe, expect, test } from "vitest";

import { replay, roleView } from "../src/index.js";
import { TASK_SCENARIO, fullRunEvents } from "./fixtures/task-scenario.js";

/**
 * The partial-view leak gate (CLAUDE.md §4 + SRS §5): nothing that encodes a
 * correct answer or the scenario's trajectory may survive serialization of a
 * trainee view. This is a hard acceptance criterion, not a convention.
 */

const FORBIDDEN_KEYS = [
  // correct-answer data on task defs
  "expectedMin",
  "expectedMax",
  "expectedOptionId",
  "expectedMl",
  "expectedRouteId",
  "criticalRouteIds",
  "expectedOptionIds",
  "expectedOrder",
  "expectedSetId",
  "dropsPerMl",
  "abnormalityTriggerId",
  // trajectory / internals
  "target",
  "ratePerSec",
  "jitter",
  "prng",
  "seed",
  "firedTriggerIds",
  "activeInjections",
  "triggers",
];

function collectKeys(value: unknown, keys: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
  } else if (typeof value === "object" && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
}

describe("roleView (technician partial view)", () => {
  const state = replay(42, fullRunEvents(), TASK_SCENARIO);
  const view = roleView(state, "technician");

  test("no answer-bearing or trajectory key survives serialization", () => {
    const keys = new Set<string>();
    collectKeys(JSON.parse(JSON.stringify(view)), keys);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys.has(forbidden), `leaked key: ${forbidden}`).toBe(false);
    }
  });

  test("vitals are current values only", () => {
    expect(typeof view.vitals["hr"]).toBe("number");
    expect(typeof view.vitals["sys_bp"]).toBe("number");
  });

  test("tasks expose lifecycle, presentation data, and the trainee's own entries", () => {
    const t3 = view.tasks.find((t) => t.id === "t3");
    expect(t3?.lifecycle).toBe("done");
    expect(t3?.submission).toEqual({ kind: "med_admin", ml: 0.2, routeId: "iv" });
    expect(t3?.body.kind).toBe("med_admin");
    if (t3?.body.kind === "med_admin") {
      // Vial-label context is GIVEN; the arithmetic is not.
      expect(t3.body.doseMg).toBe(20);
      expect(t3.body.concentrationMgPerMl).toBe(100);
      expect(t3.body.routes).toHaveLength(3);
    }
  });

  test("the hidden T7 task is marked hidden so no rail chip announces it", () => {
    const t7 = view.tasks.find((t) => t.id === "t7");
    expect(t7?.hidden).toBe(true);
  });

  test("view carries the reconnect cursor and session identity", () => {
    expect(view.seq).toBe(state.appliedSeq);
    expect(view.phase).toBe("debrief");
    expect(view.species).toBe("dog");
    expect(view.scenarioSlug).toBe("test-task-rung");
  });
});
