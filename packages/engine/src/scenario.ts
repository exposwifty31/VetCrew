/**
 * Scenario definition — reducer-evaluable deterioration params, NOT a
 * per-second script. Each vital drifts toward a target at a rate; triggers
 * (timed / action / injection) swap targets, rates, or jitter. Scenarios are
 * data, authored as YAML/JSON and versioned independently of the engine
 * (CLAUDE.md §4); this is the compiled shape the engine consumes.
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
  readonly target?: number;
  readonly ratePerSec?: number;
  readonly jitter?: number;
}

export type TriggerCondition =
  | { readonly kind: "time"; readonly atMs: number }
  | { readonly kind: "action"; readonly action: string }
  | { readonly kind: "injection"; readonly injection: string };

export interface TriggerDef {
  readonly id: string;
  readonly on: TriggerCondition;
  readonly effects: readonly VitalEffect[];
}

export interface ScenarioDef {
  readonly slug: string;
  readonly version: string;
  readonly vitals: Readonly<Record<string, VitalParams>>;
  readonly triggers: readonly TriggerDef[];
}
