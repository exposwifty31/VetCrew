import React from "react";

function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css; document.head.appendChild(el);
}

inject("vc-task", `
.vc-task {
  position: relative;
  box-sizing: border-box;
  display: block;
  width: 100%;
  padding: 6px; /* concentric padding for double bezel */
  background: var(--surface-base);
  border: var(--border-w) solid var(--border-subtle);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
  text-decoration: none;
  transition: border-color var(--dur-fast) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
.vc-task__inner {
  position: relative;
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  gap: 12px;
  width: 100%;
  min-height: calc(var(--touch-min) - 12px);
  padding: 12px;
  text-align: start;
  background: var(--surface-card);
  border: var(--border-w) solid var(--border-default);
  border-radius: calc(var(--radius-xl) - 6px);
  font-family: var(--font-ui);
  color: var(--text-primary);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05);
  transition: border-color var(--dur-fast) var(--ease-standard),
              background var(--dur-fast) var(--ease-standard);
}
.vc-task:hover:not([aria-disabled="true"]) .vc-task__inner {
  border-color: var(--task-action, var(--action));
  background: var(--surface-card-hover);
}
.vc-task:hover:not([aria-disabled="true"]) {
  border-color: var(--action);
  box-shadow: var(--shadow-glow-watch);
}
.vc-task:focus-visible {
  outline: var(--focus-w) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}
.vc-task:active:not([aria-disabled="true"]) {
  transform: scale(0.98);
}

/* filled SQUARE badge — the code's colour lives here, matte, contained */
.vc-task__badge {
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: flex-start;
  color: var(--c-white);
}
.vc-task__badge svg {
  width: 22px;
  height: 22px;
}
.vc-task--do .vc-task__badge { background: var(--task-do); color: var(--task-do-fg); }
.vc-task--report .vc-task__badge { background: var(--task-report); color: var(--task-report-fg); }
.vc-task--timed .vc-task__badge { background: var(--task-timed); color: var(--task-timed-fg); }
.vc-task--approval .vc-task__badge { background: var(--task-approval); color: var(--task-approval-fg); }

.vc-task__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.vc-task__code {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.vc-task--do .vc-task__code { color: var(--task-do-text); }
.vc-task--report .vc-task__code { color: var(--task-report-text); }
.vc-task--timed .vc-task__code { color: var(--task-timed-text); }
.vc-task--approval .vc-task__code { color: var(--task-approval-text); }

.vc-task__title {
  font-size: var(--fs-body);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.25;
}
.vc-task__detail {
  font-size: var(--fs-sm);
  color: var(--text-secondary);
  line-height: 1.35;
}

/* timed window */
.vc-task__win {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}
.vc-task__win b {
  color: var(--task-timed-text);
  font-weight: 600;
}
.vc-task__win[data-closing="1"] b {
  color: var(--task-do-text);
  animation: vc-task-closing .8s steps(1,end) infinite;
}
.vc-task__win[data-closing="1"]::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: var(--task-do);
  animation: vc-task-closing .8s steps(1,end) infinite;
}

/* report field */
.vc-task__report {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.vc-task__field {
  width: 88px;
  height: 38px;
  border-radius: var(--radius-sm);
  background: var(--surface-base);
  border: var(--border-w) solid var(--border-default);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 16px;
  text-align: center;
  padding: 0 6px;
}
.vc-task__field:focus-visible {
  outline: var(--focus-w) solid var(--focus-ring);
  outline-offset: 1px;
}
.vc-task__funit {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--text-muted);
}

/* ---- medication ROUTE selector ---- */
.vc-task__route {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
.vc-task__route-lbl {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.vc-task__routes {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
}
.vc-task__route-opt {
  min-height: var(--touch-min);
  min-width: 52px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  background: var(--surface-base);
  border: var(--border-w) solid var(--border-default);
  color: var(--text-secondary);
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-standard),
              background var(--dur-fast) var(--ease-standard),
              color var(--dur-fast) var(--ease-standard);
}
.vc-task__route-opt:hover {
  border-color: var(--task-action, var(--action));
  color: var(--text-primary);
}
.vc-task__route-opt:focus-visible {
  outline: var(--focus-w) solid var(--focus-ring);
  outline-offset: 2px;
}
.vc-task__route-opt[aria-pressed="true"] {
  border-color: var(--task-action, var(--action));
  border-width: 1.5px;
  background: var(--surface-card-hover);
  color: var(--text-primary);
}
.vc-task__route-opt[data-err="1"][aria-pressed="true"] {
  border-color: var(--text-critical);
  color: var(--text-critical);
}
.vc-task__route-err {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-critical);
}
.vc-task__route-err svg {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

/* trailing affordance */
.vc-task__tail {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
}
.vc-task__state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-ui);
}
.vc-task__state svg {
  width: 16px;
  height: 16px;
}
.vc-task__spin {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-default);
  border-top-color: var(--action);
  border-radius: 50%;
  animation: vc-task-spin .8s linear infinite;
}
.vc-task__call {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: var(--touch-min);
  padding: 0 14px;
  border-radius: var(--radius-sm);
  background: var(--task-approval);
  color: var(--task-approval-fg);
  border: none;
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: transform var(--dur-fast) var(--ease-standard), filter var(--dur-fast) var(--ease-standard);
}
.vc-task__call svg {
  width: 17px;
  height: 17px;
}
.vc-task__call:hover {
  filter: brightness(1.1);
}
.vc-task__call:active {
  transform: scale(0.96);
}
.vc-task__call:focus-visible {
  outline: var(--focus-w) solid var(--focus-ring);
  outline-offset: 2px;
}

/* ---- lifecycle states ---- */
.vc-task[data-state="in_progress"] .vc-task__inner {
  border-color: var(--task-action, var(--action));
  background: var(--surface-card-hover);
}
.vc-task[data-state="in_progress"] {
  border-color: var(--action);
  box-shadow: var(--shadow-glow-watch);
}
.vc-task[data-state="done"] {
  opacity: .72;
  cursor: default;
}
.vc-task[data-state="done"] .vc-task__title {
  color: var(--text-muted);
}
.vc-task[data-state="done"] .vc-task__state {
  color: var(--text-running);
}
.vc-task[data-state="error"] .vc-task__inner {
  border-color: var(--text-critical);
}
.vc-task[data-state="error"] {
  border-color: var(--text-critical);
  box-shadow: var(--shadow-glow-critical);
}
.vc-task[data-state="error"] .vc-task__state {
  color: var(--text-critical);
}
.vc-task[data-state="error"] .vc-task__badge {
  position: relative;
}
.vc-task[data-state="locked"] {
  opacity: .5;
  cursor: not-allowed;
  background: var(--task-bg-2, var(--surface-base));
}
.vc-task[data-state="locked"] .vc-task__inner {
  border-style: dashed;
}
.vc-task[data-state="locked"] .vc-task__badge {
  filter: grayscale(.85);
}
.vc-task[data-state="released"] .vc-task__inner {
  border-color: var(--action);
  border-style: dashed;
}
.vc-task[data-state="released"] .vc-task__state {
  color: var(--action-quiet);
}
.vc-task__field[data-error="1"] {
  border-color: var(--text-critical);
  color: var(--text-critical);
  animation: vc-task-shake .3s;
}
@keyframes vc-task-shake {
  0%,100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
`);

const ICON = {
  do:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  report:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
  timed:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>,
  approval: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="9" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>,
};
const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5 9.5 18 20 6"/></svg>;
const XMARK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>;
const PHONE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5c0 8 7 15 15 15l0-3.5-4-1.5-2 2a12 12 0 0 1-5-5l2-2L8.5 5Z"/></svg>;
const LOCK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="9" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>;
const ALERT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 1.5 21h21Z"/><path d="M12 10v5"/><path d="M12 18h.01"/></svg>;

const CODE_HE = { do: "בצע", report: "בצע ודווח", timed: "מתוזמן", approval: "אישור נדרש" };
const STATE_HE = { done: "הושלם", error: "שגיאה", in_progress: "בתהליך", released: "שוחרר — זמין", locked: "ננעל" };
const ROUTE_LABEL_HE = "מתן"; // route of administration
const DEFAULT_ROUTES = ["IV", "IM", "SC", "PO"];

/**
 * TaskChip — the base-rung task primitive (SmartFlow-style mental model, our
 * own visuals). MATTE and CONTAINED: it lives only inside the task panel and
 * never borrows a channel colour. Redundantly coded: filled square badge colour
 * + code icon shape + Hebrew code label. Four codes (do / report / timed /
 * approval) × six lifecycle states.
 *
 * A `report` task is the medication primitive: the technician scores on THREE
 * independent dimensions — drug (named in the task), dose (the `report` value,
 * ml), and ROUTE (`routeOptions` selector). Route is never pre-filled and never
 * hinted; a contraindicated route is selectable, LOGGED (`routeError`), and a
 * FAIL — never blocked, never auto-corrected. WHICH routes are contraindicated
 * is scenario data pending clinical sign-off (§2.5); this component only renders
 * what it is told.
 */
export function TaskChip({
  code = "do", state = "available",
  title, detail,
  window: win,                 // timed: { label, remaining, closing }
  reportUnit, reportValue, reportError, onReportChange,
  route, routeOptions, onRouteChange, routeError, // medication: dose + ROUTE
  holder,                      // locked: who holds it
  onStart, onCallDoctor,
  lang = "he", className = "", ...rest
}) {
  const disabled = state === "locked";
  const hasRoute = Array.isArray(routeOptions) && routeOptions.length > 0;
  // A medication chip carries inner interactive controls (field + route
  // buttons), so the whole chip is NOT a button — that would nest buttons.
  const interactive = !disabled && state !== "done" && code !== "approval" && !hasRoute;
  const Tag = interactive ? "button" : "div";
  const extra = Tag === "button" ? { type: "button", onClick: onStart } : {};
  const routeDisabled = disabled || state === "done";

  return (
    <Tag
      className={`vc-task vc-task--${code} ${className}`}
      data-state={state}
      aria-disabled={disabled ? "true" : undefined}
      {...extra} {...rest}
    >
      <div className="vc-task__inner">
        <span className="vc-task__badge" aria-hidden="true">
          {state === "done" ? CHECK : state === "error" ? XMARK : state === "locked" ? LOCK : ICON[code]}
        </span>
        <span className="vc-task__body">
          <span className="vc-task__code">{CODE_HE[code]}</span>
          <span className="vc-task__title">{title}</span>
          {detail ? <span className="vc-task__detail">{detail}</span> : null}
          {code === "timed" && win ? (
            <span className="vc-task__win" data-closing={win.closing ? "1" : undefined}>
              {win.label} · <b>{win.remaining}</b>
            </span>
          ) : null}
          {code === "report" && reportUnit ? (
            <span className="vc-task__report">
              <input
                className="vc-task__field" data-error={reportError ? "1" : undefined}
                inputMode="decimal" placeholder="—" aria-label={`ערך שנמדד (${reportUnit})`}
                value={reportValue ?? ""} onChange={(e) => onReportChange && onReportChange(e.target.value)}
                disabled={routeDisabled}
              />
              <span className="vc-task__funit">{reportUnit}</span>
            </span>
          ) : null}
          {hasRoute ? (
            <span className="vc-task__route" role="group" aria-label={ROUTE_LABEL_HE}>
              <span className="vc-task__route-lbl">{ROUTE_LABEL_HE}</span>
              <span className="vc-task__routes">
                {routeOptions.map((r) => {
                  const selected = route === r;
                  return (
                    <button
                      key={r} type="button" className="vc-task__route-opt"
                      aria-pressed={selected} data-err={selected && routeError ? "1" : undefined}
                      disabled={routeDisabled}
                      onClick={() => onRouteChange && onRouteChange(r)}
                    >{r}</button>
                  );
                })}
              </span>
              {routeError && route ? (
                <span className="vc-task__route-err">{ALERT}מתן שגוי — נרשם</span>
              ) : null}
            </span>
          ) : null}
        </span>
        <span className="vc-task__tail">
          {state === "in_progress" ? <span className="vc-task__spin" aria-label="בתהליך" /> : null}
          {state === "done" ? <span className="vc-task__state">{CHECK}{STATE_HE.done}</span> : null}
          {state === "error" ? <span className="vc-task__state">{XMARK}{STATE_HE.error}</span> : null}
          {state === "released" ? <span className="vc-task__state">{STATE_HE.released}</span> : null}
          {state === "locked" ? <span className="vc-task__state" style={{ color: "var(--text-muted)" }}>{LOCK}{holder ? `${STATE_HE.locked} · ${holder}` : STATE_HE.locked}</span> : null}
          {code === "approval" && state !== "locked" && state !== "done" ? (
            <button type="button" className="vc-task__call" onClick={onCallDoctor}>{PHONE}קרא לרופא</button>
          ) : null}
        </span>
      </div>
    </Tag>
  );
}
