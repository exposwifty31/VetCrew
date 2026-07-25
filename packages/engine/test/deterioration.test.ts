import { describe, expect, test } from "vitest";

import {
  createInitialState,
  reduce,
  replay,
  type EngineEvent,
  type EngineState,
  type ScenarioDef,
} from "../src/index.js";

/**
 * Sprint 1 — deterioration model. The scenario compiles to reducer-evaluable
 * params: each vital drifts toward a target at a rate; triggers (timed /
 * action / injection) swap targets and rates. NOT a per-second script.
 */

/** Hypoxic patient: SpO2 falls untreated; oxygen supplementation recovers it. */
const HYPOXIA: ScenarioDef = {
  slug: "test-hypoxia",
  version: "0.0.1",
  vitals: {
    spo2: { initial: 95, target: 78, ratePerSec: 0.5, jitter: 0 },
    hr: { initial: 90, target: 150, ratePerSec: 1, jitter: 0.5 },
  },
  triggers: [
    {
      id: "oxygen-recovers-spo2",
      on: { kind: "action", action: "oxygen_on" },
      effects: [{ vital: "spo2", target: 97, ratePerSec: 1 }],
    },
    {
      id: "decompensation-at-60s",
      on: { kind: "time", atMs: 60_000 },
      effects: [{ vital: "spo2", target: 60, ratePerSec: 2 }],
    },
    {
      id: "nibp-artifact",
      on: { kind: "injection", injection: "hr_spike" },
      effects: [{ vital: "hr", target: 190, ratePerSec: 10 }],
    },
  ],
};

let nextSeq = 0;
function seq(): number {
  return ++nextSeq;
}

function start(): EngineState {
  nextSeq = 0;
  let state = createInitialState(42, HYPOXIA);
  state = reduce(state, { seq: seq(), type: "phase_change", phase: "briefing" });
  state = reduce(state, { seq: seq(), type: "phase_change", phase: "running" });
  return state;
}

function ticks(state: EngineState, count: number, dtMs = 1000): EngineState {
  for (let i = 0; i < count; i++) {
    state = reduce(state, { seq: seq(), type: "tick", dtMs });
  }
  return state;
}

describe("deterioration model", () => {
  test("vitals initialize from the scenario", () => {
    const state = createInitialState(42, HYPOXIA);
    expect(state.vitals["spo2"]?.value).toBe(95);
    expect(state.vitals["hr"]?.value).toBe(90);
  });

  test("untreated vital drifts toward its target at its rate", () => {
    const state = ticks(start(), 10);
    // 10s at 0.5/s => spo2 fell by ~5 (jitter 0 makes it exact)
    expect(state.vitals["spo2"]?.value).toBeCloseTo(90, 5);
  });

  test("vital clamps at target instead of overshooting", () => {
    // 50 ticks: past the 34s needed to reach target 78, before the 60s trigger.
    const state = ticks(start(), 50);
    expect(state.vitals["spo2"]?.value).toBe(78);
  });

  test("action trigger swaps target and rate: oxygen recovers SpO2", () => {
    let state = ticks(start(), 10); // spo2 ~90, falling
    state = reduce(state, {
      seq: seq(),
      type: "action",
      role: "technician",
      actorId: "tech-1",
      action: "oxygen_on",
    });
    state = ticks(state, 10); // now rising at 1/s toward 97
    const spo2 = state.vitals["spo2"]?.value;
    expect(spo2).toBeGreaterThan(90);
    expect(spo2).toBeLessThanOrEqual(97);
  });

  test("unrelated actions do not fire triggers", () => {
    let state = ticks(start(), 10);
    state = reduce(state, {
      seq: seq(),
      type: "action",
      role: "technician",
      actorId: "tech-1",
      action: "check_chart",
    });
    state = ticks(state, 10);
    expect(state.vitals["spo2"]?.value).toBeCloseTo(85, 5);
  });

  test("timed trigger fires once when session time crosses its boundary", () => {
    let state = ticks(start(), 59); // 59s: not yet fired; spo2 clamped at 78
    expect(state.firedTriggerIds).not.toContain("decompensation-at-60s");
    expect(state.vitals["spo2"]?.value).toBe(78);
    state = ticks(state, 1); // crosses 60s: target drops to 60, rate 2/s
    expect(state.firedTriggerIds).toContain("decompensation-at-60s");
    // The crossing tick already integrates at the new rate (78 -> 76),
    // and each following tick drops another 2/s.
    expect(state.vitals["spo2"]?.value).toBeCloseTo(76, 5);
    state = ticks(state, 2);
    expect(state.vitals["spo2"]?.value).toBeCloseTo(72, 5);
  });

  test("injection trigger applies its effects", () => {
    let state = start();
    state = reduce(state, { seq: seq(), type: "injection", injection: "hr_spike" });
    state = ticks(state, 5);
    // hr rises at 10/s toward 190 (± small jitter)
    expect(state.vitals["hr"]?.value).toBeGreaterThan(130);
  });

  test("triggers fire at most once", () => {
    let state = start();
    state = reduce(state, {
      seq: seq(),
      type: "action",
      role: "technician",
      actorId: "tech-1",
      action: "oxygen_on",
    });
    state = reduce(state, {
      seq: seq(),
      type: "action",
      role: "technician",
      actorId: "tech-1",
      action: "oxygen_on",
    });
    expect(state.firedTriggerIds.filter((id) => id === "oxygen-recovers-spo2")).toHaveLength(1);
  });

  test("no ticks are applied outside the running phase", () => {
    let state = createInitialState(42, HYPOXIA);
    state = ticks(state, 10); // still draft
    expect(state.vitals["spo2"]?.value).toBe(95);
    expect(state.timeMs).toBe(0);
  });

  test("determinism holds over the full scenario with mixed events", () => {
    const events: EngineEvent[] = [
      { seq: 1, type: "phase_change", phase: "briefing" },
      { seq: 2, type: "phase_change", phase: "running" },
    ];
    let s = 2;
    for (let i = 0; i < 90; i++) {
      events.push({ seq: ++s, type: "tick", dtMs: 1000 });
      if (i === 20) {
        events.push({ seq: ++s, type: "injection", injection: "hr_spike" });
      }
      if (i === 40) {
        events.push({
          seq: ++s,
          type: "action",
          role: "technician",
          actorId: "tech-1",
          action: "oxygen_on",
        });
      }
    }
    const a = replay(1234, events, HYPOXIA);
    const b = replay(1234, events, HYPOXIA);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = replay(1235, events, HYPOXIA);
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a)); // hr jitter is seeded
  });
});
