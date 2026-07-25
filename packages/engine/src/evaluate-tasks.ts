import type { EngineEvent } from "./events.js";
import { createInitialState, reduce } from "./reducer.js";
import type { ScenarioDef } from "./scenario.js";
import type { TaskDef, TaskSubmission } from "./tasks.js";

/**
 * Task evaluator — deterministic expected-vs-actual over the completed log
 * (SRS §7: "Cefazolin: expected 2.5 ml IV · entered 2.5 ml SC · FAIL").
 * Runs the REAL reducer over the events so "which submission counted" can
 * never disagree with engine semantics. Pure: no I/O, no clock. Verdicts
 * exist only here, post-hoc — never in live state (SRS §5).
 */

export interface TaskDimensionResult {
  readonly taskId: string;
  /** Stable dimension key: a field/step id, or "dose"|"route"|"tubes"|"order"|"set"|"drops_per_min"|"escalate". */
  readonly dimension: string;
  readonly label: string;
  readonly labelHe: string;
  readonly expected: string;
  readonly expectedHe: string;
  /** null = the task/dimension was never attempted. */
  readonly actual: string | null;
  readonly actualHe: string | null;
  readonly passed: boolean;
  /** Fatal-class error (e.g. SC-only drug given IV) — never blocked, always flagged. */
  readonly critical: boolean;
  readonly evidenceSeqs: readonly number[];
}

export interface EscalationResult {
  /** Seq of the event that fired the abnormality trigger, or null if it never fired. */
  readonly abnormalitySeq: number | null;
  readonly noticed: boolean;
  /** Directional metric (SRS T7) — null when not measurable. */
  readonly timeToNoticeMs: number | null;
}

export interface TaskEvaluation {
  readonly results: readonly TaskDimensionResult[];
  readonly passedCount: number;
  readonly totalCount: number;
  readonly escalation: EscalationResult | null;
}

interface AcceptedSubmission {
  readonly submission: TaskSubmission;
  readonly seq: number;
  readonly timeMs: number;
}

interface WalkResult {
  readonly accepted: ReadonlyMap<string, AcceptedSubmission>;
  readonly triggerFires: ReadonlyMap<string, { seq: number; timeMs: number }>;
}

/** Replay with the real reducer, recording accepted submissions + trigger fires. */
function walk(seed: number, events: readonly EngineEvent[], scenario: ScenarioDef): WalkResult {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const accepted = new Map<string, AcceptedSubmission>();
  const triggerFires = new Map<string, { seq: number; timeMs: number }>();
  let state = createInitialState(seed, scenario);
  for (const event of ordered) {
    const firedBefore = state.firedTriggerIds;
    state = reduce(state, event);
    for (const id of state.firedTriggerIds) {
      if (!firedBefore.includes(id) && !triggerFires.has(id)) {
        triggerFires.set(id, { seq: event.seq, timeMs: state.timeMs });
      }
    }
    if (event.type === "task_submit" && state.tasks[event.taskId]?.submitSeq === event.seq) {
      accepted.set(event.taskId, {
        submission: event.submission,
        seq: event.seq,
        timeMs: state.timeMs,
      });
    }
  }
  return { accepted, triggerFires };
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

interface Dim {
  readonly dimension: string;
  readonly label: string;
  readonly labelHe: string;
  readonly expected: string;
  readonly expectedHe: string;
  readonly actual: string | null;
  readonly actualHe: string | null;
  readonly passed: boolean;
  readonly critical?: boolean;
}

function optionLabel(
  options: readonly { id: string; label: string; labelHe: string }[],
  id: string,
): { label: string; labelHe: string } {
  const option = options.find((o) => o.id === id);
  return option ?? { label: id, labelHe: id };
}

function evaluateTask(
  def: TaskDef,
  accepted: AcceptedSubmission | undefined,
  triggerFires: ReadonlyMap<string, { seq: number; timeMs: number }>,
): { dims: Dim[]; evidenceSeqs: number[]; escalation?: EscalationResult } {
  const body = def.body;
  const evidenceSeqs = accepted === undefined ? [] : [accepted.seq];
  switch (body.kind) {
    case "value_entry": {
      const values =
        accepted?.submission.kind === "value_entry" ? accepted.submission.values : undefined;
      const dims = body.fields.map((field): Dim => {
        const entered = values?.[field.id];
        const expected = `${fmt(field.expectedMin)}–${fmt(field.expectedMax)} ${field.unit}`;
        return {
          dimension: field.id,
          label: field.label,
          labelHe: field.labelHe,
          expected,
          expectedHe: expected,
          actual: entered === undefined ? null : `${fmt(entered)} ${field.unit}`,
          actualHe: entered === undefined ? null : `${fmt(entered)} ${field.unit}`,
          passed:
            entered !== undefined && entered >= field.expectedMin && entered <= field.expectedMax,
        };
      });
      return { dims, evidenceSeqs };
    }
    case "choice_chain": {
      const choices =
        accepted?.submission.kind === "choice_chain" ? accepted.submission.choices : undefined;
      const dims = body.steps.map((step): Dim => {
        const chosen = choices?.[step.id];
        const expected = optionLabel(step.options, step.expectedOptionId);
        const actual = chosen === undefined ? null : optionLabel(step.options, chosen);
        return {
          dimension: step.id,
          label: step.label,
          labelHe: step.labelHe,
          expected: expected.label,
          expectedHe: expected.labelHe,
          actual: actual?.label ?? null,
          actualHe: actual?.labelHe ?? null,
          passed: chosen === step.expectedOptionId,
        };
      });
      return { dims, evidenceSeqs };
    }
    case "med_admin": {
      const submission =
        accepted?.submission.kind === "med_admin" ? accepted.submission : undefined;
      const expectedRoute = optionLabel(body.routes, body.expectedRouteId);
      const actualRoute =
        submission === undefined ? null : optionLabel(body.routes, submission.routeId);
      const doseOk =
        submission !== undefined && Math.abs(submission.ml - body.expectedMl) < 0.005;
      const routeOk = submission !== undefined && submission.routeId === body.expectedRouteId;
      const critical =
        submission !== undefined && body.criticalRouteIds.includes(submission.routeId);
      const dims: Dim[] = [
        {
          dimension: "dose",
          label: "Dose (ml)",
          labelHe: "מינון (מ״ל)",
          expected: `${fmt(body.expectedMl)} ml`,
          expectedHe: `${fmt(body.expectedMl)} מ״ל`,
          actual: submission === undefined ? null : `${fmt(submission.ml)} ml`,
          actualHe: submission === undefined ? null : `${fmt(submission.ml)} מ״ל`,
          passed: doseOk,
        },
        {
          dimension: "route",
          label: "Route",
          labelHe: "דרך מתן",
          expected: expectedRoute.label,
          expectedHe: expectedRoute.labelHe,
          actual: actualRoute?.label ?? null,
          actualHe: actualRoute?.labelHe ?? null,
          passed: routeOk,
          critical,
        },
      ];
      return { dims, evidenceSeqs };
    }
    case "tube_choice": {
      const submission =
        accepted?.submission.kind === "tube_choice" ? accepted.submission : undefined;
      const expectedSet = new Set(body.expectedOptionIds);
      const chosenSet = new Set(submission?.optionIds ?? []);
      const passed =
        submission !== undefined &&
        expectedSet.size === chosenSet.size &&
        [...expectedSet].every((id) => chosenSet.has(id));
      const join = (ids: readonly string[], he: boolean) =>
        ids.map((id) => optionLabel(body.options, id)[he ? "labelHe" : "label"]).join(", ");
      const dims: Dim[] = [
        {
          dimension: "tubes",
          label: "Tube selection",
          labelHe: "בחירת מבחנות",
          expected: join(body.expectedOptionIds, false),
          expectedHe: join(body.expectedOptionIds, true),
          actual: submission === undefined ? null : join(submission.optionIds, false),
          actualHe: submission === undefined ? null : join(submission.optionIds, true),
          passed,
        },
      ];
      return { dims, evidenceSeqs };
    }
    case "step_order": {
      const submission =
        accepted?.submission.kind === "step_order" ? accepted.submission : undefined;
      const passed =
        submission !== undefined &&
        submission.order.length === body.expectedOrder.length &&
        submission.order.every((id, i) => id === body.expectedOrder[i]);
      const join = (ids: readonly string[], he: boolean) =>
        ids.map((id) => optionLabel(body.steps, id)[he ? "labelHe" : "label"]).join(", ");
      const dims: Dim[] = [
        {
          dimension: "order",
          label: "Step order",
          labelHe: "סדר שלבים",
          expected: join(body.expectedOrder, false),
          expectedHe: join(body.expectedOrder, true),
          actual: submission === undefined ? null : join(submission.order, false),
          actualHe: submission === undefined ? null : join(submission.order, true),
          passed,
        },
      ];
      return { dims, evidenceSeqs };
    }
    case "fluids_setup": {
      const submission =
        accepted?.submission.kind === "fluids_setup" ? accepted.submission : undefined;
      const expectedSet = optionLabel(body.sets, body.expectedSetId);
      const chosenSetDef = body.sets.find((s) => s.id === submission?.setId);
      const actualSet = submission === undefined ? null : optionLabel(body.sets, submission.setId);
      // Expected drops/min follows the CHOSEN set (SRS T6: scored separately) —
      // arithmetic the evaluator may do, and the trainee never sees.
      const expectedDrops =
        chosenSetDef === undefined
          ? null
          : (body.orderedMlPerHr * chosenSetDef.dropsPerMl) / 60;
      const dims: Dim[] = [
        {
          dimension: "set",
          label: "Delivery set",
          labelHe: "סט עירוי",
          expected: expectedSet.label,
          expectedHe: expectedSet.labelHe,
          actual: actualSet?.label ?? null,
          actualHe: actualSet?.labelHe ?? null,
          passed: submission !== undefined && submission.setId === body.expectedSetId,
        },
        {
          dimension: "drops_per_min",
          label: "Drops/min",
          labelHe: "טיפות לדקה",
          expected: expectedDrops === null ? "—" : `${fmt(expectedDrops)}`,
          expectedHe: expectedDrops === null ? "—" : `${fmt(expectedDrops)}`,
          actual: submission === undefined ? null : `${fmt(submission.dropsPerMin)}`,
          actualHe: submission === undefined ? null : `${fmt(submission.dropsPerMin)}`,
          passed:
            submission !== undefined &&
            expectedDrops !== null &&
            Math.abs(submission.dropsPerMin - expectedDrops) <= 0.5,
        },
      ];
      return { dims, evidenceSeqs };
    }
    case "escalate": {
      const fire = triggerFires.get(body.abnormalityTriggerId);
      // Noticed = escalated AFTER the abnormality presented. An escalation
      // before it (false alarm) consumed the task and does not count.
      const noticed =
        fire !== undefined && accepted !== undefined && accepted.seq > fire.seq;
      const escalation: EscalationResult = {
        abnormalitySeq: fire?.seq ?? null,
        noticed,
        timeToNoticeMs: noticed && fire !== undefined ? accepted.timeMs - fire.timeMs : null,
      };
      // Vacuous pass when the abnormality never presented — nothing to notice.
      const passed = fire === undefined ? true : noticed;
      const dims: Dim[] = [
        {
          dimension: "escalate",
          label: "Noticed & escalated",
          labelHe: "זיהוי והסלמה",
          expected: "Call doctor / senior",
          expectedHe: "קריאה לרופא/בכיר",
          actual:
            accepted === undefined ? null : accepted.seq > (fire?.seq ?? Infinity) ? "Escalated" : "Escalated before abnormality",
          actualHe:
            accepted === undefined ? null : accepted.seq > (fire?.seq ?? Infinity) ? "הוסלם" : "הוסלם לפני החריגה",
          passed,
        },
      ];
      const seqs = [...(fire === undefined ? [] : [fire.seq]), ...evidenceSeqs];
      return { dims, evidenceSeqs: seqs, escalation };
    }
    default: {
      const exhaustive: never = body;
      throw new Error(`Unhandled body: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function evaluateTasks(
  seed: number,
  events: readonly EngineEvent[],
  scenario: ScenarioDef,
): TaskEvaluation {
  const defs = scenario.tasks ?? [];
  const { accepted, triggerFires } = walk(seed, events, scenario);
  const results: TaskDimensionResult[] = [];
  let escalation: EscalationResult | null = null;
  for (const def of defs) {
    const evaluated = evaluateTask(def, accepted.get(def.id), triggerFires);
    if (evaluated.escalation !== undefined) {
      escalation = evaluated.escalation;
    }
    for (const dim of evaluated.dims) {
      results.push({
        taskId: def.id,
        dimension: dim.dimension,
        label: dim.label,
        labelHe: dim.labelHe,
        expected: dim.expected,
        expectedHe: dim.expectedHe,
        actual: dim.actual,
        actualHe: dim.actualHe,
        passed: dim.passed,
        critical: dim.critical ?? false,
        evidenceSeqs: evaluated.evidenceSeqs,
      });
    }
  }
  return {
    results,
    passedCount: results.filter((r) => r.passed).length,
    totalCount: results.length,
    escalation,
  };
}
