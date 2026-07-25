import type { EngineEvent, SessionPhase } from "./events.js";
import { prngInit, prngNext } from "./prng.js";

/**
 * Pure reducer: (state, event) => state.
 * No Date.now, no Math.random, no I/O, no network (CLAUDE.md §3).
 * Sprint 0 scope: FSM phase, session clock, PRNG threading, applied-event
 * bookkeeping, and one PRNG-driven vital to prove seed-sensitivity end to end.
 * The scenario deterioration model lands in Sprint 1.
 */

export interface EngineState {
  readonly seed: number;
  readonly prng: number;
  readonly timeMs: number;
  readonly phase: SessionPhase;
  readonly appliedSeq: number;
  readonly vitals: {
    readonly hr: number;
  };
  readonly actionCount: number;
  readonly activeInjections: readonly string[];
}

export function createInitialState(seed: number): EngineState {
  return {
    seed,
    prng: prngInit(seed),
    timeMs: 0,
    phase: "draft",
    appliedSeq: 0,
    vitals: { hr: 80 },
    actionCount: 0,
    activeInjections: [],
  };
}

export function reduce(state: EngineState, event: EngineEvent): EngineState {
  switch (event.type) {
    case "tick": {
      if (state.phase !== "running") {
        return { ...state, appliedSeq: event.seq, timeMs: state.timeMs };
      }
      const draw = prngNext(state.prng);
      // ±1 bpm deterministic jitter; placeholder physiology until Sprint 1.
      const hr = Math.round((state.vitals.hr + (draw.value * 2 - 1)) * 100) / 100;
      return {
        ...state,
        prng: draw.state,
        timeMs: state.timeMs + event.dtMs,
        vitals: { hr },
        appliedSeq: event.seq,
      };
    }
    case "action":
      return {
        ...state,
        actionCount: state.actionCount + 1,
        appliedSeq: event.seq,
      };
    case "injection":
      return {
        ...state,
        activeInjections: [...state.activeInjections, event.injection],
        appliedSeq: event.seq,
      };
    case "phase_change":
      return { ...state, phase: event.phase, appliedSeq: event.seq };
    default: {
      const exhaustive: never = event;
      throw new Error(`Unhandled event: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Rebuild state from the authoritative event log. */
export function replay(seed: number, events: readonly EngineEvent[]): EngineState {
  let state = createInitialState(seed);
  for (const event of events) {
    state = reduce(state, event);
  }
  return state;
}
