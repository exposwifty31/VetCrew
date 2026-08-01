import type { EngineEvent, SessionPhase } from "./events.js";

/**
 * Technical checklist — a weighted, rule-based query over the event log.
 * Every result carries evidenceSeqs so a score is traceable to the exact
 * events that produced it (CLAUDE.md §2.3). Pure: no I/O, no clock.
 */

export type ChecklistRule =
  | {
      readonly kind: "action_performed";
      readonly action: string;
      readonly withinMs?: number | undefined;
    }
  | { readonly kind: "action_not_performed"; readonly action: string }
  | { readonly kind: "action_before"; readonly action: string; readonly before: string };

export interface ChecklistItemDef {
  readonly id: string;
  readonly label: string;
  /** Hebrew label — required by `checklistItemSchema`; the AAR is Hebrew-first (§4). */
  readonly labelHe: string;
  readonly weight: number;
  readonly role?: string | undefined;
  readonly rule: ChecklistRule;
}

export interface ChecklistItemResult {
  readonly id: string;
  readonly label: string;
  /** Carried through so the AAR can render Hebrew without re-reading the scenario. */
  readonly labelHe: string;
  readonly weight: number;
  readonly passed: boolean;
  /** Event seqs proving (or disproving) the item. */
  readonly evidenceSeqs: readonly number[];
}

export interface ChecklistResult {
  readonly items: readonly ChecklistItemResult[];
  readonly score: number;
  readonly maxScore: number;
  readonly percent: number;
}

interface TimedAction {
  readonly seq: number;
  readonly timeMs: number;
  readonly action: string;
  readonly role: string;
}

/** Session time of each action = accumulated tick time before it. */
function collectActions(events: readonly EngineEvent[]): TimedAction[] {
  // seq is the authoritative replay order; do not trust array order.
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const actions: TimedAction[] = [];
  let timeMs = 0;
  // Mirror the reducer: actions outside `running` have no effect, so they
  // must not satisfy (or violate) a technical checklist item.
  let phase: SessionPhase = "draft";
  for (const event of ordered) {
    switch (event.type) {
      case "tick":
        // Physiology clock advances only while running; checklist time matches.
        if (phase === "running") {
          timeMs += event.dtMs;
        }
        break;
      case "phase_change":
        phase = event.phase;
        break;
      case "action":
        if (phase === "running") {
          actions.push({
            seq: event.seq,
            timeMs,
            action: event.action,
            role: event.role,
          });
        }
        break;
      case "injection":
      case "task_start":
      case "task_submit":
        break;
      default: {
        const exhaustive: never = event;
        throw new Error(`Unhandled event: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
  return actions;
}

/**
 * Single point of construction for a result row. Every branch below differs
 * only in `passed`/`evidenceSeqs`; keeping the shell here means the next field
 * added to ChecklistItemResult is a one-line change, not a three-place one.
 */
function buildResult(
  item: ChecklistItemDef,
  passed: boolean,
  evidenceSeqs: readonly number[],
): ChecklistItemResult {
  return {
    id: item.id,
    label: item.label,
    labelHe: item.labelHe,
    weight: item.weight,
    passed,
    evidenceSeqs,
  };
}

function evaluateItem(item: ChecklistItemDef, actions: readonly TimedAction[]): ChecklistItemResult {
  const scoped = item.role === undefined ? actions : actions.filter((a) => a.role === item.role);
  const rule = item.rule;
  switch (rule.kind) {
    case "action_performed": {
      const matches = scoped.filter(
        (a) => a.action === rule.action && (rule.withinMs === undefined || a.timeMs <= rule.withinMs),
      );
      const first = matches[0];
      return buildResult(item, first !== undefined, first !== undefined ? [first.seq] : []);
    }
    case "action_not_performed": {
      const violations = scoped.filter((a) => a.action === rule.action);
      return buildResult(
        item,
        violations.length === 0,
        violations.map((a) => a.seq),
      );
    }
    case "action_before": {
      const firstAction = scoped.find((a) => a.action === rule.action);
      const firstHazard = scoped.find((a) => a.action === rule.before);
      // Vacuous pass when the hazard action never occurred: no inversion happened.
      const passed =
        firstHazard === undefined ||
        (firstAction !== undefined && firstAction.seq < firstHazard.seq);
      const evidenceSeqs = [firstHazard, firstAction]
        .filter((a): a is TimedAction => a !== undefined)
        .map((a) => a.seq);
      return buildResult(item, passed, evidenceSeqs);
    }
    default: {
      const exhaustive: never = rule;
      throw new Error(`Unhandled rule: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function evaluateChecklist(
  events: readonly EngineEvent[],
  items: readonly ChecklistItemDef[],
): ChecklistResult {
  const actions = collectActions(events);
  const results = items.map((item) => evaluateItem(item, actions));
  const maxScore = results.reduce((sum, r) => sum + r.weight, 0);
  const score = results.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0);
  return {
    items: results,
    score,
    maxScore,
    percent: maxScore === 0 ? 0 : Math.round((score / maxScore) * 100),
  };
}
