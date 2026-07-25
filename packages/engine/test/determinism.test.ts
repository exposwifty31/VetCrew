import { describe, expect, test } from "vitest";

import {
  createInitialState,
  reduce,
  replay,
  type EngineEvent,
  type ScenarioDef,
} from "../src/index.js";

/**
 * The determinism golden test — CLAUDE.md §3 non-negotiable:
 * same seed + same event sequence => byte-identical state.
 * This is the engine's acceptance gate; it runs in CI on every engine change.
 */

const SCENARIO: ScenarioDef = {
  slug: "test-golden",
  version: "0.0.1",
  vitals: {
    hr: { initial: 80, target: 140, ratePerSec: 0.8, jitter: 0.5 },
    spo2: { initial: 96, target: 85, ratePerSec: 0.3, jitter: 0.2 },
  },
  triggers: [
    {
      id: "artifact",
      on: { kind: "injection", injection: "nibp_artifact" },
      effects: [{ vital: "hr", jitter: 3 }],
    },
  ],
};

function fixtureEvents(): EngineEvent[] {
  const events: EngineEvent[] = [];
  let seq = 1;
  events.push({ seq: seq++, type: "phase_change", phase: "briefing" });
  events.push({ seq: seq++, type: "phase_change", phase: "running" });
  for (let i = 0; i < 50; i++) {
    events.push({ seq: seq++, type: "tick", dtMs: 1000 });
    if (i % 10 === 3) {
      events.push({
        seq: seq++,
        type: "action",
        role: "technician",
        actorId: "tech-1",
        action: "task_step",
        payload: { step: i },
      });
    }
    if (i === 25) {
      events.push({ seq: seq++, type: "injection", injection: "nibp_artifact" });
    }
  }
  events.push({ seq: seq++, type: "phase_change", phase: "debrief" });
  return events;
}

function runAll(seed: number, events: EngineEvent[]) {
  let state = createInitialState(seed, SCENARIO);
  for (const event of events) {
    state = reduce(state, event);
  }
  return state;
}

describe("engine determinism", () => {
  test("same seed + same events => byte-identical state", () => {
    const events = fixtureEvents();
    const a = runAll(42, events);
    const b = runAll(42, events);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("different seed => different randomness-driven state", () => {
    const events = fixtureEvents();
    const a = runAll(42, events);
    const b = runAll(43, events);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  test("replay(seed, events) rebuilds the incremental fold exactly", () => {
    const events = fixtureEvents();
    const incremental = runAll(42, events);
    const replayed = replay(42, events, SCENARIO);
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(incremental));
  });

  test("reduce is pure: no input state is mutated across the entire fixture", () => {
    const events = fixtureEvents();
    let state = createInitialState(42, SCENARIO);
    for (const event of events) {
      const snapshot = JSON.stringify(state);
      const next = reduce(state, event);
      expect(JSON.stringify(state)).toBe(snapshot);
      state = next;
    }
  });

  test("state is JSON-serializable (no functions, no Date, no undefined holes)", () => {
    const state = runAll(7, fixtureEvents());
    const roundTripped: unknown = JSON.parse(JSON.stringify(state));
    expect(roundTripped).toEqual(state);
  });
});
