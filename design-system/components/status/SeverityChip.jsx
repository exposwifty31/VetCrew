import React from "react";
import { severityMeta, SEVERITY } from "./severity.js";
import { SeverityGlyph } from "./SeverityGlyph.jsx";

function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id; el.textContent = css; document.head.appendChild(el);
}

inject("vc-sevchip", `
.vc-sevchip {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  box-sizing: border-box;
  font-family: var(--font-ui);
  font-weight: var(--fw-semibold);
  line-height: 1;
  white-space: nowrap;
  border-radius: var(--radius-pill);
  border: var(--border-w) solid;
  transition: all var(--dur-fast) var(--ease-standard);
}
.vc-sevchip--md {
  min-height: 32px;
  padding-inline: var(--sp-3);
  font-size: var(--fs-sm);
}
.vc-sevchip--sm {
  min-height: 24px;
  padding-inline: var(--sp-2);
  font-size: var(--fs-xs);
  gap: var(--sp-1);
}
.vc-sevchip--lg {
  min-height: 40px;
  padding-inline: var(--sp-4);
  font-size: var(--fs-body);
  gap: var(--sp-2);
}

/* Premium Diffused Status Glows */
.vc-sevchip[data-appearance="solid"][data-level="watch"] {
  box-shadow: var(--shadow-glow-watch);
}
.vc-sevchip[data-appearance="solid"][data-level="elevated"] {
  box-shadow: var(--shadow-glow-elevated);
}
.vc-sevchip[data-appearance="solid"][data-level="critical"] {
  box-shadow: var(--shadow-glow-critical);
}

.vc-sevchip__glyph {
  display: inline-flex;
  flex: 0 0 auto;
}
.vc-sevchip__val {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums lining-nums;
}
`);

const SIZE_GLYPH = { sm: 12, md: 16, lg: 20 };

/**
 * SeverityChip — the primary criticality signal. Redundantly coded: fill/stroke
 * color + a unique SHAPE glyph + the level's text label. Never color-only.
 * `appearance`: solid (tinted fill), outline (hairline), bare (glyph + label,
 * no container — for inline use inside cards).
 */
export function SeverityChip({
  level = "normal",
  appearance = "solid",
  size = "md",
  lang = "he",
  showLabel = true,
  value,
  className = "",
  ...rest
}) {
  const meta = severityMeta(level);
  const label = lang === "en" ? meta.en : meta.he;
  const style =
    appearance === "solid"
      ? { color: meta.fg, background: meta.fill, borderColor: meta.edge }
      : appearance === "outline"
      ? { color: meta.fg, background: "transparent", borderColor: meta.edge }
      : { color: meta.fg, background: "transparent", borderColor: "transparent", paddingInline: 0, minHeight: "auto" };

  return (
    <span
      className={`vc-sevchip vc-sevchip--${size} ${className}`}
      data-level={level}
      data-appearance={appearance}
      style={style}
      role="status"
      aria-label={`${label}${value != null ? " " + value : ""}`}
      {...rest}
    >
      <span className="vc-sevchip__glyph" style={{ color: meta.fg }}>
        <SeverityGlyph level={level} size={SIZE_GLYPH[size]} />
      </span>
      {showLabel ? <span>{label}</span> : null}
      {value != null ? <span className="vc-sevchip__val">{value}</span> : null}
    </span>
  );
}

export { SEVERITY };
