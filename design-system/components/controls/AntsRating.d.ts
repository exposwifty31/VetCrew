import * as React from "react";

export interface AntsRatingProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Crew-skill category name (Hebrew-first), e.g. "תקשורת", "מודעות מצבית". */
  category: string;
  /** Current rating 1–5, or null if not yet rated. */
  value?: 1 | 2 | 3 | 4 | 5 | null;
  /** Optional 5 short behavioural anchors (index 0 = score 1). */
  anchors?: string[];
  /** How many event-log entries justify this rating (drives the evidence link). */
  evidenceCount?: number;
  onChange?: (value: number) => void;
  /** Jump the timeline/AAR to the events behind this rating. */
  onJumpToEvidence?: () => void;
  lang?: "he" | "en";
}

/**
 * ANTS 1–5 rating bound to its source events.
 * @startingPoint section="Rating" subtitle="ANTS 1–5 crew-skill rating with one-click evidence link" viewport="700x220"
 */
export function AntsRating(props: AntsRatingProps): JSX.Element;
