import React from "react";

function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css; document.head.appendChild(el);
}

inject("vc-session", `
.vc-session{display:inline-flex;align-items:center;gap:var(--sp-3);font-family:var(--font-ui);}
.vc-session__badge{display:inline-flex;align-items:center;gap:var(--sp-2);min-height:32px;
  padding-inline:var(--sp-3);border-radius:var(--radius-sm);border:var(--border-w) solid var(--border);
  background:var(--surface-2);color:var(--text);font-size:var(--fs-sm);font-weight:var(--fw-semibold);}
.vc-session__dot{width:9px;height:9px;border-radius:50%;background:var(--text-faint);flex:0 0 auto;}
.vc-session--running .vc-session__dot{background:var(--status-running-dot);animation:vc-live-dot 1.8s var(--ease-standard) infinite;}
.vc-session--paused .vc-session__dot{background:var(--status-paused-dot);}
.vc-session--running .vc-session__badge{border-color:color-mix(in srgb,var(--status-running-dot) 55%,transparent);color:var(--status-running-fg);background:var(--status-running-fill);}
.vc-session__clock{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-size:var(--fs-sm);color:var(--text-muted);letter-spacing:var(--ls-num);}
.vc-session__steps{display:flex;align-items:center;gap:0;list-style:none;margin:0;padding:0;}
.vc-session__step{display:inline-flex;align-items:center;gap:var(--sp-2);color:var(--text-faint);font-size:var(--fs-xs);font-weight:var(--fw-medium);}
.vc-session__step + .vc-session__step::before{content:"";width:16px;height:var(--border-w-strong);background:var(--border);margin-inline:var(--sp-2);}
.vc-session__pip{width:8px;height:8px;border-radius:50%;border:var(--border-w-strong) solid var(--border-strong);background:var(--surface);flex:0 0 auto;}
.vc-session__step--done{color:var(--text-muted);}
.vc-session__step--done .vc-session__pip{background:var(--text-faint);border-color:var(--text-faint);}
.vc-session__step--current{color:var(--text-strong);font-weight:var(--fw-bold);}
.vc-session__step--current .vc-session__pip{background:var(--action);border-color:var(--action);box-shadow:0 0 0 3px var(--action-fill);}
`);

export const SESSION_STATES = ["draft", "briefing", "running", "paused", "debrief", "scored", "archived"];
const HE = { draft: "טיוטה", briefing: "תדריך", running: "פעיל", paused: "מושהה", debrief: "תחקיר", scored: "מדורג", archived: "בארכיון" };
const EN = { draft: "Draft", briefing: "Briefing", running: "Running", paused: "Paused", debrief: "Debrief", scored: "Scored", archived: "Archived" };
/* paused is a sub-state of running in the lifecycle rail */
const RAIL = ["draft", "briefing", "running", "debrief", "scored", "archived"];

/**
 * SessionStateIndicator — the FSM state must always be glanceable.
 * `variant="badge"` shows just the current state (+ optional elapsed clock),
 * for tight headers. `variant="stepper"` shows the whole lifecycle rail with
 * done/current marks, for the instructor console / AAR header.
 */
export function SessionState({ state = "running", variant = "badge", elapsed, lang = "he", className = "", ...rest }) {
  const dict = lang === "en" ? EN : HE;
  if (variant === "stepper") {
    const railState = state === "paused" ? "running" : state;
    const curIdx = RAIL.indexOf(railState);
    return (
      <ol className={`vc-session vc-session--${state} ${className}`} aria-label={`מצב סשן: ${dict[state]}`} {...rest}>
        <div className="vc-session__steps">
          {RAIL.map((s, i) => {
            const st = i < curIdx ? "done" : i === curIdx ? "current" : "upcoming";
            const label = s === "running" && state === "paused" ? dict.paused : dict[s];
            return (
              <li key={s} className={`vc-session__step vc-session__step--${st}`} aria-current={i === curIdx ? "step" : undefined}>
                <span className="vc-session__pip" aria-hidden="true" />
                <span>{label}</span>
              </li>
            );
          })}
        </div>
        {elapsed != null ? <span className="vc-session__clock">{elapsed}</span> : null}
      </ol>
    );
  }
  return (
    <span className={`vc-session vc-session--${state} ${className}`} {...rest}>
      <span className="vc-session__badge" role="status">
        <span className="vc-session__dot" aria-hidden="true" />
        <span>{dict[state]}</span>
      </span>
      {elapsed != null ? <span className="vc-session__clock">{elapsed}</span> : null}
    </span>
  );
}
