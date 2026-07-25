import type { TaskSubmission } from "./tasks.js";

/**
 * Engine event types. Time enters ONLY as tick events; randomness ONLY via
 * the seeded PRNG threaded through state. Events are the authoritative record —
 * all state is derived from them (CLAUDE.md §4).
 */

export const SESSION_PHASES = [
  "draft",
  "briefing",
  "running",
  "paused",
  "debrief",
  "scored",
  "archived",
] as const;

export type SessionPhase = (typeof SESSION_PHASES)[number];

interface BaseEvent {
  /** Monotonic per-session sequence number; the replay order. */
  readonly seq: number;
}

export interface TickEvent extends BaseEvent {
  readonly type: "tick";
  /** Elapsed session time this tick represents, in milliseconds. */
  readonly dtMs: number;
}

export interface ActionEvent extends BaseEvent {
  readonly type: "action";
  /** Role station that acted (role-attribution is non-negotiable). */
  readonly role: string;
  readonly actorId: string;
  readonly action: string;
  readonly payload?: unknown;
}

export interface InjectionEvent extends BaseEvent {
  readonly type: "injection";
  readonly injection: string;
}

export interface PhaseChangeEvent extends BaseEvent {
  readonly type: "phase_change";
  readonly phase: SessionPhase;
}

export interface TaskStartEvent extends BaseEvent {
  readonly type: "task_start";
  readonly role: string;
  readonly actorId: string;
  readonly taskId: string;
}

export interface TaskSubmitEvent extends BaseEvent {
  readonly type: "task_submit";
  readonly role: string;
  readonly actorId: string;
  readonly taskId: string;
  /** Recorded verbatim; correctness is computed only post-hoc (SRS §5). */
  readonly submission: TaskSubmission;
}

export type EngineEvent =
  | TickEvent
  | ActionEvent
  | InjectionEvent
  | PhaseChangeEvent
  | TaskStartEvent
  | TaskSubmitEvent;
