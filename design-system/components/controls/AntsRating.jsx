import React from "react";

function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css; document.head.appendChild(el);
}

inject("vc-ants", `
.vc-ants{box-sizing:border-box;display:flex;flex-direction:column;gap:var(--sp-2);font-family:var(--font-ui);}
.vc-ants__head{display:flex;align-items:baseline;justify-content:space-between;gap:var(--sp-3);}
.vc-ants__cat{font-size:var(--fs-body);font-weight:var(--fw-semibold);color:var(--text-strong);}
.vc-ants__val{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-size:var(--fs-sm);color:var(--text-muted);}
.vc-ants__scale{display:grid;grid-template-columns:repeat(5,1fr);gap:var(--sp-1);}
.vc-ants__seg{position:relative;min-height:var(--touch-min);display:flex;align-items:flex-end;justify-content:center;
  padding-bottom:var(--sp-1);border:var(--border-w) solid var(--border);border-radius:var(--radius-sm);
  background:var(--surface-2);cursor:pointer;font-family:var(--font-mono);font-weight:var(--fw-semibold);
  font-size:var(--fs-body);color:var(--text-muted);overflow:hidden;
  transition:border-color var(--dur-fast) var(--ease-standard),color var(--dur-fast) var(--ease-standard);}
.vc-ants__seg::before{content:"";position:absolute;inset-inline:0;bottom:0;height:var(--_fill,0);
  background:var(--action-fill);transition:height var(--dur-base) var(--ease-standard);z-index:0;}
.vc-ants__seg > span{position:relative;z-index:1;}
.vc-ants__seg:hover{border-color:var(--action);color:var(--text);}
.vc-ants__seg:focus-visible{outline:var(--focus-w) solid var(--focus-ring);outline-offset:var(--focus-offset);}
.vc-ants__seg[aria-checked="true"]{border-color:var(--action);color:var(--action-quiet);border-width:var(--border-w-strong);}
.vc-ants__seg[aria-checked="true"]::before{background:var(--action);}
.vc-ants__seg[aria-checked="true"] > span{color:var(--on-action);}
.vc-ants__anchor{min-height:1.4em;font-size:var(--fs-sm);color:var(--text-muted);line-height:var(--lh-normal);}
.vc-ants__evidence{align-self:flex-start;display:inline-flex;align-items:center;gap:var(--sp-1);
  background:none;border:none;padding:var(--sp-1) 0;cursor:pointer;font-family:var(--font-ui);
  font-size:var(--fs-sm);font-weight:var(--fw-semibold);color:var(--action-quiet);}
.vc-ants__evidence:hover{text-decoration:underline;}
.vc-ants__evidence:focus-visible{outline:var(--focus-w) solid var(--focus-ring);outline-offset:var(--focus-offset);border-radius:var(--radius-xs);}
.vc-ants__evidence[disabled]{color:var(--text-faint);cursor:default;text-decoration:none;}
.vc-ants__chev{display:inline-flex;width:14px;height:14px;}
`);

const HE_EVIDENCE = (n) => `${n} אירועים מקושרים`;
const HE_NONE = "אין דירוג עדיין";
const HE_OF = "מתוך 5";

/**
 * AntsRating — one crew-skill (ANTS) category rated 1–5. Redundantly coded
 * (number label + fill height, not color alone). Every rating links to the
 * specific events that justify it: the evidence button calls onJumpToEvidence
 * so the score is never a disconnected number — its source is one click away.
 */
export function AntsRating({
  category, value = null, anchors, evidenceCount = 0,
  onChange, onJumpToEvidence, lang = "he", className = "", ...rest
}) {
  const rootRef = React.useRef(null);
  const chevDir = lang === "en" ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6";
  const anchorText = value && anchors ? anchors[value - 1] : "";

  function onKey(e) {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const cur = value || 0;
    // RTL: ArrowLeft raises, ArrowRight lowers (mirror); Up/Down unambiguous
    const up = e.key === "ArrowUp" || (lang !== "en" ? e.key === "ArrowLeft" : e.key === "ArrowRight");
    const next = Math.min(5, Math.max(1, cur + (up ? 1 : -1)));
    onChange && onChange(next);
  }

  return (
    <div className={`vc-ants ${className}`} {...rest}>
      <div className="vc-ants__head">
        <span className="vc-ants__cat">{category}</span>
        <span className="vc-ants__val">{value ? `${value} ${HE_OF}` : HE_NONE}</span>
      </div>
      <div className="vc-ants__scale" role="radiogroup" aria-label={category} ref={rootRef} onKeyDown={onKey}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
            className="vc-ants__seg"
            style={{ ["--_fill"]: value != null && n <= value ? "42%" : "0%" }}
            onClick={() => onChange && onChange(n)}
          >
            <span>{n}</span>
          </button>
        ))}
      </div>
      <div className="vc-ants__anchor">{anchorText}</div>
      <button
        type="button"
        className="vc-ants__evidence"
        disabled={!evidenceCount}
        onClick={() => onJumpToEvidence && onJumpToEvidence()}
      >
        <span className="vc-ants__chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14"><path d={chevDir} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
        {HE_EVIDENCE(evidenceCount)}
      </button>
    </div>
  );
}
