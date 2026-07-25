import type { SessionPhase } from "./events.js";

/**
 * The session lifecycle as an explicit state machine (CLAUDE.md §4):
 * draft → briefing → running ⇄ paused → debrief → scored → archived.
 * The Record over SessionPhase is exhaustive — adding a phase without a
 * transition row is a compile error.
 */
export const PHASE_TRANSITIONS: Readonly<Record<SessionPhase, readonly SessionPhase[]>> = {
  draft: ["briefing"],
  briefing: ["running"],
  running: ["paused", "debrief"],
  paused: ["running", "debrief"],
  debrief: ["scored"],
  scored: ["archived"],
  archived: [],
};

export function canTransition(from: SessionPhase, to: SessionPhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}
