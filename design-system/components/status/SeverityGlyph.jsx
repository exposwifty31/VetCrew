import React from "react";
import { severityMeta } from "./severity.js";

/**
 * The shape half of severity's redundant coding. Each ALARM level owns a distinct
 * silhouette so criticality is legible with zero color perception:
 *   watch = dot, elevated = triangle, critical = octagon.
 * `normal` is QUIET — it has no shape and renders NOTHING (a healthy patient is
 * not an alarm). Colored by `currentColor` (inherits the chip/card severity color).
 */
export function SeverityGlyph({ level = "normal", size = 18, title, ...rest }) {
  const shape = severityMeta(level).shape;
  if (!shape) return null; // normal / quiet — no alarm silhouette to draw
  let node;
  if (shape === "dot") {
    node = <circle cx="12" cy="12" r="4.5" fill="currentColor" />;
  } else if (shape === "triangle") {
    node = <path d="M12 4.2 L20.2 19 H3.8 Z" fill="currentColor" />;
  } else { // octagon
    node = <path d="M8.3 3.5 h7.4 L20.5 8.3 v7.4 L15.7 20.5 h-7.4 L3.5 15.7 v-7.4 Z" fill="currentColor" />;
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role={title ? "img" : "presentation"} aria-hidden={title ? undefined : true} aria-label={title} {...rest}>
      {node}
    </svg>
  );
}
