import type { SessionPhase } from "@vetcrew/engine";
import type { ScenarioMode } from "@vetcrew/shared";

/**
 * What each platform withholds (CLAUDE.md §1.1).
 *
 * The mode difference must be **a capability the system withholds, not a policy
 * someone follows** — in assessment, pause and inject are refused the same way
 * a trainee's injection attempt already is, at the transport layer, rather than
 * relying on an examiner's restraint. Everything here therefore reads the
 * session's FROZEN mode (`vc_sim_sessions.mode`), never the live scenario row,
 * which a boot-time re-sync from disk can silently restate.
 *
 * These functions govern **client-originated** phase changes only. The ratings
 * route appends `scored` itself, through the same seq authority, once the
 * rating set is complete — it does not pass through here.
 */

/** Refusal message, or null when the transition is permitted. */
export function refuseClientPhaseChange(
  mode: ScenarioMode,
  from: SessionPhase,
  to: SessionPhase,
): string | null {
  if (to === "scored") {
    // Server-derived in every mode. In assessment it is the ratings route's to
    // append; in practice and tutorial it is never reached at all (§4 fork).
    return mode === "assessment"
      ? 'scored is set by the server when the rating set is complete, not by a client'
      : `a ${mode} session never reaches scored — its ratings are formative annotations`;
  }
  if (mode !== "assessment") return null;
  if (to === "paused") {
    return "assessment mode cannot be paused — the examiner observes and does not intervene";
  }
  if (to === "archived" && from === "debrief") {
    // Without this, widening the FSM to give practice a terminal state would
    // hand assessment a burial mechanism: a run that was going badly could
    // leave with no score and no trace of why. The release valve for a genuinely
    // stuck session is amending the rater roster (which is logged), not
    // archiving the candidate's session unscored.
    return "an assessment session must be scored before it is archived";
  }
  return null;
}

/** Refusal message for a live injection, or null when permitted. */
export function refuseInjection(mode: ScenarioMode): string | null {
  if (mode !== "assessment") return null;
  return "assessment events are pre-set at fixed time points — the examiner cannot inject";
}

/** Practice and tutorial ratings are formative annotations; they never score. */
export function isScorable(mode: ScenarioMode): boolean {
  return mode === "assessment";
}
