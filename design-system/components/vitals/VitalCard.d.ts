import * as React from "react";
import { SeverityLevel } from "../status/SeverityChip";

export interface VitalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Full parameter name, Hebrew-first (e.g. "דופק"). */
  name: string;
  /** Short clinical abbreviation (e.g. "HR", "SpO₂"). */
  abbr?: string;
  /** Current reading. Numbers flash on change; keep numeric for tick animation. */
  value: React.ReactNode;
  unit?: string;
  level?: SeverityLevel;
  /** Direction of the last change — informational arrow. */
  trend?: "up" | "down" | "flat";
  /** Connection dropped: freezes + desaturates + hatches. NEVER reads as live. */
  stale?: boolean;
  /** Last-known update time, shown only while stale (e.g. "12:04:38"). */
  lastSeen?: string;
  /** station = large glanceable (trainee); compact = dense (AAR/instructor). */
  size?: "station" | "compact";
  lang?: "he" | "en";
}

/**
 * Monitored vital with a never-stale reconnecting state.
 * @startingPoint section="Vitals" subtitle="Vital readout with severity coding + honest reconnecting state" viewport="700x260"
 */
export function VitalCard(props: VitalCardProps): JSX.Element;
