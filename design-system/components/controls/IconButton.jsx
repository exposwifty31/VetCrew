import React from "react";

function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css; document.head.appendChild(el);
}

inject("vc-iconbtn", `
.vc-iconbtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--touch-min);
  height: var(--touch-min);
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  padding: 0;
  box-sizing: border-box;
  border: var(--border-w) solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: background var(--dur-fast) var(--ease-standard),
              border-color var(--dur-fast) var(--ease-standard),
              color var(--dur-fast) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
.vc-iconbtn:hover:not([disabled]) {
  background: var(--surface-card-hover);
  color: var(--action-quiet);
  border-color: var(--action);
  box-shadow: var(--shadow-glow-running);
}
.vc-iconbtn:focus-visible {
  outline: var(--focus-w) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}
.vc-iconbtn:active:not([disabled]) {
  transform: scale(0.95);
}
.vc-iconbtn[disabled] {
  opacity: .45;
  cursor: not-allowed;
  box-shadow: none;
}
.vc-iconbtn--solid {
  background: var(--action);
  color: var(--on-action);
  border-color: rgba(255, 255, 255, 0.08);
}
.vc-iconbtn--solid:hover:not([disabled]) {
  background: var(--action-hover);
  color: var(--on-action);
}
.vc-iconbtn--lg {
  width: var(--control-h-lg);
  height: var(--control-h-lg);
  border-radius: var(--radius-lg);
}
.vc-iconbtn__g {
  display: inline-flex;
  width: 22px;
  height: 22px;
  transition: transform var(--dur-fast) var(--ease-standard);
}
.vc-iconbtn:hover:not([disabled]) .vc-iconbtn__g {
  transform: scale(1.05);
}
.vc-iconbtn__g svg {
  width: 100%;
  height: 100%;
}
`);

/**
 * Square icon-only control at the 44px touch floor. `label` is required and
 * becomes the accessible name.
 */
export function IconButton({ label, icon, variant = "ghost", size = "md", type = "button", className = "", ...rest }) {
  const cls = ["vc-iconbtn", variant === "solid" ? "vc-iconbtn--solid" : "", size === "lg" ? "vc-iconbtn--lg" : "", className].filter(Boolean).join(" ");
  return (
    <button type={type} className={cls} aria-label={label} title={label} {...rest}>
      <span className="vc-iconbtn__g" aria-hidden="true">{icon}</span>
    </button>
  );
}
