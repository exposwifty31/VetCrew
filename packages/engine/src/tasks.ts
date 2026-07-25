/**
 * Task layer — the stepped base-rung scenario shape (docs/specs/base-rung-srs.md).
 * Tasks are data: each one is a sequence of explicit decisions the trainee makes
 * (SRS §4b — "the chip must mirror the actual decision"). The reducer records
 * lifecycle and WHAT WAS ENTERED, never correctness: verdicts exist only in the
 * post-hoc evaluator (evaluate-tasks.ts), so no live view can leak or coach.
 */

export type TaskChipCode = "do" | "report" | "timed" | "approval";

export const TASK_LIFECYCLES = ["available", "in_progress", "done", "error"] as const;
/**
 * SRS task lifecycle. "error" is reserved for device/operational outcomes
 * (never wrong answers — those are logged and scored, not surfaced live).
 */
export type TaskLifecycle = (typeof TASK_LIFECYCLES)[number];

export interface TaskOptionDef {
  readonly id: string;
  readonly label: string;
  readonly labelHe: string;
}

export interface ValueFieldDef {
  readonly id: string;
  readonly label: string;
  readonly labelHe: string;
  readonly unit: string;
  /**
   * Format-only regex (SRS T1): blocks wrong medical NOTATION at the client,
   * never a wrong value. A plausible-but-wrong value must submit cleanly.
   */
  readonly format: string;
  /** Correct-answer data — stripped from role views (SRS §5.1). */
  readonly expectedMin: number;
  readonly expectedMax: number;
}

export interface ChoiceStepDef {
  readonly id: string;
  readonly label: string;
  readonly labelHe: string;
  /** Device/context line shown when the step reveals (e.g. "Artifact Detected"). */
  readonly prompt?: string | undefined;
  readonly promptHe?: string | undefined;
  readonly options: readonly TaskOptionDef[];
  /** Stripped from role views. */
  readonly expectedOptionId: string;
}

export interface FluidSetDef extends TaskOptionDef {
  /** Drop factor — the knowledge under test (SRS T6), stripped from role views. */
  readonly dropsPerMl: number;
}

export type TaskBodyDef =
  | { readonly kind: "value_entry"; readonly fields: readonly ValueFieldDef[] }
  | { readonly kind: "choice_chain"; readonly steps: readonly ChoiceStepDef[] }
  | {
      readonly kind: "med_admin";
      readonly drugLabel: string;
      readonly drugLabelHe: string;
      readonly doseMg: number;
      /** Vial-label context — GIVEN to the trainee; the mg→ml arithmetic is not. */
      readonly concentrationMgPerMl: number;
      readonly routes: readonly TaskOptionDef[];
      /** Stripped from role views. */
      readonly expectedMl: number;
      readonly expectedRouteId: string;
      /** Fatal-class wrong routes (e.g. SC-only given IV). Stripped. */
      readonly criticalRouteIds: readonly string[];
    }
  | {
      readonly kind: "tube_choice";
      readonly panelLabel: string;
      readonly panelLabelHe: string;
      readonly options: readonly TaskOptionDef[];
      /** Stripped from role views. */
      readonly expectedOptionIds: readonly string[];
    }
  | {
      readonly kind: "step_order";
      readonly steps: readonly TaskOptionDef[];
      /** Stripped from role views. */
      readonly expectedOrder: readonly string[];
    }
  | {
      readonly kind: "fluids_setup";
      readonly weightKg: number;
      readonly orderedMlPerHr: number;
      readonly sets: readonly FluidSetDef[];
      /** Stripped from role views. */
      readonly expectedSetId: string;
    }
  | {
      readonly kind: "escalate";
      /** The trigger whose firing the trainee must notice. Stripped. */
      readonly abnormalityTriggerId: string;
    };

export interface TaskDef {
  readonly id: string;
  readonly code: TaskChipCode;
  /** Floor-test competency tag (SRS §3): "A".."F", "F'", "decision". */
  readonly competency: string;
  readonly title: string;
  readonly titleHe: string;
  readonly instruction: string;
  readonly instructionHe: string;
  readonly body: TaskBodyDef;
  /**
   * Hidden tasks never appear on the task rail. T7: listing "recognise &
   * escalate" would do the noticing for the trainee — escalation is a
   * standing control instead.
   */
  readonly hidden?: boolean | undefined;
  /**
   * Owning role slug. Absent = visible to every trainee role (legacy solo).
   * When set, `roleView` only includes the task for that role.
   */
  readonly role?: string | undefined;
}

/** What the trainee entered — recorded verbatim, evaluated only post-hoc. */
export type TaskSubmission =
  | { readonly kind: "value_entry"; readonly values: Readonly<Record<string, number>> }
  | { readonly kind: "choice_chain"; readonly choices: Readonly<Record<string, string>> }
  | { readonly kind: "med_admin"; readonly ml: number; readonly routeId: string }
  | { readonly kind: "tube_choice"; readonly optionIds: readonly string[] }
  | { readonly kind: "step_order"; readonly order: readonly string[] }
  | { readonly kind: "fluids_setup"; readonly setId: string; readonly dropsPerMin: number }
  | { readonly kind: "escalate" };

export interface TaskRuntimeState {
  readonly lifecycle: TaskLifecycle;
  readonly startedAtMs: number | null;
  readonly submittedAtMs: number | null;
  readonly startSeq: number | null;
  readonly submitSeq: number | null;
  readonly submission: TaskSubmission | null;
}

export function createTaskRuntime(tasks: readonly TaskDef[]): Record<string, TaskRuntimeState> {
  const runtime: Record<string, TaskRuntimeState> = {};
  for (const task of tasks) {
    runtime[task.id] = {
      lifecycle: "available",
      startedAtMs: null,
      submittedAtMs: null,
      startSeq: null,
      submitSeq: null,
      submission: null,
    };
  }
  return runtime;
}
