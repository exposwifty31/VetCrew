import type { TaskDef } from "./tasks.js";

/**
 * Scenario definition — reducer-evaluable deterioration params, NOT a
 * per-second script. Each vital drifts toward a target at a rate; triggers
 * (timed / action / injection / task_done) swap targets, rates, or jitter.
 * Scenarios are data, authored as YAML/JSON and versioned independently of
 * the engine (CLAUDE.md §4); this is the compiled shape the engine consumes.
 */

export interface VitalParams {
  readonly initial: number;
  readonly target: number;
  /** Absolute drift toward target, units per second. */
  readonly ratePerSec: number;
  /** Seeded noise amplitude (± units per tick). 0 = clean signal. */
  readonly jitter: number;
}

export interface VitalEffect {
  readonly vital: string;
  readonly target?: number | undefined;
  readonly ratePerSec?: number | undefined;
  readonly jitter?: number | undefined;
}

export type TriggerCondition =
  | { readonly kind: "time"; readonly atMs: number }
  | { readonly kind: "action"; readonly action: string }
  | { readonly kind: "injection"; readonly injection: string }
  /**
   * Fires when a task completes. The rare-and-legible conditional auto-trigger
   * doctrine (CLAUDE.md §4) — Sprint 3 bridge for the T7 abnormality until the
   * live instructor console (Sprint 4) turns it into a menu item.
   */
  | { readonly kind: "task_done"; readonly taskId: string };

export interface TriggerDef {
  readonly id: string;
  readonly on: TriggerCondition;
  readonly effects: readonly VitalEffect[];
}

export interface InjectionMenuItem {
  readonly id: string;
  readonly label: string;
  readonly labelHe: string;
}

export interface ScenarioDef {
  readonly slug: string;
  readonly version: string;
  readonly vitals: Readonly<Record<string, VitalParams>>;
  readonly triggers: readonly TriggerDef[];
  /** Stepped task sequence (base-rung SRS). Absent/empty for pure-deterioration scenarios. */
  readonly tasks?: readonly TaskDef[] | undefined;
  /** Display parameter (SRS OD-2); ranges inside task defs follow it at compile time. */
  readonly species?: string | undefined;
  /** Authored role slugs — join AuthZ + roleView filtering. */
  readonly roles?: readonly string[] | undefined;
  /** Instructor injection menu (available, never scheduled). */
  readonly injections?: readonly InjectionMenuItem[] | undefined;
}
