import type { SessionPhase } from "./events.js";

/**
 * The session lifecycle as an explicit state machine (CLAUDE.md §4):
 * draft → briefing → running ⇄ paused → debrief → scored → archived.
 * The Record over SessionPhase is exhaustive — adding a phase without a
 * transition row is a compile error.
 *
 * `debrief` has two exits because the lifecycle forks on mode (CLAUDE.md §4):
 * assessment runs `debrief → scored → archived` and requires a complete rating
 * set, while practice and tutorial never reach `scored` and would otherwise
 * strand in `debrief` with no terminal state. This table is deliberately
 * MODE-BLIND: `canTransition` describes the shape of the machine, the server
 * enforces which fork a given session may take (D3).
 */
export const PHASE_TRANSITIONS: Readonly<Record<SessionPhase, readonly SessionPhase[]>> = {
  draft: ["briefing"],
  briefing: ["running"],
  running: ["paused", "debrief"],
  paused: ["running", "debrief"],
  debrief: ["scored", "archived"],
  scored: ["archived"],
  archived: [],
};

export function canTransition(from: SessionPhase, to: SessionPhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}
