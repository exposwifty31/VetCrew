import React from "react";

function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css; document.head.appendChild(el);
}

inject("vc-connpill", `
.vc-connpill {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  box-sizing: border-box;
  min-height: 28px;
  padding-inline: var(--sp-3);
  border-radius: var(--radius-pill);
  font-family: var(--font-ui);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  letter-spacing: var(--ls-caps);
  text-transform: uppercase;
  line-height: 1;
  border: var(--border-w) solid;
  white-space: nowrap;
  box-shadow: var(--shadow-card);
  transition: all var(--dur-fast) var(--ease-standard);
}
.vc-connpill__g {
  display: inline-flex;
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
}
.vc-connpill__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: currentColor;
}
.vc-connpill--live {
  box-shadow: var(--shadow-glow-running);
}
.vc-connpill--live .vc-connpill__dot {
  animation: vc-live-dot 1.8s var(--ease-standard) infinite;
}
.vc-connpill--reconnecting {
  /* hatch reinforces "not live" beyond color */
  background-image: var(--stale-hatch);
  box-shadow: var(--shadow-glow-elevated);
}
.vc-connpill--reconnecting .vc-connpill__g {
  animation: vc-spin 1s linear infinite;
}
`);

const HE = { live: "מחובר", paused: "מושהה", offline: "מנותק", reconnecting: "מתחבר מחדש" };
const EN = { live: "Live", paused: "Paused", offline: "Offline", reconnecting: "Reconnecting" };

function Glyph({ state }) {
  if (state === "live") return <span className="vc-connpill__dot" />;
  if (state === "paused")
    return <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>;
  if (state === "offline")
    return <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.2"/><line x1="6.5" y1="6.5" x2="17.5" y2="17.5" stroke="currentColor" strokeWidth="2.2"/></svg>;
  // reconnecting — indeterminate arc (spins via CSS)
  return <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path d="M12 3 a9 9 0 1 1-8.5 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"/></svg>;
}

/**
 * ConnectionPill — data-freshness channel, independent of severity. States:
 * live / paused / offline / reconnecting. Each has a distinct glyph + label;
 * `reconnecting` also carries a diagonal hatch so a stale state can NEVER be
 * mistaken for live by color alone.
 */
export function ConnectionPill({ state = "live", lang = "he", className = "", ...rest }) {
  const label = (lang === "en" ? EN : HE)[state] || state;
  const style = {
    color: `var(--status-${state}-fg)`,
    background: `var(--status-${state}-fill)`,
    borderColor: `color-mix(in srgb, var(--status-${state}-dot) 55%, transparent)`,
  };
  return (
    <span className={`vc-connpill vc-connpill--${state} ${className}`} style={style} role="status" aria-live={state === "reconnecting" ? "assertive" : "polite"} {...rest}>
      <span className="vc-connpill__g" style={{ color: `var(--status-${state}-dot)` }}><Glyph state={state} /></span>
      <span>{label}</span>
    </span>
  );
}
