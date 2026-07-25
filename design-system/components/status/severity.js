/* VetCrew severity model — shared business logic (not a component).
   The ONE loudest semantic in the system. Every ALARM level is redundantly
   coded: color + a unique SHAPE (see SeverityGlyph) + a text label + rank/pos.
   Coherence rule: "normal" is QUIET — neutral, uncolored, and SHAPELESS. Color
   and shape appear only when something is wrong.

   Two consumers, two granularities (intentional):
     · review surface (SeverityChip / AAR) uses the full 4-level distinction.
     · the live monitor's alarm chrome is coarser — see `monitorLevel`.
       instrument.css implements `caution` + `critical` treatments only, so
       `watch` + `elevated` both map to `caution` (per the handoff contract).
       A distinct low-priority "advisory" monitor tier for `watch`
       (IEC 60601-1-8 low/medium/high) is a possible future refinement and
       would need its own chrome in instrument.css. */
export const SEVERITY_ORDER = ["normal", "watch", "elevated", "critical"];

export const SEVERITY = {
  normal:   { rank: 0, he: "תקין",  en: "Normal",   shape: null,       motion: "none",       monitorLevel: "normal",   fg: "var(--sev-normal-fg)",   fill: "var(--sev-normal-fill)",   edge: "var(--sev-normal-edge)" },
  watch:    { rank: 1, he: "מעקב",  en: "Watch",    shape: "dot",      motion: "none",       monitorLevel: "caution",  fg: "var(--sev-watch-fg)",    fill: "var(--sev-watch-fill)",    edge: "var(--sev-watch-edge)" },
  elevated: { rank: 2, he: "מוחמר", en: "Elevated", shape: "triangle", motion: "flash-slow", monitorLevel: "caution",  fg: "var(--sev-elevated-fg)", fill: "var(--sev-elevated-fill)", edge: "var(--sev-elevated-edge)" },
  critical: { rank: 3, he: "קריטי", en: "Critical", shape: "octagon",  motion: "pulse-fast", monitorLevel: "critical", fg: "var(--sev-critical-fg)", fill: "var(--sev-critical-fill)", edge: "var(--sev-critical-edge)" },
};

export function severityMeta(level) {
  return SEVERITY[level] || SEVERITY.normal;
}

/* Map a review-surface severity level to the live monitor's alarm chrome tier
   (normal | caution | critical). Kept as a helper so the monitor never reaches
   into the model's coarsening rule directly. */
export function monitorAlarmLevel(level) {
  return severityMeta(level).monitorLevel;
}
