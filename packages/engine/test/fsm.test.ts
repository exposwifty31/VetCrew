import { describe, expect, test } from "vitest";

import {
  PHASE_TRANSITIONS,
  SESSION_PHASES,
  canTransition,
  createInitialState,
  reduce,
  type ScenarioDef,
} from "../src/index.js";

/** The lifecycle FSM (CLAUDE.md §4) — explicit state machine, not a string column. */

const SCENARIO: ScenarioDef = {
  slug: "fsm-test",
  version: "0.0.1",
  vitals: { spo2: { initial: 95, target: 80, ratePerSec: 0.5, jitter: 0 } },
  triggers: [],
};

describe("phase transition table", () => {
  test("covers every phase exactly once", () => {
    expect(Object.keys(PHASE_TRANSITIONS).sort()).toEqual([...SESSION_PHASES].sort());
  });

  test("encodes the doctrine lifecycle", () => {
    expect(canTransition("draft", "briefing")).toBe(true);
    expect(canTransition("briefing", "running")).toBe(true);
    expect(canTransition("running", "paused")).toBe(true);
    expect(canTransition("paused", "running")).toBe(true);
    expect(canTransition("running", "debrief")).toBe(true);
    expect(canTransition("paused", "debrief")).toBe(true);
    expect(canTransition("debrief", "scored")).toBe(true);
    expect(canTransition("scored", "archived")).toBe(true);
  });

  test("rejects skips, reversals, and terminal exits", () => {
    expect(canTransition("draft", "running")).toBe(false);
    expect(canTransition("draft", "scored")).toBe(false);
    expect(canTransition("running", "draft")).toBe(false);
    expect(canTransition("debrief", "running")).toBe(false);
    expect(canTransition("scored", "running")).toBe(false);
    expect(canTransition("archived", "draft")).toBe(false);
  });
});

describe("reducer FSM guard", () => {
  test("an illegal phase_change advances appliedSeq but does not move the phase", () => {
    const state = createInitialState(1, SCENARIO);
    const next = reduce(state, { seq: 1, type: "phase_change", phase: "scored" });
    expect(next.phase).toBe("draft");
    expect(next.appliedSeq).toBe(1);
  });

  test("a legal chain walks the full lifecycle", () => {
    let state = createInitialState(1, SCENARIO);
    const chain = ["briefing", "running", "paused", "running", "debrief", "scored", "archived"] as const;
    let seq = 0;
    for (const phase of chain) {
      state = reduce(state, { seq: ++seq, type: "phase_change", phase });
      expect(state.phase).toBe(phase);
    }
  });
});
