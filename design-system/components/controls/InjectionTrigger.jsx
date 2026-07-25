import React from "react";

function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css; document.head.appendChild(el);
}

inject("vc-inject", `
.vc-inject {
  position: relative;
  box-sizing: border-box;
  display: block;
  width: 100%;
  padding: 6px; /* concentric padding for double bezel */
  background: var(--surface-base);
  border: var(--border-w) solid var(--border-subtle);
  border-radius: var(--radius-xl);
  cursor: pointer;
  text-decoration: none;
  box-shadow: var(--shadow-card);
  transition: border-color var(--dur-fast) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
.vc-inject__inner {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  width: 100%;
  min-height: calc(var(--control-h-lg) - 12px);
  padding: var(--sp-3) var(--sp-4);
  text-align: start;
  background: var(--surface-card);
  border: var(--border-w) solid var(--border-default);
  border-radius: calc(var(--radius-xl) - 6px);
  color: var(--text-primary);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05);
  transition: border-color var(--dur-fast) var(--ease-standard),
              background var(--dur-fast) var(--ease-standard);
}
.vc-inject:hover:not([disabled]) .vc-inject__inner {
  border-color: var(--action);
  background: var(--surface-card-hover);
}
.vc-inject:hover:not([disabled]) {
  border-color: var(--action);
  box-shadow: var(--shadow-glow-running);
}
.vc-inject:focus-visible {
  outline: var(--focus-w) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}
.vc-inject:active:not([disabled]) {
  transform: scale(0.98);
}
.vc-inject__top {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
}
.vc-inject__ico {
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  color: var(--text-muted);
  transition: transform var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard);
}
.vc-inject:hover:not([disabled]) .vc-inject__ico {
  transform: scale(1.05);
}
.vc-inject__ico svg {
  width: 100%;
  height: 100%;
}
.vc-inject__title {
  font-size: var(--fs-body);
  font-weight: var(--fw-semibold);
  line-height: 1.15;
  color: var(--text-primary);
}
.vc-inject__kind {
  margin-inline-start: auto;
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  letter-spacing: var(--ls-caps);
  text-transform: uppercase;
  color: var(--text-muted);
  padding-inline: var(--sp-2);
  min-height: 20px;
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-pill);
  background: var(--surface-base);
  border: var(--border-w) solid var(--border-subtle);
}
.vc-inject__desc {
  font-size: var(--fs-sm);
  color: var(--text-secondary);
  line-height: var(--lh-normal);
}
/* FIRED — legible, clearly spent, not just greyed away */
.vc-inject--fired {
  cursor: default;
  border-color: var(--border-running-subtle);
  box-shadow: var(--shadow-glow-running);
}
.vc-inject--fired .vc-inject__inner {
  background: var(--bg-running-subtle);
  border-color: var(--border-running-subtle);
}
.vc-inject--fired .vc-inject__ico {
  color: var(--text-running);
}
.vc-inject__fired {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
  margin-inline-start: auto;
  font-family: var(--font-mono);
  font-size: var(--fs-xs);
  font-weight: var(--fw-semibold);
  color: var(--text-running);
  letter-spacing: var(--ls-num);
}
.vc-inject[disabled] {
  opacity: .45;
  cursor: not-allowed;
  box-shadow: none;
}
`);

const HE_FIRED = "הוזרק";

/**
 * InjectionTrigger — a large, well-spaced Fitts's-law target the instructor
 * fires live. Injections are fast-fire (NO confirmation friction; confirmation
 * is reserved for destructive actions elsewhere). Once fired it shows the time
 * it fired and stays legible (spent, not hidden). `kind` is a neutral category
 * tag — never severity-colored.
 */
export function InjectionTrigger({
  title, description, kind, icon, fired = false, firedAt, disabled = false,
  onFire, className = "", ...rest
}) {
  return (
    <button
      type="button"
      className={`vc-inject ${fired ? "vc-inject--fired" : ""} ${className}`}
      disabled={disabled || fired}
      aria-pressed={fired}
      onClick={fired ? undefined : onFire}
      {...rest}
    >
      <span className="vc-inject__inner">
        <span className="vc-inject__top">
          {icon ? <span className="vc-inject__ico" aria-hidden="true">{icon}</span> : null}
          <span className="vc-inject__title">{title}</span>
          {fired
            ? <span className="vc-inject__fired"><CheckGlyph /> {HE_FIRED} {firedAt}</span>
            : (kind ? <span className="vc-inject__kind">{kind}</span> : null)}
        </span>
        {description ? <span className="vc-inject__desc">{description}</span> : null}
      </span>
    </button>
  );
}

function CheckGlyph() {
  return <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M4 12.5 L9.5 18 L20 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
