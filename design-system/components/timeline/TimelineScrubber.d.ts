import * as React from "react";
import { SeverityLevel } from "../status/SeverityChip";

export interface TimelineMarker {
  /** Time in seconds from session start. */
  t: number;
  /** Event kind — drives the marker's shape. */
  type?: "action" | "injection" | "vitals" | "callout" | "phase";
  /** Role this event is attributed to (matches a lane's `role`). */
  role?: string;
  label?: string;
  /** If a vitals/severity event, colors the marker by level (still shape-coded). */
  severity?: SeverityLevel;
}

export interface TimelineLane {
  role: string;
  label: string;
}

export interface TimelineScrubberProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Total session length in seconds. */
  duration?: number;
  /** Current playhead position in seconds. */
  position?: number;
  markers?: TimelineMarker[];
  /** Optional per-role lanes rendered under the main track. */
  lanes?: TimelineLane[] | null;
  onSeek?: (seconds: number) => void;
  /** Fired when a marker is clicked — the hook for score→source-event jumps. */
  onMarkerClick?: (marker: TimelineMarker, index: number) => void;
}

/**
 * AAR timeline scrubber with shape-coded event markers and per-role lanes.
 * @startingPoint section="Timeline" subtitle="RTL scrubber with event markers + role lanes (score→event linking)" viewport="900x260"
 */
export function TimelineScrubber(props: TimelineScrubberProps): JSX.Element;
