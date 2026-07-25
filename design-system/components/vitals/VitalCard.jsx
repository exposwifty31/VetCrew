import React from "react";
import { severityMeta } from "../status/severity.js";
import { SeverityChip } from "../status/SeverityChip.jsx";
import { ConnectionPill } from "../status/ConnectionPill.jsx";

/* Injects a component's CSS once. Design-system components are self-contained;
   we use real CSS classes (not inline styles) so :hover/:focus/:active work. */
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css; document.head.appendChild(el);
}

inject("vc-vital", `
.vc-vital {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 6px; /* concentric padding for double bezel */
  background: var(--surface-base);
  border: var(--border-w) solid var(--border-subtle);
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: border-color var(--dur-base) var(--ease-standard), box-shadow var(--dur-base) var(--ease-standard), background var(--dur-base) var(--ease-standard);
  box-shadow: var(--shadow-card);
}
.vc-vital__inner {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  flex: 1;
  background: var(--surface-card);
  border: var(--border-w) solid var(--border-default);
  border-radius: calc(var(--radius-xl) - 6px);
  padding: var(--sp-4) var(--sp-5);
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05); /* subtle internal highlight */
  transition: border-color var(--dur-base) var(--ease-standard), background var(--dur-base) var(--ease-standard);
}
.vc-vital--station .vc-vital__inner {
  padding: var(--sp-5) var(--sp-6);
  min-height: 168px;
}
.vc-vital--compact .vc-vital__inner {
  padding: var(--sp-3) var(--sp-4);
  gap: var(--sp-1);
}

/* severity accents via premium glows and semantic color washes */
.vc-vital[data-sev="watch"] {
  border-color: var(--border-watch-subtle);
  box-shadow: var(--shadow-glow-watch);
}
.vc-vital[data-sev="watch"] .vc-vital__inner {
  border-color: var(--border-watch-subtle);
  background: var(--bg-watch-subtle);
}

.vc-vital[data-sev="elevated"] {
  border-color: var(--border-elevated-subtle);
  box-shadow: var(--shadow-glow-elevated);
}
.vc-vital[data-sev="elevated"] .vc-vital__inner {
  border-color: var(--border-elevated-subtle);
  background: var(--bg-elevated-subtle);
}

.vc-vital[data-sev="critical"] {
  border-color: var(--border-critical-subtle);
  box-shadow: var(--shadow-glow-critical);
}
.vc-vital[data-sev="critical"] .vc-vital__inner {
  border-color: var(--border-critical-subtle);
  background: var(--bg-critical-subtle);
}

.vc-vital__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  flex-wrap: wrap;
}
.vc-vital__labels {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  min-width: 0;
  flex: 1 1 auto;
}
.vc-vital__name {
  font-family: var(--font-ui);
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
  font-size: var(--fs-body);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vc-vital--station .vc-vital__name {
  font-size: var(--fs-h3);
}
.vc-vital__abbr {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--text-muted);
  letter-spacing: var(--ls-caps);
  text-transform: uppercase;
}
.vc-vital__readout {
  display: flex;
  align-items: flex-end;
  gap: var(--sp-2);
}
.vc-vital__num {
  font-family: var(--font-metric);
  font-variant-numeric: tabular-nums lining-nums;
  font-weight: var(--fw-semibold);
  color: var(--text-primary);
  line-height: .95;
  font-size: var(--fs-h1);
  border-radius: var(--radius-xs);
  padding-inline: 2px;
}
.vc-vital--station .vc-vital__num {
  font-size: var(--fs-vital);
  font-weight: var(--fw-medium);
}
.vc-vital__num--up {
  animation: vc-tick-up var(--dur-tick) var(--ease-standard);
}
.vc-vital__num--down {
  animation: vc-tick-down var(--dur-tick) var(--ease-standard);
}
.vc-vital__unit {
  font-family: var(--font-metric);
  font-size: var(--fs-sm);
  color: var(--text-muted);
  padding-bottom: .35em;
}
.vc-vital--station .vc-vital__unit {
  font-size: var(--fs-body-lg);
}
.vc-vital__trend {
  display: inline-flex;
  align-items: center;
  margin-inline-start: auto;
  padding-bottom: .35em;
}
.vc-vital__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-2);
  min-height: 20px;
}

/* ---- STALE / RECONNECTING — must NEVER read as live -------------------- */
.vc-vital--stale .vc-vital__num, .vc-vital--stale .vc-vital__unit, .vc-vital--stale .vc-vital__trend {
  color: var(--text-muted);
  filter: grayscale(1);
}
.vc-vital__veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: var(--stale-hatch);
  border-radius: inherit;
}
.vc-vital__veil::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--stale-veil);
}
.vc-vital__lastseen {
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  color: var(--text-muted);
  letter-spacing: var(--ls-num);
  position: relative;
  z-index: 1;
}
`);

const HE_LASTSEEN = "עודכן לאחרונה";
const HE_STALE_A11Y = "נתונים לא עדכניים — מתחבר מחדש";

function TrendIcon({ dir, color }) {
  if (dir === "flat")
    return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2.5" strokeLinecap="round"/></svg>;
  const up = dir === "up";
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ transform: up ? "none" : "scaleY(-1)" }}>
      <path d="M5 15 L12 7 L19 15" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * VitalCard — a single monitored parameter. Severity is redundantly coded
 * (chip glyph + accent edge + wash). Number uses tabular mono so digits don't
 * jitter as it ticks; a value change flashes (up=amber / down=blue) WITHOUT
 * relayout. When `stale` (connection dropped) the card freezes: values are
 * desaturated + hatched + veiled, a reconnecting pill and last-seen timestamp
 * appear — it can never be mistaken for live data.
 */
export function VitalCard({
  name, abbr, value, unit, level = "normal",
  trend = "flat", stale = false, lastSeen, size = "station",
  lang = "he", className = "", ...rest
}) {
  const meta = severityMeta(level);
  const [flash, setFlash] = React.useState("");
  const prev = React.useRef(value);
  React.useEffect(() => {
    if (stale) return;
    const p = prev.current, n = value;
    if (typeof p === "number" && typeof n === "number" && n !== p) {
      setFlash(n > p ? "up" : "down");
      const t = setTimeout(() => setFlash(""), 320);
      prev.current = n;
      return () => clearTimeout(t);
    }
    prev.current = n;
  }, [value, stale]);

  const trendColor = level === "normal" ? "var(--text-muted)" : meta.fg;
  return (
    <div
      className={`vc-vital vc-vital--${size} ${stale ? "vc-vital--stale" : ""} ${className}`}
      data-sev={stale ? "normal" : level}
      role="group"
      aria-label={
        stale
          ? `${name}${abbr ? " " + abbr : ""} — ${HE_STALE_A11Y}. ${HE_LASTSEEN} ${lastSeen || "—"}`
          : `${name}${abbr ? " " + abbr : ""}`
      }
      aria-live="off"
      {...rest}
    >
      <div className="vc-vital__inner">
        <div className="vc-vital__head">
          <span className="vc-vital__labels">
            <span className="vc-vital__name">{name}</span>
            {abbr ? <span className="vc-vital__abbr">{abbr}</span> : null}
          </span>
          {!stale && level !== "normal" && size !== "compact" ? <SeverityChip level={level} appearance="bare" size={size === "station" ? "md" : "sm"} lang={lang} /> : null}
        </div>

        <div className="vc-vital__readout">
          <span className={`vc-vital__num ${flash ? "vc-vital__num--" + flash : ""}`}>{value}</span>
          {unit ? <span className="vc-vital__unit">{unit}</span> : null}
          {!stale ? <span className="vc-vital__trend"><TrendIcon dir={trend} color={trendColor} /></span> : null}
        </div>

        <div className="vc-vital__foot">
          {stale
            ? <span className="vc-vital__lastseen">{HE_LASTSEEN} {lastSeen || "—"}</span>
            : (size === "compact"
                ? <SeverityChip level={level} appearance="bare" size="sm" lang={lang} />
                : (level === "normal" ? <SeverityChip level="normal" appearance="bare" size="sm" lang={lang} /> : <span />))}
          {stale ? <ConnectionPill state="reconnecting" lang={lang} /> : null}
        </div>

        {stale ? <div className="vc-vital__veil" aria-hidden="true" /> : null}
      </div>
    </div>
  );
}
