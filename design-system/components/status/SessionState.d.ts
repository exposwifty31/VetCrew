import * as React from "react";

export type SessionFsmState =
  | "draft" | "briefing" | "running" | "paused" | "debrief" | "scored" | "archived";

export interface SessionStateProps extends React.HTMLAttributes<HTMLElement> {
  state?: SessionFsmState;
  /** badge = current state only; stepper = full lifecycle rail with progress. */
  variant?: "badge" | "stepper";
  /** Elapsed session time, pre-formatted (e.g. "07:42"); shown in tabular figures. */
  elapsed?: string;
  lang?: "he" | "en";
}

/** Session lifecycle indicator (draft→briefing→running⇄paused→debrief→scored→archived). */
export function SessionState(props: SessionStateProps): JSX.Element;
