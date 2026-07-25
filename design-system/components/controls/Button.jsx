import React from "react";

/* Injects a component's CSS once. Design-system components are self-contained;
   we use real CSS classes (not inline styles) so :hover/:focus/:active work. */
function inject(id, css) {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

inject("vc-button", `
.vc-btn {
  --_h: var(--control-h);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sp-2);
  min-height: var(--_h);
  min-width: var(--touch-min);
  padding-inline: var(--sp-6);
  box-sizing: border-box;
  font-family: var(--font-ui);
  font-size: var(--fs-body);
  font-weight: var(--fw-semibold);
  line-height: 1;
  border: var(--border-w) solid transparent;
  border-radius: var(--radius-pill); /* premium pill rounding */
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
  user-select: none;
  box-shadow: var(--shadow-card);
  transition: background var(--dur-fast) var(--ease-standard),
              border-color var(--dur-fast) var(--ease-standard),
              color var(--dur-fast) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
.vc-btn:focus-visible {
  outline: var(--focus-w) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}
.vc-btn:active {
  transform: scale(0.98);
}
.vc-btn[disabled] {
  cursor: not-allowed;
  opacity: .45;
  transform: none;
  box-shadow: none;
}
.vc-btn--lg {
  --_h: var(--control-h-lg);
  font-size: var(--fs-body-lg);
  padding-inline: var(--sp-8);
}
.vc-btn--sm {
  --_h: var(--control-h-sm);
  font-size: var(--fs-sm);
  padding-inline: var(--sp-4);
  border-radius: var(--radius-md); /* moderate curves for compact buttons */
}
.vc-btn--block {
  width: 100%;
}
.vc-btn--primary {
  background: var(--action);
  color: var(--on-action);
  border-color: rgba(255, 255, 255, 0.08);
}
.vc-btn--primary:hover:not([disabled]) {
  background: var(--action-hover);
  box-shadow: var(--shadow-glow-running);
}
.vc-btn--primary:active:not([disabled]) {
  background: var(--action-press);
}
.vc-btn--secondary {
  background: var(--surface-card);
  color: var(--action-quiet);
  border-color: var(--border-default);
}
.vc-btn--secondary:hover:not([disabled]) {
  background: var(--surface-card-hover);
  border-color: var(--action);
  color: var(--action-hover);
}
.vc-btn--ghost {
  background: transparent;
  color: var(--action-quiet);
  box-shadow: none;
}
.vc-btn--ghost:hover:not([disabled]) {
  background: var(--surface-card-hover);
  color: var(--action-hover);
}
.vc-btn--danger {
  background: var(--text-critical);
  color: var(--c-white);
}
.vc-btn--danger:hover:not([disabled]) {
  background: var(--verm-700);
  box-shadow: var(--shadow-glow-critical);
}

/* Button-in-Button premium nested icon container */
.vc-btn__ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.12); /* nested highlight circle */
  flex: 0 0 auto;
  transition: transform var(--dur-fast) var(--ease-standard);
}
.vc-btn--secondary .vc-btn__ico {
  background: var(--border-subtle);
}
.vc-btn:hover:not([disabled]) .vc-btn__ico {
  transform: scale(1.05);
}
.vc-btn__ico svg {
  width: 14px;
  height: 14px;
}
`);

/**
 * Primary action control. Petrol-teal = interactive everywhere; never used for
 * severity or status. `danger` is reserved for destructive/irreversible actions
 * (end session, discard) which the instructor console confirms first.
 */
export function Button({
  variant = "primary",
  size = "md",
  block = false,
  iconStart,
  iconEnd,
  type = "button",
  as,
  className = "",
  children,
  ...rest
}) {
  const Tag = as || "button";
  const cls = [
    "vc-btn",
    `vc-btn--${variant}`,
    size !== "md" ? `vc-btn--${size}` : "",
    block ? "vc-btn--block" : "",
    className,
  ].filter(Boolean).join(" ");
  const extra = Tag === "button" ? { type } : {};
  return (
    <Tag className={cls} {...extra} {...rest}>
      {iconStart ? <span className="vc-btn__ico" aria-hidden="true">{iconStart}</span> : null}
      {children ? <span>{children}</span> : null}
      {iconEnd ? <span className="vc-btn__ico" aria-hidden="true">{iconEnd}</span> : null}
    </Tag>
  );
}
