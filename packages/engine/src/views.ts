import type { SessionPhase } from "./events.js";
import type { EngineState } from "./reducer.js";
import type {
  TaskChipCode,
  TaskDef,
  TaskLifecycle,
  TaskOptionDef,
  TaskSubmission,
} from "./tasks.js";

/**
 * Role views — genuinely PARTIAL projections of engine state (CLAUDE.md §4).
 * Information hiding is a feature, not a permissions filter: everything the
 * scenario knows about correct answers (expected ranges/options/order, drop
 * factors, the abnormality trigger) and everything that would reveal the
 * trajectory (vital targets/rates, fired triggers, active injections, PRNG)
 * is stripped HERE, before anything crosses the wire.
 */

export interface ViewValueField {
  readonly id: string;
  readonly label: string;
  readonly labelHe: string;
  readonly unit: string;
  readonly format: string;
}

export interface ViewChoiceStep {
  readonly id: string;
  readonly label: string;
  readonly labelHe: string;
  readonly prompt?: string | undefined;
  readonly promptHe?: string | undefined;
  readonly options: readonly TaskOptionDef[];
}

export type ViewTaskBody =
  | { readonly kind: "value_entry"; readonly fields: readonly ViewValueField[] }
  | { readonly kind: "choice_chain"; readonly steps: readonly ViewChoiceStep[] }
  | {
      readonly kind: "med_admin";
      readonly drugLabel: string;
      readonly drugLabelHe: string;
      readonly doseMg: number;
      readonly concentrationMgPerMl: number;
      readonly routes: readonly TaskOptionDef[];
    }
  | {
      readonly kind: "tube_choice";
      readonly panelLabel: string;
      readonly panelLabelHe: string;
      readonly options: readonly TaskOptionDef[];
    }
  | { readonly kind: "step_order"; readonly steps: readonly TaskOptionDef[] }
  | {
      readonly kind: "fluids_setup";
      readonly weightKg: number;
      readonly orderedMlPerHr: number;
      readonly sets: readonly TaskOptionDef[];
    }
  | { readonly kind: "escalate" };

export interface ViewTask {
  readonly id: string;
  readonly code: TaskChipCode;
  readonly title: string;
  readonly titleHe: string;
  readonly instruction: string;
  readonly instructionHe: string;
  readonly hidden: boolean;
  readonly lifecycle: TaskLifecycle;
  /** The trainee's own entries echo back — engine-confirmed, never optimistic. */
  readonly submission: TaskSubmission | null;
  readonly body: ViewTaskBody;
}

export interface RoleView {
  readonly role: string;
  readonly phase: SessionPhase;
  readonly timeMs: number;
  /** Last applied event seq — the client's reconnect cursor. */
  readonly seq: number;
  readonly scenarioSlug: string;
  readonly scenarioVersion: string;
  readonly species: string | null;
  /** Current values only — targets/rates would reveal the trajectory. */
  readonly vitals: Readonly<Record<string, number>>;
  readonly tasks: readonly ViewTask[];
}

function stripBody(body: TaskDef["body"]): ViewTaskBody {
  switch (body.kind) {
    case "value_entry":
      return {
        kind: "value_entry",
        fields: body.fields.map(({ id, label, labelHe, unit, format }) => ({
          id,
          label,
          labelHe,
          unit,
          format,
        })),
      };
    case "choice_chain":
      return {
        kind: "choice_chain",
        steps: body.steps.map(({ id, label, labelHe, prompt, promptHe, options }) => ({
          id,
          label,
          labelHe,
          prompt,
          promptHe,
          options,
        })),
      };
    case "med_admin":
      return {
        kind: "med_admin",
        drugLabel: body.drugLabel,
        drugLabelHe: body.drugLabelHe,
        doseMg: body.doseMg,
        concentrationMgPerMl: body.concentrationMgPerMl,
        routes: body.routes,
      };
    case "tube_choice":
      return {
        kind: "tube_choice",
        panelLabel: body.panelLabel,
        panelLabelHe: body.panelLabelHe,
        options: body.options,
      };
    case "step_order":
      return { kind: "step_order", steps: body.steps };
    case "fluids_setup":
      return {
        kind: "fluids_setup",
        weightKg: body.weightKg,
        orderedMlPerHr: body.orderedMlPerHr,
        sets: body.sets.map(({ id, label, labelHe }) => ({ id, label, labelHe })),
      };
    case "escalate":
      return { kind: "escalate" };
    default: {
      const exhaustive: never = body;
      throw new Error(`Unhandled body: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function roleView(state: EngineState, role: string): RoleView {
  const vitals: Record<string, number> = {};
  for (const [name, vital] of Object.entries(state.vitals)) {
    // One decimal is what a monitor shows; raw floats would leak drift math.
    vitals[name] = Math.round(vital.value * 10) / 10;
  }
  const tasks = (state.scenario.tasks ?? []).map((def): ViewTask => {
    const runtime = state.tasks[def.id];
    return {
      id: def.id,
      code: def.code,
      title: def.title,
      titleHe: def.titleHe,
      instruction: def.instruction,
      instructionHe: def.instructionHe,
      hidden: def.hidden ?? false,
      lifecycle: runtime?.lifecycle ?? "available",
      submission: runtime?.submission ?? null,
      body: stripBody(def.body),
    };
  });
  return {
    role,
    phase: state.phase,
    timeMs: state.timeMs,
    seq: state.appliedSeq,
    scenarioSlug: state.scenario.slug,
    scenarioVersion: state.scenario.version,
    species: state.scenario.species ?? null,
    vitals,
    tasks,
  };
}
