import type { EngineEvent, SessionPhase } from "./events.js";
import { canTransition } from "./fsm.js";
import { prngInit, prngNext } from "./prng.js";
import type { ScenarioDef, TriggerDef, VitalEffect } from "./scenario.js";

/**
 * Pure reducer: (state, event) => state.
 * No Date.now, no Math.random, no I/O, no network (CLAUDE.md §3).
 * Time enters as tick events; randomness via the PRNG threaded through state.
 */

export interface VitalState {
  readonly value: number;
  readonly target: number;
  readonly ratePerSec: number;
  readonly jitter: number;
}

export interface EngineState {
  readonly seed: number;
  readonly prng: number;
  readonly timeMs: number;
  readonly phase: SessionPhase;
  readonly appliedSeq: number;
  /** Scenario is embedded so reduce stays (state, event) => state. */
  readonly scenario: ScenarioDef;
  readonly vitals: Readonly<Record<string, VitalState>>;
  readonly firedTriggerIds: readonly string[];
  readonly actionCount: number;
  readonly activeInjections: readonly string[];
}

export function createInitialState(seed: number, scenario: ScenarioDef): EngineState {
  const vitals: Record<string, VitalState> = {};
  for (const [name, params] of Object.entries(scenario.vitals)) {
    vitals[name] = {
      value: params.initial,
      target: params.target,
      ratePerSec: params.ratePerSec,
      jitter: params.jitter,
    };
  }
  return {
    seed,
    prng: prngInit(seed),
    timeMs: 0,
    phase: "draft",
    appliedSeq: 0,
    scenario,
    vitals,
    firedTriggerIds: [],
    actionCount: 0,
    activeInjections: [],
  };
}

function applyEffects(
  vitals: Readonly<Record<string, VitalState>>,
  effects: readonly VitalEffect[],
): Record<string, VitalState> {
  const next = { ...vitals };
  for (const effect of effects) {
    const current = next[effect.vital];
    if (current === undefined) continue; // effect on a vital the scenario doesn't define
    next[effect.vital] = {
      ...current,
      ...(effect.target !== undefined ? { target: effect.target } : {}),
      ...(effect.ratePerSec !== undefined ? { ratePerSec: effect.ratePerSec } : {}),
      ...(effect.jitter !== undefined ? { jitter: effect.jitter } : {}),
    };
  }
  return next;
}

interface TriggerResult {
  readonly vitals: Readonly<Record<string, VitalState>>;
  readonly firedTriggerIds: readonly string[];
}

function fireTriggers(
  state: EngineState,
  matches: (trigger: TriggerDef) => boolean,
): TriggerResult {
  let vitals = state.vitals;
  let fired = state.firedTriggerIds;
  for (const trigger of state.scenario.triggers) {
    if (fired.includes(trigger.id) || !matches(trigger)) continue;
    vitals = applyEffects(vitals, trigger.effects);
    fired = [...fired, trigger.id];
  }
  return { vitals, firedTriggerIds: fired };
}

export function reduce(state: EngineState, event: EngineEvent): EngineState {
  switch (event.type) {
    case "tick": {
      if (state.phase !== "running") {
        return { ...state, appliedSeq: event.seq };
      }
      const timeMs = state.timeMs + event.dtMs;
      const afterTimed = fireTriggers(
        { ...state, timeMs },
        (trigger) => trigger.on.kind === "time" && trigger.on.atMs <= timeMs,
      );

      // Integrate every vital: bounded drift toward target + seeded jitter.
      // One PRNG draw per vital per tick keeps the draw count structural.
      let prng = state.prng;
      const vitals: Record<string, VitalState> = {};
      for (const [name, vital] of Object.entries(afterTimed.vitals)) {
        const maxStep = vital.ratePerSec * (event.dtMs / 1000);
        const delta = Math.max(-maxStep, Math.min(maxStep, vital.target - vital.value));
        const draw = prngNext(prng);
        prng = draw.state;
        const noise = vital.jitter * (draw.value * 2 - 1);
        vitals[name] = { ...vital, value: vital.value + delta + noise };
      }

      return {
        ...state,
        prng,
        timeMs,
        vitals,
        firedTriggerIds: afterTimed.firedTriggerIds,
        appliedSeq: event.seq,
      };
    }
    case "action": {
      // Like ticks, actions only affect the sim while running; a callout
      // logged during pause/debrief stays in the record but moves nothing.
      if (state.phase !== "running") {
        return { ...state, appliedSeq: event.seq };
      }
      const result = fireTriggers(
        state,
        (trigger) => trigger.on.kind === "action" && trigger.on.action === event.action,
      );
      return {
        ...state,
        vitals: result.vitals,
        firedTriggerIds: result.firedTriggerIds,
        actionCount: state.actionCount + 1,
        appliedSeq: event.seq,
      };
    }
    case "injection": {
      if (state.phase !== "running") {
        return { ...state, appliedSeq: event.seq };
      }
      const result = fireTriggers(
        state,
        (trigger) => trigger.on.kind === "injection" && trigger.on.injection === event.injection,
      );
      return {
        ...state,
        vitals: result.vitals,
        firedTriggerIds: result.firedTriggerIds,
        activeInjections: [...state.activeInjections, event.injection],
        appliedSeq: event.seq,
      };
    }
    case "phase_change":
      // FSM guard (CLAUDE.md §4): an illegal transition stays in the log as
      // the record of the attempt, but state refuses to move.
      if (!canTransition(state.phase, event.phase)) {
        return { ...state, appliedSeq: event.seq };
      }
      return { ...state, phase: event.phase, appliedSeq: event.seq };
    default: {
      const exhaustive: never = event;
      throw new Error(`Unhandled event: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Rebuild state from the authoritative event log. */
export function replay(
  seed: number,
  events: readonly EngineEvent[],
  scenario: ScenarioDef,
): EngineState {
  let state = createInitialState(seed, scenario);
  for (const event of events) {
    state = reduce(state, event);
  }
  return state;
}
