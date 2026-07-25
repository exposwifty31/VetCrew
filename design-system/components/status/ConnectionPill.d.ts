import * as React from "react";

export type ConnectionState = "live" | "paused" | "offline" | "reconnecting";

export interface ConnectionPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Data-freshness state. `reconnecting` adds a hatch + spinner so it can't read as live. */
  state?: ConnectionState;
  lang?: "he" | "en";
}

/** Connection / data-freshness pill (independent of patient severity). */
export function ConnectionPill(props: ConnectionPillProps): JSX.Element;
