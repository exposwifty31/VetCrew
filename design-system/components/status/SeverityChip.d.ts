import * as React from "react";

export type SeverityLevel = "normal" | "watch" | "elevated" | "critical";

export interface SeverityChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Criticality level. `normal` is intentionally quiet/neutral. */
  level?: SeverityLevel;
  /** solid = tinted fill (default), outline = hairline, bare = glyph + label only. */
  appearance?: "solid" | "outline" | "bare";
  size?: "sm" | "md" | "lg";
  /** Label language. Hebrew-first. */
  lang?: "he" | "en";
  /** Hide the text label (glyph still carries shape redundancy). */
  showLabel?: boolean;
  /** Optional trailing value shown in tabular figures (e.g. a count or reading). */
  value?: string | number;
}

/**
 * Criticality chip — color + shape + label, never color alone.
 * @startingPoint section="Status" subtitle="Color-blind-safe severity chip: normal/watch/elevated/critical" viewport="700x150"
 */
export function SeverityChip(props: SeverityChipProps): JSX.Element;
