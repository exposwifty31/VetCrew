import type { EngineEvent, SessionPhase } from "./events.js";
import { canTransition } from "./fsm.js";
import { prngInit, prngNext } from "./prng.js";
import type { ScenarioDef, TriggerDef, VitalEffect } from "./scenario.js";
import { createTaskRuntime, type TaskRuntimeState } from "./tasks.js";

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
  /** Fired injection ids with sim clock at fire — instructor projection only. */
  readonly activeInjections: readonly { readonly id: string; readonly atMs: number }[];
  /** Lifecycle + verbatim submissions per task — never correctness (SRS §5). */
  readonly tasks: Readonly<Record<string, TaskRuntimeState>>;
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
    tasks: createTaskRuntime(scenario.tasks ?? []),
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

/**
 * Known model limit (recorded 2026-07-30): vitals are INDEPENDENT. Each drifts
 * toward its own target at its own rate; triggers retarget them, and actions
 * and inaction are both expressed by which triggers do or do not fire. What is
 * absent is cross-vital feedback — a falling SpO2 does not itself drive HR up.
 * A scenario author reproduces coupling by hand, by giving one trigger effects
 * on several vitals.
 *
 * That is adequate for the base rung, where the assessed competency is the
 * technician's decision sequence, not the physiology. It becomes wrong the
 * moment a scenario is meant to teach a physiological *relationship* — then add
 * a coupling term here rather than asking authors to fake it per trigger.
 * Do not pre-build it; it buys nothing until such a scenario exists.
 */
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
        activeInjections: [
          ...state.activeInjections,
          { id: event.injection, atMs: state.timeMs },
        ],
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
    case "task_start": {
      const task = state.tasks[event.taskId];
      // Illegal lifecycle moves stay in the log as the record of the attempt
      // (same posture as the FSM guard) but move nothing.
      if (state.phase !== "running" || task === undefined || task.lifecycle !== "available") {
        return { ...state, appliedSeq: event.seq };
      }
      return {
        ...state,
        tasks: {
          ...state.tasks,
          [event.taskId]: {
            ...task,
            lifecycle: "in_progress",
            startedAtMs: state.timeMs,
            startSeq: event.seq,
          },
        },
        appliedSeq: event.seq,
      };
    }
    case "task_submit": {
      const task = state.tasks[event.taskId];
      const def = (state.scenario.tasks ?? []).find((t) => t.id === event.taskId);
      // Submit is accepted from available too (the standing escalate control
      // is a single press, not start-then-submit). Wrong ANSWERS are never
      // rejected here (SRS §5.2) — only structurally impossible submissions
      // (unknown task, kind mismatch, already-done task, not running).
      const legal =
        state.phase === "running" &&
        task !== undefined &&
        def !== undefined &&
        def.body.kind === event.submission.kind &&
        (task.lifecycle === "available" || task.lifecycle === "in_progress");
      if (!legal) {
        return { ...state, appliedSeq: event.seq };
      }
      const result = fireTriggers(
        state,
        (trigger) => trigger.on.kind === "task_done" && trigger.on.taskId === event.taskId,
      );
      return {
        ...state,
        vitals: result.vitals,
        firedTriggerIds: result.firedTriggerIds,
        tasks: {
          ...state.tasks,
          [event.taskId]: {
            ...task,
            lifecycle: "done",
            submittedAtMs: state.timeMs,
            submitSeq: event.seq,
            submission: event.submission,
          },
        },
        appliedSeq: event.seq,
      };
    }
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
