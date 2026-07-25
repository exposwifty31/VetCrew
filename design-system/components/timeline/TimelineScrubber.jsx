import React from "react";

function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css; document.head.appendChild(el);
}

inject("vc-scrub", `
.vc-scrub {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  font-family: var(--font-ui);
  width: 100%;
}
.vc-scrub__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
}
.vc-scrub__time {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-size: var(--fs-body-lg);
  color: var(--text-primary);
  letter-spacing: var(--ls-num);
  font-weight: var(--fw-semibold);
}
.vc-scrub__time small {
  color: var(--text-muted);
  font-size: var(--fs-sm);
  font-weight: var(--fw-regular);
}
.vc-scrub__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-3);
}
.vc-scrub__lg {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  font-size: var(--fs-xs);
  color: var(--text-secondary);
  font-weight: var(--fw-medium);
}
.vc-scrub__lg svg {
  width: 12px;
  height: 12px;
}
.vc-scrub__main {
  position: relative;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--surface-base);
  border: var(--border-w) solid var(--border-default);
  cursor: pointer;
  touch-action: none;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.45);
  transition: border-color var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard);
}
.vc-scrub__main:focus-visible {
  outline: var(--focus-w) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
  border-color: var(--action);
}
.vc-scrub__fill {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  background: var(--action-fill);
  border-start-start-radius: var(--radius-md);
  border-end-start-radius: var(--radius-md);
}
.vc-scrub__playhead {
  position: absolute;
  inset-block: -4px;
  width: 3px;
  background: var(--action);
  border-radius: var(--radius-pill);
  transform: translateX(50%);
  pointer-events: none;
  box-shadow: 0 0 10px var(--action), 0 0 20px var(--action);
  z-index: 5;
}
.vc-scrub__playhead::before {
  content: "";
  position: absolute;
  inset-inline-start: -6px;
  top: -6px;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--action);
  border: 2px solid var(--surface-overlay);
  box-shadow: var(--shadow-glow-running);
}
.vc-scrub__marker {
  position: absolute;
  top: 50%;
  transform: translate(50%,-50%);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--surface-card);
  border: var(--border-w) solid var(--border-default);
  color: var(--text-secondary);
  cursor: pointer;
  padding: 0;
  z-index: 2;
  box-shadow: var(--shadow-card);
  transition: border-color var(--dur-fast) var(--ease-standard), 
              background var(--dur-fast) var(--ease-standard), 
              transform var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
.vc-scrub__marker:hover {
  border-color: var(--action);
  background: var(--surface-card-hover);
  color: var(--text-primary);
  z-index: 10;
  transform: translate(50%,-50%) scale(1.15);
  box-shadow: var(--shadow-glow-watch);
}
.vc-scrub__marker:active {
  transform: translate(50%,-50%) scale(0.95);
}
.vc-scrub__marker:focus-visible {
  outline: var(--focus-w) solid var(--focus-ring);
  outline-offset: 2px;
  z-index: 10;
}
.vc-scrub__marker svg {
  width: 12px;
  height: 12px;
}
.vc-scrub__lane {
  display: grid;
  grid-template-columns: 110px 1fr;
  align-items: center;
  gap: var(--sp-4);
}
.vc-scrub__laneName {
  font-size: var(--fs-sm);
  font-weight: var(--fw-semibold);
  color: var(--text-secondary);
  text-align: start;
}
.vc-scrub__laneTrack {
  position: relative;
  height: 24px;
  border-radius: var(--radius-sm);
  background: var(--surface-base);
  border: var(--border-w) solid var(--border-subtle);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);
}
.vc-scrub__laneTick {
  position: absolute;
  inset-block: 0;
  width: 1px;
  background: var(--playhead-ghost, color-mix(in srgb, var(--action) 45%, transparent));
  transform: translateX(50%);
  pointer-events: none;
  z-index: 1;
}
`);

function fmt(s) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60), r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/* marker shape per type — shape carries meaning, not color alone */
function MarkerGlyph({ type }) {
  switch (type) {
    case "injection": return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 l9 9 -9 9 -9 -9 z" fill="currentColor"/></svg>;
    case "vitals":    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5 L20 19 H4 Z" fill="currentColor"/></svg>;
    case "callout":   return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="currentColor"/></svg>;
    case "phase":     return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="12" height="16" rx="2" fill="currentColor"/></svg>;
    default:          return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6" fill="currentColor"/></svg>; // action
  }
}
const HE_TYPE = { action: "פעולה", injection: "הזרקה", vitals: "שינוי מדד", callout: "קריאה", phase: "שלב" };

/**
 * TimelineScrubber — the AAR spine. A draggable playhead over the session
 * duration, with event markers (shape-coded by type; severity markers colored
 * by level) and optional per-role lanes. Clicking a marker seeks to it — this
 * is how a score jumps to its source events. Time flows RTL-native (T0 at the
 * inline-start / right edge).
 */
export function TimelineScrubber({
  duration = 600, position = 0, markers = [], lanes = null,
  onSeek, onMarkerClick, className = "", ...rest
}) {
  const trackRef = React.useRef(null);
  const pct = (t) => `${Math.min(100, Math.max(0, (t / duration) * 100))}%`;

  function seekFromEvent(clientX) {
    const el = trackRef.current;
    if (!el || !onSeek) return;
    const r = el.getBoundingClientRect();
    const rtl = getComputedStyle(el).direction === "rtl";
    let frac = (clientX - r.left) / r.width;
    if (rtl) frac = 1 - frac;
    onSeek(Math.min(duration, Math.max(0, frac * duration)));
  }
  const dragging = React.useRef(false);
  const onDown = (e) => { dragging.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); seekFromEvent(e.clientX); };
  const onMove = (e) => { if (dragging.current) seekFromEvent(e.clientX); };
  const onUp = () => { dragging.current = false; };
  function onKey(e) {
    if (!onSeek) return;
    const step = e.shiftKey ? 30 : 5;
    if (e.key === "ArrowLeft") { e.preventDefault(); onSeek(Math.min(duration, position + step)); }   // RTL: left = forward
    if (e.key === "ArrowRight") { e.preventDefault(); onSeek(Math.max(0, position - step)); }
    if (e.key === "Home") { e.preventDefault(); onSeek(0); }
    if (e.key === "End") { e.preventDefault(); onSeek(duration); }
  }

  const legendTypes = Array.from(new Set(markers.map((m) => m.type || "action")));

  return (
    <div className={`vc-scrub ${className}`} {...rest}>
      <div className="vc-scrub__head">
        <span className="vc-scrub__time">{fmt(position)} <small>/ {fmt(duration)}</small></span>
        <span className="vc-scrub__legend">
          {legendTypes.map((t) => (
            <span key={t} className="vc-scrub__lg"><MarkerGlyph type={t} /> {HE_TYPE[t] || t}</span>
          ))}
        </span>
      </div>

      <div
        ref={trackRef}
        className="vc-scrub__main"
        role="slider"
        tabIndex={0}
        aria-label="ציר זמן הסשן"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(position)}
        aria-valuetext={fmt(position)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onKeyDown={onKey}
      >
        <div className="vc-scrub__fill" style={{ inlineSize: pct(position) }} />
        {markers.map((m, i) => (
          <button
            key={i}
            type="button"
            className="vc-scrub__marker"
            style={{ insetInlineStart: pct(m.t), color: m.severity ? `var(--sev-${m.severity}-fg)` : undefined, borderColor: m.severity ? `var(--sev-${m.severity}-edge)` : undefined }}
            title={`${HE_TYPE[m.type] || m.type || "פעולה"} · ${fmt(m.t)}${m.label ? " · " + m.label : ""}`}
            aria-label={`${HE_TYPE[m.type] || ""} ${m.label || ""} בזמן ${fmt(m.t)}`}
            onClick={(e) => { e.stopPropagation(); onSeek && onSeek(m.t); onMarkerClick && onMarkerClick(m, i); }}
          >
            <MarkerGlyph type={m.type || "action"} />
          </button>
        ))}
        <div className="vc-scrub__playhead" style={{ insetInlineStart: pct(position) }} />
      </div>

      {lanes ? lanes.map((lane) => (
        <div key={lane.role} className="vc-scrub__lane">
          <span className="vc-scrub__laneName">{lane.label}</span>
          <div className="vc-scrub__laneTrack">
            {markers.filter((m) => m.role === lane.role).map((m, i) => (
              <button
                key={i}
                type="button"
                className="vc-scrub__marker"
                style={{ insetInlineStart: pct(m.t), width: 18, height: 18, color: m.severity ? `var(--sev-${m.severity}-fg)` : undefined }}
                title={`${lane.label} · ${HE_TYPE[m.type] || m.type} · ${fmt(m.t)}`}
                aria-label={`${lane.label} ${HE_TYPE[m.type] || ""} ${fmt(m.t)}`}
                onClick={() => { onSeek && onSeek(m.t); onMarkerClick && onMarkerClick(m, i); }}
              >
                <MarkerGlyph type={m.type || "action"} />
              </button>
            ))}
            <div className="vc-scrub__laneTick" style={{ insetInlineStart: pct(position) }} />
          </div>
        </div>
      )) : null}
    </div>
  );
}
