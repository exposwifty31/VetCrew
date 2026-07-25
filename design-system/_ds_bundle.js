/* @ds-bundle: {"format":4,"namespace":"DesignSystem_ad98cb","components":[{"name":"AntsRating","sourcePath":"components/controls/AntsRating.jsx"},{"name":"Button","sourcePath":"components/controls/Button.jsx"},{"name":"IconButton","sourcePath":"components/controls/IconButton.jsx"},{"name":"InjectionTrigger","sourcePath":"components/controls/InjectionTrigger.jsx"},{"name":"TaskChip","sourcePath":"components/controls/TaskChip.jsx"},{"name":"PatientMonitor","sourcePath":"components/monitor/PatientMonitor.jsx"},{"name":"ConnectionPill","sourcePath":"components/status/ConnectionPill.jsx"},{"name":"SESSION_STATES","sourcePath":"components/status/SessionState.jsx"},{"name":"SessionState","sourcePath":"components/status/SessionState.jsx"},{"name":"SeverityChip","sourcePath":"components/status/SeverityChip.jsx"},{"name":"SEVERITY","sourcePath":"components/status/severity.js"},{"name":"SeverityGlyph","sourcePath":"components/status/SeverityGlyph.jsx"},{"name":"SEVERITY_ORDER","sourcePath":"components/status/severity.js"},{"name":"TimelineScrubber","sourcePath":"components/timeline/TimelineScrubber.jsx"},{"name":"VitalCard","sourcePath":"components/vitals/VitalCard.jsx"}],"sourceHashes":{"assets/icons.js":"467468046f29","components/controls/AntsRating.jsx":"daecd0adb0db","components/controls/Button.jsx":"bad1a7e82c05","components/controls/IconButton.jsx":"859f08f06b9f","components/controls/InjectionTrigger.jsx":"1867a9bfa8b3","components/controls/TaskChip.jsx":"df2bdaf0fc7d","components/monitor/PatientMonitor.jsx":"2137f3a47805","components/status/ConnectionPill.jsx":"6ae66f9e9fc6","components/status/SessionState.jsx":"d95fb9fef139","components/status/SeverityChip.jsx":"98961821fcb9","components/status/SeverityGlyph.jsx":"169dceddbfb7","components/status/severity.js":"2c6b44831273","components/timeline/TimelineScrubber.jsx":"c5491d2ca1df","components/vitals/VitalCard.jsx":"7a15593be513","ui_kits/aar/AarViewer.jsx":"d8baa80150cb","ui_kits/aar/data.js":"da0241931dcb","ui_kits/instructor/Console.jsx":"cd432af4dfe9","ui_kits/instructor/data.js":"1b7701b61704","ui_kits/trainee/Station.jsx":"e6af1c1c7a13","ui_kits/trainee/data.js":"4d21258753c1"},"inlinedExternals":[],"unexposedExports":[{"name":"severityMeta","sourcePath":"components/status/severity.js"}]} */

(() => {

const __ds_ns = (window.DesignSystem_ad98cb = window.DesignSystem_ad98cb || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// assets/icons.js
try { (() => {
/* VetCrew icon helper — wraps Lucide (MIT) for use in cards & UI kits.
   Load order: React → Lucide UMD → this file. Then use <VC.Icon name="heart"/>.
   Imperatively renders into a ref span so it survives React re-renders.
   RTL: pass flip to mirror directional glyphs (chevrons/arrows). */
(function () {
  var R = window.React;
  if (!R) {
    console.error("icons.js: React must load first");
    return;
  }
  function Icon(props) {
    var name = props.name,
      size = props.size || 20,
      stroke = props.stroke || 2,
      flip = props.flip,
      className = props.className || "",
      style = props.style || {};
    var ref = R.useRef(null);
    R.useEffect(function () {
      var host = ref.current;
      if (!host) return;
      host.innerHTML = "";
      var i = document.createElement("i");
      i.setAttribute("data-lucide", name);
      host.appendChild(i);
      if (window.lucide) window.lucide.createIcons({
        attrs: {
          width: size,
          height: size,
          "stroke-width": stroke
        }
      });
    });
    return R.createElement("span", {
      ref: ref,
      className: "vcico " + className,
      "aria-hidden": "true",
      style: Object.assign({
        display: "inline-flex",
        width: size,
        height: size,
        flex: "0 0 auto",
        transform: flip ? "scaleX(-1)" : undefined
      }, style)
    });
  }
  window.VC = window.VC || {};
  window.VC.Icon = Icon;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "assets/icons.js", error: String((e && e.message) || e) }); }

// components/controls/AntsRating.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
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
const HE_EVIDENCE = n => `${n} אירועים מקושרים`;
const HE_NONE = "אין דירוג עדיין";
const HE_OF = "מתוך 5";

/**
 * AntsRating — one crew-skill (ANTS) category rated 1–5. Redundantly coded
 * (number label + fill height, not color alone). Every rating links to the
 * specific events that justify it: the evidence button calls onJumpToEvidence
 * so the score is never a disconnected number — its source is one click away.
 */
function AntsRating({
  category,
  value = null,
  anchors,
  evidenceCount = 0,
  onChange,
  onJumpToEvidence,
  lang = "he",
  className = "",
  ...rest
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
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `vc-ants ${className}`
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "vc-ants__head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-ants__cat"
  }, category), /*#__PURE__*/React.createElement("span", {
    className: "vc-ants__val"
  }, value ? `${value} ${HE_OF}` : HE_NONE)), /*#__PURE__*/React.createElement("div", {
    className: "vc-ants__scale",
    role: "radiogroup",
    "aria-label": category,
    ref: rootRef,
    onKeyDown: onKey
  }, [1, 2, 3, 4, 5].map(n => /*#__PURE__*/React.createElement("button", {
    key: n,
    type: "button",
    role: "radio",
    "aria-checked": value === n,
    tabIndex: value === n || !value && n === 1 ? 0 : -1,
    className: "vc-ants__seg",
    style: {
      ["--_fill"]: value != null && n <= value ? "42%" : "0%"
    },
    onClick: () => onChange && onChange(n)
  }, /*#__PURE__*/React.createElement("span", null, n)))), /*#__PURE__*/React.createElement("div", {
    className: "vc-ants__anchor"
  }, anchorText), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "vc-ants__evidence",
    disabled: !evidenceCount,
    onClick: () => onJumpToEvidence && onJumpToEvidence()
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-ants__chev",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14"
  }, /*#__PURE__*/React.createElement("path", {
    d: chevDir,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), HE_EVIDENCE(evidenceCount)));
}
Object.assign(__ds_scope, { AntsRating });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/AntsRating.jsx", error: String((e && e.message) || e) }); }

// components/controls/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
.vc-btn{--_h:var(--control-h);display:inline-flex;align-items:center;justify-content:center;gap:var(--sp-2);
  min-height:var(--_h);min-width:var(--touch-min);padding-inline:var(--sp-5);box-sizing:border-box;
  font-family:var(--font-ui);font-size:var(--fs-body);font-weight:var(--fw-semibold);line-height:1;
  border:var(--border-w) solid transparent;border-radius:var(--radius-md);cursor:pointer;
  text-decoration:none;white-space:nowrap;user-select:none;
  transition:background var(--dur-fast) var(--ease-standard),border-color var(--dur-fast) var(--ease-standard),color var(--dur-fast) var(--ease-standard),transform var(--dur-fast) var(--ease-standard);}
.vc-btn:focus-visible{outline:var(--focus-w) solid var(--focus-ring);outline-offset:var(--focus-offset);}
.vc-btn:active{transform:translateY(1px);}
.vc-btn[disabled]{cursor:not-allowed;opacity:.5;transform:none;}
.vc-btn--lg{--_h:var(--control-h-lg);font-size:var(--fs-body-lg);padding-inline:var(--sp-6);}
.vc-btn--sm{--_h:var(--control-h-sm);font-size:var(--fs-sm);padding-inline:var(--sp-4);}
.vc-btn--block{width:100%;}
.vc-btn--primary{background:var(--action);color:var(--on-action);}
.vc-btn--primary:hover:not([disabled]){background:var(--action-hover);}
.vc-btn--primary:active:not([disabled]){background:var(--action-press);}
.vc-btn--secondary{background:var(--surface);color:var(--action-quiet);border-color:var(--border-strong);}
.vc-btn--secondary:hover:not([disabled]){background:var(--action-fill);border-color:var(--action);}
.vc-btn--ghost{background:transparent;color:var(--action-quiet);}
.vc-btn--ghost:hover:not([disabled]){background:var(--action-fill);}
.vc-btn--danger{background:var(--sev-critical-fg);color:var(--c-white);}
.vc-btn--danger:hover:not([disabled]){background:var(--verm-700);}
.vc-btn__ico{display:inline-flex;width:1.15em;height:1.15em;flex:0 0 auto;}
.vc-btn__ico svg{width:100%;height:100%;}
`);

/**
 * Primary action control. Petrol-teal = interactive everywhere; never used for
 * severity or status. `danger` is reserved for destructive/irreversible actions
 * (end session, discard) which the instructor console confirms first.
 */
function Button({
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
  const cls = ["vc-btn", `vc-btn--${variant}`, size !== "md" ? `vc-btn--${size}` : "", block ? "vc-btn--block" : "", className].filter(Boolean).join(" ");
  const extra = Tag === "button" ? {
    type
  } : {};
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, extra, rest), iconStart ? /*#__PURE__*/React.createElement("span", {
    className: "vc-btn__ico",
    "aria-hidden": "true"
  }, iconStart) : null, children ? /*#__PURE__*/React.createElement("span", null, children) : null, iconEnd ? /*#__PURE__*/React.createElement("span", {
    className: "vc-btn__ico",
    "aria-hidden": "true"
  }, iconEnd) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/Button.jsx", error: String((e && e.message) || e) }); }

// components/controls/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
inject("vc-iconbtn", `
.vc-iconbtn{display:inline-flex;align-items:center;justify-content:center;
  width:var(--touch-min);height:var(--touch-min);min-width:var(--touch-min);min-height:var(--touch-min);
  padding:0;box-sizing:border-box;border:var(--border-w) solid transparent;border-radius:var(--radius-md);
  background:transparent;color:var(--text-muted);cursor:pointer;
  transition:background var(--dur-fast) var(--ease-standard),color var(--dur-fast) var(--ease-standard);}
.vc-iconbtn:hover:not([disabled]){background:var(--action-fill);color:var(--action-quiet);}
.vc-iconbtn:focus-visible{outline:var(--focus-w) solid var(--focus-ring);outline-offset:var(--focus-offset);}
.vc-iconbtn:active:not([disabled]){transform:translateY(1px);}
.vc-iconbtn[disabled]{opacity:.5;cursor:not-allowed;}
.vc-iconbtn--solid{background:var(--action);color:var(--on-action);}
.vc-iconbtn--solid:hover:not([disabled]){background:var(--action-hover);color:var(--on-action);}
.vc-iconbtn--lg{width:var(--control-h-lg);height:var(--control-h-lg);}
.vc-iconbtn__g{display:inline-flex;width:22px;height:22px;}
.vc-iconbtn__g svg{width:100%;height:100%;}
`);

/**
 * Square icon-only control at the 44px touch floor. `label` is required and
 * becomes the accessible name.
 */
function IconButton({
  label,
  icon,
  variant = "ghost",
  size = "md",
  type = "button",
  className = "",
  ...rest
}) {
  const cls = ["vc-iconbtn", variant === "solid" ? "vc-iconbtn--solid" : "", size === "lg" ? "vc-iconbtn--lg" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: cls,
    "aria-label": label,
    title: label
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "vc-iconbtn__g",
    "aria-hidden": "true"
  }, icon));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/controls/InjectionTrigger.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
inject("vc-inject", `
.vc-inject{position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--sp-2);
  width:100%;min-height:var(--control-h-lg);padding:var(--sp-3) var(--sp-4);text-align:start;
  background:var(--surface);border:var(--border-w-strong) solid var(--border-strong);border-radius:var(--radius-md);
  cursor:pointer;font-family:var(--font-ui);color:var(--text);
  transition:border-color var(--dur-fast) var(--ease-standard),background var(--dur-fast) var(--ease-standard),transform var(--dur-fast) var(--ease-standard),box-shadow var(--dur-fast) var(--ease-standard);}
.vc-inject:hover:not([disabled]){border-color:var(--action);background:var(--action-fill);}
.vc-inject:focus-visible{outline:var(--focus-w) solid var(--focus-ring);outline-offset:var(--focus-offset);}
.vc-inject:active:not([disabled]){transform:translateY(1px);}
.vc-inject__top{display:flex;align-items:center;gap:var(--sp-2);}
.vc-inject__ico{display:inline-flex;width:22px;height:22px;flex:0 0 auto;color:var(--text-muted);}
.vc-inject__ico svg{width:100%;height:100%;}
.vc-inject__title{font-size:var(--fs-body);font-weight:var(--fw-semibold);line-height:1.15;}
.vc-inject__kind{margin-inline-start:auto;font-size:var(--fs-xs);font-weight:var(--fw-semibold);
  letter-spacing:var(--ls-caps);text-transform:uppercase;color:var(--text-faint);
  padding-inline:var(--sp-2);min-height:20px;display:inline-flex;align-items:center;
  border-radius:var(--radius-pill);background:var(--surface-2);border:var(--border-w) solid var(--hairline);}
.vc-inject__desc{font-size:var(--fs-sm);color:var(--text-muted);line-height:var(--lh-normal);}
/* FIRED — legible, clearly spent, not just greyed away */
.vc-inject--fired{cursor:default;border-style:solid;border-color:var(--status-running-dot);background:var(--status-running-fill);}
.vc-inject--fired .vc-inject__ico{color:var(--status-running-fg);}
.vc-inject__fired{display:inline-flex;align-items:center;gap:var(--sp-1);margin-inline-start:auto;
  font-family:var(--font-mono);font-size:var(--fs-xs);font-weight:var(--fw-semibold);color:var(--status-running-fg);letter-spacing:var(--ls-num);}
.vc-inject[disabled]{opacity:.45;cursor:not-allowed;}
`);
const HE_FIRED = "הוזרק";

/**
 * InjectionTrigger — a large, well-spaced Fitts's-law target the instructor
 * fires live. Injections are fast-fire (NO confirmation friction; confirmation
 * is reserved for destructive actions elsewhere). Once fired it shows the time
 * it fired and stays legible (spent, not hidden). `kind` is a neutral category
 * tag — never severity-colored.
 */
function InjectionTrigger({
  title,
  description,
  kind,
  icon,
  fired = false,
  firedAt,
  disabled = false,
  onFire,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: `vc-inject ${fired ? "vc-inject--fired" : ""} ${className}`,
    disabled: disabled || fired,
    "aria-pressed": fired,
    onClick: fired ? undefined : onFire
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "vc-inject__top"
  }, icon ? /*#__PURE__*/React.createElement("span", {
    className: "vc-inject__ico",
    "aria-hidden": "true"
  }, icon) : null, /*#__PURE__*/React.createElement("span", {
    className: "vc-inject__title"
  }, title), fired ? /*#__PURE__*/React.createElement("span", {
    className: "vc-inject__fired"
  }, /*#__PURE__*/React.createElement(CheckGlyph, null), " ", HE_FIRED, " ", firedAt) : kind ? /*#__PURE__*/React.createElement("span", {
    className: "vc-inject__kind"
  }, kind) : null), description ? /*#__PURE__*/React.createElement("span", {
    className: "vc-inject__desc"
  }, description) : null);
}
function CheckGlyph() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 12.5 L9.5 18 L20 6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}
Object.assign(__ds_scope, { InjectionTrigger });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/InjectionTrigger.jsx", error: String((e && e.message) || e) }); }

// components/controls/TaskChip.jsx
try { (() => {
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
inject("vc-task", `
.vc-task {
  position: relative;
  box-sizing: border-box;
  display: block;
  width: 100%;
  flex-shrink: 0; /* never compress a chip to fit a flex-column list; the list scrolls */
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
  do: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14M13 6l6 6-6 6"
  })),
  report: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 20h9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"
  })),
  timed: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 8v4l3 2"
  })),
  approval: /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "4.5",
    y: "10.5",
    width: "15",
    height: "9",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 10.5V7a4 4 0 0 1 8 0v3.5"
  }))
};
const CHECK = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.6",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M4 12.5 9.5 18 20 6"
}));
const XMARK = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.6",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M6 6l12 12M18 6 6 18"
}));
const PHONE = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M4 5c0 8 7 15 15 15l0-3.5-4-1.5-2 2a12 12 0 0 1-5-5l2-2L8.5 5Z"
}));
const LOCK = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.2",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("rect", {
  x: "4.5",
  y: "10.5",
  width: "15",
  height: "9",
  rx: "2"
}), /*#__PURE__*/React.createElement("path", {
  d: "M8 10.5V7a4 4 0 0 1 8 0v3.5"
}));
const ALERT = /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.3",
  strokeLinecap: "round",
  strokeLinejoin: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M12 3 1.5 21h21Z"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 10v5"
}), /*#__PURE__*/React.createElement("path", {
  d: "M12 18h.01"
}));
const CODE_HE = {
  do: "בצע",
  report: "בצע ודווח",
  timed: "מתוזמן",
  approval: "אישור נדרש"
};
const STATE_HE = {
  done: "הושלם",
  error: "שגיאה",
  in_progress: "בתהליך",
  released: "שוחרר — זמין",
  locked: "ננעל"
};
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
function TaskChip({
  code = "do",
  state = "available",
  title,
  detail,
  window: win,
  // timed: { label, remaining, closing }
  reportUnit,
  reportValue,
  reportError,
  onReportChange,
  route,
  routeOptions,
  onRouteChange,
  routeError,
  // medication: dose + ROUTE
  holder,
  // locked: who holds it
  onStart,
  onCallDoctor,
  lang = "he",
  className = "",
  ...rest
}) {
  const disabled = state === "locked";
  const hasRoute = Array.isArray(routeOptions) && routeOptions.length > 0;
  // A medication chip carries inner interactive controls (field + route
  // buttons), so the whole chip is NOT a button — that would nest buttons.
  const interactive = !disabled && state !== "done" && code !== "approval" && !hasRoute;
  const Tag = interactive ? "button" : "div";
  const extra = Tag === "button" ? {
    type: "button",
    onClick: onStart
  } : {};
  const routeDisabled = disabled || state === "done";
  return /*#__PURE__*/React.createElement(Tag, {
    className: `vc-task vc-task--${code} ${className}`,
    "data-state": state,
    "aria-disabled": disabled ? "true" : undefined,
    ...extra,
    ...rest
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-task__inner"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-task__badge",
    "aria-hidden": "true"
  }, state === "done" ? CHECK : state === "error" ? XMARK : state === "locked" ? LOCK : ICON[code]), /*#__PURE__*/React.createElement("span", {
    className: "vc-task__body"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-task__code"
  }, CODE_HE[code]), /*#__PURE__*/React.createElement("span", {
    className: "vc-task__title"
  }, title), detail ? /*#__PURE__*/React.createElement("span", {
    className: "vc-task__detail"
  }, detail) : null, code === "timed" && win ? /*#__PURE__*/React.createElement("span", {
    className: "vc-task__win",
    "data-closing": win.closing ? "1" : undefined
  }, win.label, " · ", /*#__PURE__*/React.createElement("b", null, win.remaining)) : null, code === "report" && reportUnit ? /*#__PURE__*/React.createElement("span", {
    className: "vc-task__report"
  }, /*#__PURE__*/React.createElement("input", {
    className: "vc-task__field",
    "data-error": reportError ? "1" : undefined,
    inputMode: "decimal",
    placeholder: "—",
    "aria-label": `ערך שנמדד (${reportUnit})`,
    value: reportValue ?? "",
    onChange: e => onReportChange && onReportChange(e.target.value),
    disabled: routeDisabled
  }), /*#__PURE__*/React.createElement("span", {
    className: "vc-task__funit"
  }, reportUnit)) : null, hasRoute ? /*#__PURE__*/React.createElement("span", {
    className: "vc-task__route",
    role: "group",
    "aria-label": ROUTE_LABEL_HE
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-task__route-lbl"
  }, ROUTE_LABEL_HE), /*#__PURE__*/React.createElement("span", {
    className: "vc-task__routes"
  }, routeOptions.map(r => {
    const selected = route === r;
    return /*#__PURE__*/React.createElement("button", {
      key: r,
      type: "button",
      className: "vc-task__route-opt",
      "aria-pressed": selected,
      "data-err": selected && routeError ? "1" : undefined,
      disabled: routeDisabled,
      onClick: () => onRouteChange && onRouteChange(r)
    }, r);
  })), routeError && route ? /*#__PURE__*/React.createElement("span", {
    className: "vc-task__route-err"
  }, ALERT, "מתן שגוי — נרשם") : null) : null), /*#__PURE__*/React.createElement("span", {
    className: "vc-task__tail"
  }, state === "in_progress" ? /*#__PURE__*/React.createElement("span", {
    className: "vc-task__spin",
    "aria-label": "בתהליך"
  }) : null, state === "done" ? /*#__PURE__*/React.createElement("span", {
    className: "vc-task__state"
  }, CHECK, STATE_HE.done) : null, state === "error" ? /*#__PURE__*/React.createElement("span", {
    className: "vc-task__state"
  }, XMARK, STATE_HE.error) : null, state === "released" ? /*#__PURE__*/React.createElement("span", {
    className: "vc-task__state"
  }, STATE_HE.released) : null, state === "locked" ? /*#__PURE__*/React.createElement("span", {
    className: "vc-task__state",
    style: {
      color: "var(--text-muted)"
    }
  }, LOCK, holder ? `${STATE_HE.locked} · ${holder}` : STATE_HE.locked) : null, code === "approval" && state !== "locked" && state !== "done" ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "vc-task__call",
    onClick: onCallDoctor
  }, PHONE, "קרא לרופא") : null)));
}
Object.assign(__ds_scope, { TaskChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/controls/TaskChip.jsx", error: String((e && e.message) || e) }); }

// components/monitor/PatientMonitor.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
inject("vc-monitor", `
.vc-mon{position:relative;box-sizing:border-box;display:flex;gap:10px;
  background:linear-gradient(180deg,#2c313a,#1d2129 8%,#171b22 92%,#0d1015);
  border-radius:18px;padding:14px;border:1px solid #000;color:#e9eef2;font-family:var(--font-ui);
  box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 18px 50px rgba(0,0,0,.6);}
/* device number font: bold neutral tabular sans (NOT a sci-fi mono) */
.vc-mon,.vc-mon *{--_dnum:var(--font-metric);}
.vc-mon__dev{flex:1;min-width:0;display:flex;flex-direction:column;}
.vc-mon__brand{display:flex;align-items:center;gap:8px;padding:4px 6px 8px;flex:0 0 auto;flex-wrap:nowrap;white-space:nowrap;}
.vc-mon__brand b{font-size:15px;font-weight:800;letter-spacing:.03em;color:#cfd8de;white-space:nowrap;}
.vc-mon__brand span{margin-inline-start:auto;font-size:13px;font-weight:700;letter-spacing:.06em;color:#8492c9;white-space:nowrap;}
/* LED alarm strip */
.vc-mon__led{height:7px;border-radius:4px;background:#0b111a;margin:0 2px 8px;flex:0 0 auto;}
.vc-mon[data-alarm="critical"] .vc-mon__led{animation:vc-led-crit .5s steps(1,end) infinite;}
.vc-mon[data-alarm="caution"] .vc-mon__led{animation:vc-led-caut 1s steps(1,end) infinite;}
/* recessed screen */
.vc-mon__screen{position:relative;flex:1;min-height:0;border-radius:5px;overflow:hidden;background:#000;direction:ltr;
  box-shadow:var(--inst-recess);display:flex;flex-direction:column;}
.vc-mon__frame{position:absolute;inset:0;border-radius:5px;pointer-events:none;z-index:8;border:3px solid transparent;}
.vc-mon[data-alarm="critical"] .vc-mon__frame{border-color:var(--alarm-critical);animation:vc-alarm-crit .5s steps(1,end) infinite;box-shadow:inset 0 0 26px rgba(255,42,42,.4);}
.vc-mon[data-alarm="caution"] .vc-mon__frame{border-color:var(--alarm-caution);animation:vc-alarm-caut 1s steps(1,end) infinite;box-shadow:inset 0 0 20px rgba(255,208,0,.22);}
/* header strip */
.vc-mon__hdr{display:flex;align-items:center;gap:18px;padding:5px 12px;font-size:13px;color:#c7d0d6;flex:0 0 auto;
  border-bottom:1px solid rgba(120,140,160,.12);}
.vc-mon__hdr .k{color:#8a97a1;}
.vc-mon__heart{margin-inline-start:auto;color:#ff3b40;display:inline-flex;}
.vc-mon__heart svg{width:20px;height:20px;animation:vc-heart 1s ease-in-out infinite;}
@keyframes vc-heart{0%,100%{transform:scale(1)}18%{transform:scale(1.28)}36%{transform:scale(1)}}
/* main = waveforms | values */
.vc-mon__main{flex:1;min-height:0;overflow:hidden;display:grid;grid-template-columns:1.55fr 1fr;grid-template-rows:minmax(0,1fr);}
.vc-mon__cwrap{position:relative;min-width:0;min-height:0;border-inline-end:1px solid rgba(120,140,160,.12);}
.vc-mon__canvas{display:block;width:100%;height:100%;}
.vc-mon__values{display:flex;flex-direction:column;min-height:0;height:100%;overflow:hidden;container-type:size;}
.vc-mon__val{flex:1 1 0;min-height:0;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:1px;padding:2px 14px;
  border-bottom:1px solid rgba(120,140,160,.08);position:relative;}
.vc-mon__val:last-child{border-bottom:none;}
.vc-mon__vtop{display:flex;align-items:baseline;gap:8px;flex:0 0 auto;}
.vc-mon__vlabel{font-size:14px;font-weight:800;letter-spacing:.04em;}
.vc-mon__vunit{font-size:11px;color:#8a97a1;font-weight:600;}
.vc-mon__vscale{margin-inline-start:auto;font-family:var(--_dnum);font-size:11px;color:#71808b;text-align:end;line-height:1.15;font-variant-numeric:tabular-nums;}
.vc-mon__num{font-family:var(--_dnum);font-variant-numeric:tabular-nums lining-nums;font-weight:800;line-height:.9;
  display:flex;align-items:flex-end;gap:6px;max-width:100%;overflow:hidden;flex:0 1 auto;min-height:0;}
.vc-mon__num small{font-size:.5em;font-weight:700;padding-bottom:.15em;}
.vc-mon__vsub{display:flex;gap:14px;font-size:11.5px;color:#93a0aa;margin-top:2px;flex-wrap:wrap;flex:0 0 auto;}
.vc-mon__vsub b{font-family:var(--_dnum);color:#c3ccd3;font-variant-numeric:tabular-nums;font-weight:700;}
.vc-mon[data-alarm] .vc-mon__val[data-alarming="1"] .vc-mon__num{animation:vc-num-crit .5s steps(1,end) infinite;}
/* bottom band: temp | co | nibp */
.vc-mon__band{display:grid;grid-template-columns:1.55fr 1fr;border-top:1px solid rgba(120,140,160,.14);flex:0 0 auto;}
.vc-mon__bandL{display:grid;grid-template-columns:1fr 1fr;gap:0;padding:6px 12px;border-inline-end:1px solid rgba(120,140,160,.12);}
.vc-mon__bcell{display:flex;flex-direction:column;gap:1px;}
.vc-mon__bcell .lab{font-size:12px;font-weight:800;color:#dfe6eb;letter-spacing:.03em;}
.vc-mon__bigwhite{font-family:var(--_dnum);font-variant-numeric:tabular-nums;font-weight:800;color:#fff;line-height:.95;font-size:26px;}
.vc-mon__bsub{font-family:var(--_dnum);font-size:11px;color:#8a97a1;font-variant-numeric:tabular-nums;}
.vc-mon__nibp{padding:6px 14px;display:flex;flex-direction:column;justify-content:center;}
.vc-mon__nibp .lab{font-size:12px;font-weight:800;color:#fff;letter-spacing:.03em;}
.vc-mon__nibp .big{font-family:var(--_dnum);font-variant-numeric:tabular-nums;font-weight:800;color:#fff;font-size:30px;line-height:.95;}
.vc-mon__nibp .row{display:flex;gap:10px;font-family:var(--_dnum);font-size:11px;color:#8a97a1;font-variant-numeric:tabular-nums;}
/* bottom control bar */
.vc-mon__bar{display:flex;align-items:center;gap:10px;padding:6px 12px;flex:0 0 auto;border-top:1px solid rgba(120,140,160,.1);}
.vc-mon__stat{display:flex;gap:6px;color:#7f8c96;}
.vc-mon__cfg{margin-inline:auto;font-size:12px;color:#8a97a1;}
.vc-mon__btn{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 12px;border-radius:6px;cursor:pointer;
  background:linear-gradient(180deg,#2f3946,#222a34);border:1px solid #0a0d12;color:#dfe6eb;font-family:var(--font-ui);font-size:12.5px;font-weight:700;}
.vc-mon__btn svg{width:15px;height:15px;}
.vc-mon__btn:hover{filter:brightness(1.12);}
.vc-mon__btn:focus-visible{outline:2px solid var(--inst-focus);outline-offset:2px;}
.vc-mon__btn--accent{background:linear-gradient(180deg,#245a86,#1b4260);}
/* right physical button column */
.vc-mon__rail{flex:0 0 66px;display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 4px;}
.vc-mon__spk{width:46px;height:20px;border-radius:5px;background:#0c0f14;box-shadow:inset 0 1px 2px #000;flex:0 0 auto;}
.vc-mon__hw{width:48px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(180deg,#2b333e,#1b2129);border:1px solid #05070b;color:#c3ccd3;cursor:pointer;box-shadow:0 1px 0 rgba(255,255,255,.05) inset;}
.vc-mon__hw svg{width:22px;height:22px;}
.vc-mon__hw:hover{filter:brightness(1.15);}
.vc-mon__hw:focus-visible{outline:2px solid var(--inst-focus);outline-offset:2px;}
.vc-mon__hw--amber{background:linear-gradient(180deg,#e0a83a,#c08a20);color:#2a1e02;border-color:#7a5a10;}
.vc-mon__hw--amber[data-muted="1"]{box-shadow:0 0 12px var(--alarm-caution-glow);}
.vc-mon__knob{margin-top:auto;width:54px;height:54px;border-radius:50%;flex:0 0 auto;
  background:radial-gradient(circle at 38% 32%,#3a4652,#232a33 60%,#12161c);
  border:1px solid #05070b;box-shadow:0 2px 6px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.06) inset;}
.vc-mon__knob::after{content:"";position:absolute;}
`);

/* ---- waveform generators — sample(t in [0,1)) → y in [-1,1] ------------- */
const g = (t, c, w, a) => a * Math.exp(-((t - c) * (t - c)) / (2 * w * w));
function ecg(t) {
  return g(t, 0.16, 0.016, 0.16) - g(t, 0.235, 0.006, 0.22) + g(t, 0.25, 0.006, 1.0) - g(t, 0.265, 0.008, 0.30) + g(t, 0.44, 0.03, 0.30);
}
function pleth(t) {
  const m = g(t, 0.22, 0.075, 1.0) + g(t, 0.46, 0.06, 0.34);
  return m * 1.6 - 0.8;
}
function art(t) {
  const m = g(t, 0.18, 0.045, 1.0) + g(t, 0.36, 0.05, 0.42);
  return m * 1.55 - 0.78;
}
function capno(t) {
  let v;
  if (t < 0.14) v = 0;else if (t < 0.22) v = (t - 0.14) / 0.08;else if (t < 0.74) v = 1 + (t - 0.22) * 0.06;else if (t < 0.80) v = 1 - (t - 0.74) / 0.06;else v = 0;
  return v * 1.5 - 0.72;
}

/* fixed lane stack, matching the uMEC12 Vet screen */
const WAVES = [{
  key: "ecg1",
  gen: ecg,
  kind: "beat",
  color: "#00ff66",
  label: "I",
  tag: "1mV",
  scale: null
}, {
  key: "ecg2",
  gen: ecg,
  kind: "beat",
  color: "#00ff66",
  label: "II",
  tag: "1mV",
  scale: null
}, {
  key: "pleth",
  gen: pleth,
  kind: "beat",
  color: "#00ccff",
  label: "Pleth",
  tag: "",
  scale: null
}, {
  key: "art",
  gen: art,
  kind: "beat",
  color: "#ff3b30",
  label: "Art",
  tag: "",
  scale: [160, 0],
  ref: [160, 100, 0]
}, {
  key: "co2",
  gen: capno,
  kind: "breath",
  color: "#ffcc00",
  label: "CO2",
  tag: "",
  scale: [50, 0]
}];
const DEF = {
  channels: {
    hr: 60,
    spo2: 98,
    art: {
      sys: 120,
      dia: 75,
      map: 90
    },
    etco2: 38,
    resp: 20
  },
  temp: {
    t1: 37.0,
    t2: 37.2
  },
  co: {
    value: 2.8,
    ci: "---",
    tb: 37.2
  },
  nibp: {
    sys: 120,
    dia: 80,
    map: 93,
    time: "09:57",
    pr: 60
  }
};
function HeartIcon() {
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 21s-7-4.6-9.3-9C1.2 8.8 2.6 5.5 6 5.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.4 0 4.8 3.3 3.3 6.5C19 16.4 12 21 12 21Z"
  }));
}

/**
 * PatientMonitor — Mindray-uMEC12-Vet-style main monitor (layout matched to the
 * real device; brand wordmarks intentionally NOT reproduced). True SWEEP-
 * rendered waveforms (a cursor erases/rewrites the trace, never scrolls) across
 * five lanes: ECG I, ECG II, Pleth, Art, CO2. Channel colour = identity
 * (Layer A); alarm state = separate, redundantly coded (LED strip + full-screen
 * frame + number flash + mute light) = Layer B. Numerals are a bold neutral
 * tabular sans, matching the device (not a stylised mono).
 */
function PatientMonitor({
  patient = {
    species: "dog",
    breed: "Canine",
    weightKg: 32,
    weightRange: "10–23 kg"
  },
  channels = {},
  sub = {},
  // { pvcs, st, pr, pi, awrr, fi } sub-values
  temp = {},
  co = {},
  nibp = {},
  alarm = "normal",
  alarming = [],
  muted = false,
  sweepSpeed = 1,
  clock = "2019-08-21 09:59:38",
  onToggleMute,
  onFreeze,
  onNibp,
  onMenu,
  onAlarmSetup,
  className = "",
  style,
  ...rest
}) {
  const ch = {
    ...DEF.channels,
    ...channels
  };
  const T = {
      ...DEF.temp,
      ...temp
    },
    CO = {
      ...DEF.co,
      ...co
    },
    NB = {
      ...DEF.nibp,
      ...nibp
    };
  const artv = typeof ch.art === "number" ? {
    sys: ch.art,
    dia: Math.round(ch.art * 0.62),
    map: Math.round(ch.art * 0.78)
  } : ch.art;
  const canvasRef = React.useRef(null),
    wrapRef = React.useRef(null);
  const stateRef = React.useRef({
    ch,
    sweepSpeed
  });
  stateRef.current = {
    ch,
    sweepSpeed
  };
  React.useEffect(() => {
    const canvas = canvasRef.current,
      wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    let W = 0,
      H = 0,
      dpr = Math.min(window.devicePixelRatio || 1, 2);
    let buffers = [],
      phase = new Array(WAVES.length).fill(0),
      lastPx = 0,
      started = 0,
      raf;
    const GAP = 16;
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function size() {
      const r = wrap.getBoundingClientRect();
      W = Math.max(2, Math.round(r.width));
      H = Math.max(2, Math.round(r.height));
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buffers = WAVES.map(() => new Array(W).fill(NaN));
      lastPx = 0;
      if (reduce) drawStatic();
    }
    function step(px, prev) {
      const st = stateRef.current,
        pps = 150 * (st.sweepSpeed || 1);
      for (let x = prev + 1; x <= px; x++) {
        const xi = (x % W + W) % W;
        for (let i = 0; i < WAVES.length; i++) {
          const rate = WAVES[i].kind === "beat" ? st.ch.hr || 60 : st.ch.resp || 15;
          phase[i] = (phase[i] + rate / 60 / pps) % 1;
          buffers[i][xi] = WAVES[i].gen(phase[i]);
          buffers[i][(xi + GAP) % W] = NaN;
        }
      }
      render();
    }
    function render() {
      const n = WAVES.length,
        lh = H / n;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        const cy = (i + 0.5) * lh,
          amp = lh * 0.34,
          w = WAVES[i];
        // dashed reference lines (Art)
        if (w.ref) {
          ctx.strokeStyle = "rgba(255,65,54,0.28)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          [-1, 0.15, 1].forEach(r => {
            const y = cy - r * amp;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
          });
          ctx.setLineDash([]);
        }
        ctx.strokeStyle = w.color;
        ctx.lineWidth = 1.8;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowColor = w.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        let pen = false;
        for (let x = 0; x < W; x++) {
          const v = buffers[i][x];
          if (Number.isNaN(v)) {
            pen = false;
            continue;
          }
          const y = cy - v * amp;
          if (!pen) {
            ctx.moveTo(x, y);
            pen = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
        // lane label + gain, drawn at trace start
        ctx.fillStyle = w.color;
        ctx.font = "700 12px system-ui, sans-serif";
        ctx.textBaseline = "top";
        ctx.fillText(w.label, 8, cy - lh / 2 + 4);
        if (w.tag) {
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.font = "10px system-ui";
          ctx.fillText(w.tag, 8, cy + lh / 2 - 16);
        }
      }
    }
    function drawStatic() {
      const st = stateRef.current;
      buffers = WAVES.map(w => {
        const arr = new Array(W);
        const rate = w.kind === "beat" ? st.ch.hr || 60 : st.ch.resp || 15;
        const cycles = Math.max(1, Math.round(rate / 60 * (W / 150)));
        for (let x = 0; x < W; x++) arr[x] = w.gen(x / W * cycles % 1);
        return arr;
      });
      render();
    }
    function loop(t) {
      if (!started) {
        started = t;
        lastPx = 0;
      }
      const pps = 150 * (stateRef.current.sweepSpeed || 1);
      const target = Math.floor((t - started) / 1000 * pps);
      if (target > lastPx) {
        step(target, lastPx);
        lastPx = target;
      }
      raf = requestAnimationFrame(loop);
    }
    const ro = new ResizeObserver(size);
    ro.observe(wrap);
    size();
    if (!reduce) raf = requestAnimationFrame(loop);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  const beatDur = `${(60 / (ch.hr || 60)).toFixed(2)}s`;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `vc-mon ${className}`,
    "data-alarm": alarm !== "normal" ? alarm : undefined,
    role: "group",
    "aria-label": `מוניטור מטופל — ${patient.breed || ""}${patient.weightRange ? " " + patient.weightRange : ""}${alarm !== "normal" ? " — התרעה " + (alarm === "critical" ? "קריטית" : "אזהרה") : ""}`,
    style: style
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__dev"
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__brand"
  }, /*#__PURE__*/React.createElement("b", null, "VET MONITOR"), /*#__PURE__*/React.createElement("span", null, "VM-12")), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__led",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__screen",
    dir: "ltr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__frame",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__hdr"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "Weight"), " ", patient.weightRange || patient.weightKg + " kg"), /*#__PURE__*/React.createElement("span", null, patient.breed), /*#__PURE__*/React.createElement("span", {
    className: "k",
    style: {
      fontVariantNumeric: "tabular-nums"
    }
  }, clock), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__heart",
    style: {
      animationDuration: beatDur
    }
  }, /*#__PURE__*/React.createElement(HeartIcon, null))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__main"
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__cwrap",
    ref: wrapRef
  }, /*#__PURE__*/React.createElement("canvas", {
    className: "vc-mon__canvas",
    ref: canvasRef
  })), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__values"
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__val",
    "data-alarming": alarming.includes("hr") ? "1" : undefined,
    style: {
      flex: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__vtop"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vlabel",
    style: {
      color: "#00ff66"
    }
  }, "ECG"), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vscale"
  }, "100", /*#__PURE__*/React.createElement("br", null), "50")), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__num",
    style: {
      color: "#00ff66",
      fontSize: "clamp(26px, 19cqh, 64px)"
    }
  }, Math.round(ch.hr)), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__vsub"
  }, /*#__PURE__*/React.createElement("span", null, "PVCs ", /*#__PURE__*/React.createElement("b", null, sub.pvcs ?? 0)), /*#__PURE__*/React.createElement("span", null, "ST ", /*#__PURE__*/React.createElement("b", null, sub.st ?? "OFF")))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__val",
    "data-alarming": alarming.includes("spo2") ? "1" : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__vtop"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vlabel",
    style: {
      color: "#00ccff"
    }
  }, "SpO\u2082"), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vunit"
  }, "%"), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vscale"
  }, "100", /*#__PURE__*/React.createElement("br", null), "90")), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__num",
    style: {
      color: "#00ccff",
      fontSize: "clamp(22px, 11cqh, 52px)"
    }
  }, Math.round(ch.spo2)), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__vsub"
  }, /*#__PURE__*/React.createElement("span", null, "PI ", /*#__PURE__*/React.createElement("b", null, sub.pi ?? 12.0)), /*#__PURE__*/React.createElement("span", null, "PR ", /*#__PURE__*/React.createElement("b", null, sub.pr ?? Math.round(ch.hr))))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__val",
    "data-alarming": alarming.includes("art") ? "1" : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__vtop"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vlabel",
    style: {
      color: "#ff3b30"
    }
  }, "Art"), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vunit"
  }, "mmHg"), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vscale"
  }, "160", /*#__PURE__*/React.createElement("br", null), "100")), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__num",
    style: {
      color: "#ff3b30",
      fontSize: "clamp(18px, 8cqh, 38px)"
    }
  }, artv.sys, "/", artv.dia, /*#__PURE__*/React.createElement("small", null, "(", artv.map, ")"))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__val",
    "data-alarming": alarming.includes("etco2") ? "1" : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__vtop"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vlabel",
    style: {
      color: "#ffcc00"
    }
  }, "CO\u2082"), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vunit"
  }, "mmHg Et"), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vscale"
  }, "60", /*#__PURE__*/React.createElement("br", null), "20")), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__num",
    style: {
      color: "#ffcc00",
      fontSize: "clamp(22px, 10cqh, 46px)"
    }
  }, Math.round(ch.etco2)), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__vsub"
  }, /*#__PURE__*/React.createElement("span", null, "awRR ", /*#__PURE__*/React.createElement("b", null, sub.awrr ?? Math.round(ch.resp))), /*#__PURE__*/React.createElement("span", null, "Fi ", /*#__PURE__*/React.createElement("b", null, sub.fi ?? 2)))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__val",
    "data-alarming": alarming.includes("resp") ? "1" : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__vtop"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vlabel",
    style: {
      color: "#ffcc00"
    }
  }, "Resp"), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__vscale"
  }, "45", /*#__PURE__*/React.createElement("br", null), "15")), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__num",
    style: {
      color: "#ffcc00",
      fontSize: "clamp(20px, 9cqh, 40px)"
    }
  }, Math.round(ch.resp)), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__vsub"
  }, /*#__PURE__*/React.createElement("span", null, "Source CO\u2082"))))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__band"
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__bandL"
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__bcell"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "Temp ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#8a97a1",
      fontWeight: 400
    }
  }, "\xB0C")), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__bigwhite"
  }, T.t1.toFixed(1)), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__bigwhite",
    style: {
      fontSize: 20
    }
  }, T.t2.toFixed(1), " ", /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__bsub"
  }, "TD ", Math.abs(T.t1 - T.t2).toFixed(1)))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__bcell"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "C.O."), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__bigwhite"
  }, CO.value.toFixed(1)), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__bsub"
  }, "C.I. ", CO.ci, " \xB7 TB ", CO.tb), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__bsub"
  }, "NIBP ", NB.sys, "/", NB.dia, " (", NB.map, ") \xB7 ", NB.time))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__nibp"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lab"
  }, "NIBP ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "#8a97a1",
      fontWeight: 400
    }
  }, "mmHg")), /*#__PURE__*/React.createElement("span", {
    className: "big"
  }, NB.sys, "/", NB.dia, " ", /*#__PURE__*/React.createElement("small", {
    style: {
      fontSize: 18
    }
  }, "(", NB.map, ")")), /*#__PURE__*/React.createElement("span", {
    className: "row"
  }, /*#__PURE__*/React.createElement("span", null, NB.time), /*#__PURE__*/React.createElement("span", {
    style: {
      marginInlineStart: "auto"
    }
  }, "Manual")))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__stat",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "10",
    width: "18",
    height: "8",
    rx: "1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 10V7h10v3"
  })), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "16",
    height: "16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 12h4l2-4 4 8 2-4h4"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "vc-mon__cfg"
  }, "Current Configuration: Defaults"), /*#__PURE__*/React.createElement("button", {
    className: "vc-mon__btn",
    onClick: onAlarmSetup
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3a6 6 0 0 0-6 6c0 5-2 7-2 7h16s-2-2-2-7a6 6 0 0 0-6-6Z"
  })), "Alarm Setup"), /*#__PURE__*/React.createElement("button", {
    className: "vc-mon__btn vc-mon__btn--accent",
    onClick: onMenu
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "16",
    rx: "2"
  })), "Main Menu")))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__rail"
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__spk",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("button", {
    className: "vc-mon__hw vc-mon__hw--amber",
    "data-muted": muted ? "1" : undefined,
    onClick: onToggleMute,
    "aria-pressed": muted,
    "aria-label": muted ? "התרעה מושתקת" : "השהיית התרעה",
    title: "Alarm pause"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3a6 6 0 0 0-6 6c0 5-2 7-2 7h16s-2-2-2-7a6 6 0 0 0-6-6Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 20a2 2 0 0 0 4 0"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "vc-mon__hw vc-mon__hw--amber",
    onClick: onToggleMute,
    "aria-label": "\u05D0\u05D9\u05E4\u05D5\u05E1 \u05D4\u05EA\u05E8\u05E2\u05D4",
    title: "Alarm reset"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3a6 6 0 0 0-6 6c0 5-2 7-2 7h16s-2-2-2-7a6 6 0 0 0-6-6Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 4l16 16"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "vc-mon__hw",
    onClick: onNibp,
    "aria-label": "\u05D4\u05E4\u05E2\u05DC\u05EA NIBP",
    title: "NIBP"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "7",
    width: "14",
    height: "10",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 17v2M15 17v2"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "vc-mon__hw",
    onClick: onFreeze,
    "aria-label": "\u05D4\u05E7\u05E4\u05D0\u05EA \u05DE\u05E1\u05DA",
    title: "Freeze"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3v18M5 8l14 8M19 8 5 16"
  }))), /*#__PURE__*/React.createElement("button", {
    className: "vc-mon__hw",
    onClick: onMenu,
    "aria-label": "\u05EA\u05E6\u05D5\u05D2\u05D4",
    title: "Display"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "12",
    rx: "1"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "vc-mon__knob",
    "aria-hidden": "true"
  })));
}
Object.assign(__ds_scope, { PatientMonitor });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/monitor/PatientMonitor.jsx", error: String((e && e.message) || e) }); }

// components/status/ConnectionPill.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
inject("vc-connpill", `
.vc-connpill{display:inline-flex;align-items:center;gap:var(--sp-2);box-sizing:border-box;
  min-height:28px;padding-inline:var(--sp-3);border-radius:var(--radius-pill);
  font-family:var(--font-ui);font-size:var(--fs-xs);font-weight:var(--fw-semibold);
  letter-spacing:var(--ls-caps);text-transform:uppercase;line-height:1;
  border:var(--border-w) solid;white-space:nowrap;}
.vc-connpill__g{display:inline-flex;width:14px;height:14px;flex:0 0 auto;}
.vc-connpill__dot{width:9px;height:9px;border-radius:50%;background:currentColor;}
.vc-connpill--live .vc-connpill__dot{animation:vc-live-dot 1.8s var(--ease-standard) infinite;}
.vc-connpill--reconnecting{ /* hatch reinforces "not live" beyond color */
  background-image:var(--stale-hatch);}
.vc-connpill--reconnecting .vc-connpill__g{animation:vc-spin 1s linear infinite;}
`);
const HE = {
  live: "מחובר",
  paused: "מושהה",
  offline: "מנותק",
  reconnecting: "מתחבר מחדש"
};
const EN = {
  live: "Live",
  paused: "Paused",
  offline: "Offline",
  reconnecting: "Reconnecting"
};
function Glyph({
  state
}) {
  if (state === "live") return /*#__PURE__*/React.createElement("span", {
    className: "vc-connpill__dot"
  });
  if (state === "paused") return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "13",
    height: "13",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "5",
    width: "4",
    height: "14",
    rx: "1",
    fill: "currentColor"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "5",
    width: "4",
    height: "14",
    rx: "1",
    fill: "currentColor"
  }));
  if (state === "offline") return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "13",
    height: "13",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "8",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6.5",
    y1: "6.5",
    x2: "17.5",
    y2: "17.5",
    stroke: "currentColor",
    strokeWidth: "2.2"
  }));
  // reconnecting — indeterminate arc (spins via CSS)
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "13",
    height: "13",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3 a9 9 0 1 1-8.5 6",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.6",
    strokeLinecap: "round"
  }));
}

/**
 * ConnectionPill — data-freshness channel, independent of severity. States:
 * live / paused / offline / reconnecting. Each has a distinct glyph + label;
 * `reconnecting` also carries a diagonal hatch so a stale state can NEVER be
 * mistaken for live by color alone.
 */
function ConnectionPill({
  state = "live",
  lang = "he",
  className = "",
  ...rest
}) {
  const label = (lang === "en" ? EN : HE)[state] || state;
  const style = {
    color: `var(--status-${state}-fg)`,
    background: `var(--status-${state}-fill)`,
    borderColor: `color-mix(in srgb, var(--status-${state}-dot) 55%, transparent)`
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `vc-connpill vc-connpill--${state} ${className}`,
    style: style,
    role: "status",
    "aria-live": state === "reconnecting" ? "assertive" : "polite"
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "vc-connpill__g",
    style: {
      color: `var(--status-${state}-dot)`
    }
  }, /*#__PURE__*/React.createElement(Glyph, {
    state: state
  })), /*#__PURE__*/React.createElement("span", null, label));
}
Object.assign(__ds_scope, { ConnectionPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/status/ConnectionPill.jsx", error: String((e && e.message) || e) }); }

// components/status/SessionState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
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
const SESSION_STATES = ["draft", "briefing", "running", "paused", "debrief", "scored", "archived"];
const HE = {
  draft: "טיוטה",
  briefing: "תדריך",
  running: "פעיל",
  paused: "מושהה",
  debrief: "תחקיר",
  scored: "מדורג",
  archived: "בארכיון"
};
const EN = {
  draft: "Draft",
  briefing: "Briefing",
  running: "Running",
  paused: "Paused",
  debrief: "Debrief",
  scored: "Scored",
  archived: "Archived"
};
/* paused is a sub-state of running in the lifecycle rail */
const RAIL = ["draft", "briefing", "running", "debrief", "scored", "archived"];

/**
 * SessionStateIndicator — the FSM state must always be glanceable.
 * `variant="badge"` shows just the current state (+ optional elapsed clock),
 * for tight headers. `variant="stepper"` shows the whole lifecycle rail with
 * done/current marks, for the instructor console / AAR header.
 */
function SessionState({
  state = "running",
  variant = "badge",
  elapsed,
  lang = "he",
  className = "",
  ...rest
}) {
  const dict = lang === "en" ? EN : HE;
  if (variant === "stepper") {
    const railState = state === "paused" ? "running" : state;
    const curIdx = RAIL.indexOf(railState);
    return /*#__PURE__*/React.createElement("ol", _extends({
      className: `vc-session vc-session--${state} ${className}`,
      "aria-label": `מצב סשן: ${dict[state]}`
    }, rest), /*#__PURE__*/React.createElement("div", {
      className: "vc-session__steps"
    }, RAIL.map((s, i) => {
      const st = i < curIdx ? "done" : i === curIdx ? "current" : "upcoming";
      const label = s === "running" && state === "paused" ? dict.paused : dict[s];
      return /*#__PURE__*/React.createElement("li", {
        key: s,
        className: `vc-session__step vc-session__step--${st}`,
        "aria-current": i === curIdx ? "step" : undefined
      }, /*#__PURE__*/React.createElement("span", {
        className: "vc-session__pip",
        "aria-hidden": "true"
      }), /*#__PURE__*/React.createElement("span", null, label));
    })), elapsed != null ? /*#__PURE__*/React.createElement("span", {
      className: "vc-session__clock"
    }, elapsed) : null);
  }
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `vc-session vc-session--${state} ${className}`
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "vc-session__badge",
    role: "status"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-session__dot",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", null, dict[state])), elapsed != null ? /*#__PURE__*/React.createElement("span", {
    className: "vc-session__clock"
  }, elapsed) : null);
}
Object.assign(__ds_scope, { SESSION_STATES, SessionState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/status/SessionState.jsx", error: String((e && e.message) || e) }); }

// components/status/severity.js
try { (() => {
/* VetCrew severity model — shared business logic (not a component).
   The ONE loudest semantic in the system. Every level is redundantly coded:
   color + a unique SHAPE (see SeverityGlyph) + a text label + rank/position.
   Coherence rule: "normal" is QUIET (neutral, uncolored). Color only appears
   when something is wrong. */
const SEVERITY_ORDER = ["normal", "watch", "elevated", "critical"];
const SEVERITY = {
  normal: {
    rank: 0,
    he: "תקין",
    en: "Normal",
    shape: "dot",
    fg: "var(--sev-normal-fg)",
    fill: "var(--sev-normal-fill)",
    edge: "var(--sev-normal-edge)"
  },
  watch: {
    rank: 1,
    he: "מעקב",
    en: "Watch",
    shape: "ring",
    fg: "var(--sev-watch-fg)",
    fill: "var(--sev-watch-fill)",
    edge: "var(--sev-watch-edge)"
  },
  elevated: {
    rank: 2,
    he: "מוחמר",
    en: "Elevated",
    shape: "triangle",
    fg: "var(--sev-elevated-fg)",
    fill: "var(--sev-elevated-fill)",
    edge: "var(--sev-elevated-edge)"
  },
  critical: {
    rank: 3,
    he: "קריטי",
    en: "Critical",
    shape: "octagon",
    fg: "var(--sev-critical-fg)",
    fill: "var(--sev-critical-fill)",
    edge: "var(--sev-critical-edge)"
  }
};
function severityMeta(level) {
  return SEVERITY[level] || SEVERITY.normal;
}
Object.assign(__ds_scope, { SEVERITY_ORDER, SEVERITY, severityMeta });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/status/severity.js", error: String((e && e.message) || e) }); }

// components/status/SeverityGlyph.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The shape half of severity's redundant coding. Each level has a distinct
 * silhouette so criticality is legible with zero color perception:
 * normal = dot, watch = ring, elevated = triangle, critical = octagon.
 * Colored by `currentColor` (inherits the chip/card severity color).
 */
function SeverityGlyph({
  level = "normal",
  size = 18,
  title,
  ...rest
}) {
  const shape = __ds_scope.severityMeta(level).shape;
  const s = size;
  let node;
  if (shape === "dot") {
    node = /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "4.5",
      fill: "currentColor"
    });
  } else if (shape === "ring") {
    node = /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "6",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.75"
    });
  } else if (shape === "triangle") {
    node = /*#__PURE__*/React.createElement("path", {
      d: "M12 4.2 L20.2 19 H3.8 Z",
      fill: "currentColor"
    });
  } else {
    // octagon
    node = /*#__PURE__*/React.createElement("path", {
      d: "M8.3 3.5 h7.4 L20.5 8.3 v7.4 L15.7 20.5 h-7.4 L3.5 15.7 v-7.4 Z",
      fill: "currentColor"
    });
  }
  return /*#__PURE__*/React.createElement("svg", _extends({
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    role: title ? "img" : "presentation",
    "aria-hidden": title ? undefined : true,
    "aria-label": title
  }, rest), node);
}
Object.assign(__ds_scope, { SeverityGlyph });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/status/SeverityGlyph.jsx", error: String((e && e.message) || e) }); }

// components/status/SeverityChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
inject("vc-sevchip", `
.vc-sevchip{display:inline-flex;align-items:center;gap:var(--sp-2);box-sizing:border-box;
  font-family:var(--font-ui);font-weight:var(--fw-semibold);line-height:1;white-space:nowrap;
  border-radius:var(--radius-pill);border:var(--border-w) solid;}
.vc-sevchip--md{min-height:32px;padding-inline:var(--sp-3);font-size:var(--fs-sm);}
.vc-sevchip--sm{min-height:24px;padding-inline:var(--sp-2);font-size:var(--fs-xs);gap:var(--sp-1);}
.vc-sevchip--lg{min-height:40px;padding-inline:var(--sp-4);font-size:var(--fs-body);gap:var(--sp-2);}
/* solid = filled tint (default). outline = hairline. bare = glyph+text only. */
.vc-sevchip__glyph{display:inline-flex;flex:0 0 auto;}
.vc-sevchip__val{font-family:var(--font-mono);font-variant-numeric:tabular-nums lining-nums;}
`);
const SIZE_GLYPH = {
  sm: 12,
  md: 16,
  lg: 20
};

/**
 * SeverityChip — the primary criticality signal. Redundantly coded: fill/stroke
 * color + a unique SHAPE glyph + the level's text label. Never color-only.
 * `appearance`: solid (tinted fill), outline (hairline), bare (glyph + label,
 * no container — for inline use inside cards).
 */
function SeverityChip({
  level = "normal",
  appearance = "solid",
  size = "md",
  lang = "he",
  showLabel = true,
  value,
  className = "",
  ...rest
}) {
  const meta = __ds_scope.severityMeta(level);
  const label = lang === "en" ? meta.en : meta.he;
  const style = appearance === "solid" ? {
    color: meta.fg,
    background: meta.fill,
    borderColor: meta.edge
  } : appearance === "outline" ? {
    color: meta.fg,
    background: "transparent",
    borderColor: meta.edge
  } : {
    color: meta.fg,
    background: "transparent",
    borderColor: "transparent",
    paddingInline: 0,
    minHeight: "auto"
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    className: `vc-sevchip vc-sevchip--${size} ${className}`,
    style: style,
    role: "status",
    "aria-label": `${label}${value != null ? " " + value : ""}`
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "vc-sevchip__glyph",
    style: {
      color: meta.fg
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.SeverityGlyph, {
    level: level,
    size: SIZE_GLYPH[size]
  })), showLabel ? /*#__PURE__*/React.createElement("span", null, label) : null, value != null ? /*#__PURE__*/React.createElement("span", {
    className: "vc-sevchip__val"
  }, value) : null);
}
Object.assign(__ds_scope, { SeverityChip, SEVERITY: __ds_scope.SEVERITY });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/status/SeverityChip.jsx", error: String((e && e.message) || e) }); }

// components/timeline/TimelineScrubber.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
inject("vc-scrub", `
.vc-scrub{box-sizing:border-box;display:flex;flex-direction:column;gap:var(--sp-3);font-family:var(--font-ui);width:100%;}
.vc-scrub__head{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3);}
.vc-scrub__time{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-size:var(--fs-body-lg);color:var(--text-strong);letter-spacing:var(--ls-num);}
.vc-scrub__time small{color:var(--text-faint);font-size:var(--fs-sm);}
.vc-scrub__legend{display:flex;flex-wrap:wrap;gap:var(--sp-3);}
.vc-scrub__lg{display:inline-flex;align-items:center;gap:var(--sp-1);font-size:var(--fs-xs);color:var(--text-muted);}
.vc-scrub__lg svg{width:12px;height:12px;}
.vc-scrub__main{position:relative;height:44px;border-radius:var(--radius-sm);background:var(--bg-sunken);
  border:var(--border-w) solid var(--border);cursor:pointer;touch-action:none;}
.vc-scrub__main:focus-visible{outline:var(--focus-w) solid var(--focus-ring);outline-offset:var(--focus-offset);}
.vc-scrub__fill{position:absolute;inset-block:0;inset-inline-start:0;background:var(--action-fill);border-start-start-radius:var(--radius-sm);border-end-start-radius:var(--radius-sm);}
.vc-scrub__playhead{position:absolute;inset-block:-4px;width:3px;background:var(--action);border-radius:var(--radius-pill);transform:translateX(50%);pointer-events:none;}
.vc-scrub__playhead::before{content:"";position:absolute;inset-inline-start:-6px;top:-6px;width:15px;height:15px;border-radius:50%;background:var(--action);border:2px solid var(--surface-raised);}
.vc-scrub__marker{position:absolute;top:50%;transform:translate(50%,-50%);display:inline-flex;align-items:center;justify-content:center;
  width:22px;height:22px;border-radius:50%;background:var(--surface-raised);border:var(--border-w) solid var(--border);
  color:var(--text-muted);cursor:pointer;padding:0;z-index:2;}
.vc-scrub__marker:hover{border-color:var(--action);z-index:3;}
.vc-scrub__marker:focus-visible{outline:var(--focus-w) solid var(--focus-ring);outline-offset:2px;z-index:3;}
.vc-scrub__marker svg{width:13px;height:13px;}
.vc-scrub__lane{display:grid;grid-template-columns:96px 1fr;align-items:center;gap:var(--sp-3);}
.vc-scrub__laneName{font-size:var(--fs-sm);font-weight:var(--fw-semibold);color:var(--text);text-align:start;}
.vc-scrub__laneTrack{position:relative;height:26px;border-radius:var(--radius-xs);background:var(--surface-2);border:var(--border-w) solid var(--hairline);}
.vc-scrub__laneTick{position:absolute;inset-block:0;width:1px;background:var(--playhead-ghost,color-mix(in srgb,var(--action) 45%,transparent));transform:translateX(50%);pointer-events:none;z-index:1;}
`);
function fmt(s) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60),
    r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/* marker shape per type — shape carries meaning, not color alone */
function MarkerGlyph({
  type
}) {
  switch (type) {
    case "injection":
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 24 24",
        "aria-hidden": "true"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M12 3 l9 9 -9 9 -9 -9 z",
        fill: "currentColor"
      }));
    case "vitals":
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 24 24",
        "aria-hidden": "true"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M12 5 L20 19 H4 Z",
        fill: "currentColor"
      }));
    case "callout":
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 24 24",
        "aria-hidden": "true"
      }, /*#__PURE__*/React.createElement("path", {
        d: "M4 5h16v11H9l-5 4z",
        fill: "currentColor"
      }));
    case "phase":
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 24 24",
        "aria-hidden": "true"
      }, /*#__PURE__*/React.createElement("rect", {
        x: "6",
        y: "4",
        width: "12",
        height: "16",
        rx: "2",
        fill: "currentColor"
      }));
    default:
      return /*#__PURE__*/React.createElement("svg", {
        viewBox: "0 0 24 24",
        "aria-hidden": "true"
      }, /*#__PURE__*/React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "6",
        fill: "currentColor"
      }));
    // action
  }
}
const HE_TYPE = {
  action: "פעולה",
  injection: "הזרקה",
  vitals: "שינוי מדד",
  callout: "קריאה",
  phase: "שלב"
};

/**
 * TimelineScrubber — the AAR spine. A draggable playhead over the session
 * duration, with event markers (shape-coded by type; severity markers colored
 * by level) and optional per-role lanes. Clicking a marker seeks to it — this
 * is how a score jumps to its source events. Time flows RTL-native (T0 at the
 * inline-start / right edge).
 */
function TimelineScrubber({
  duration = 600,
  position = 0,
  markers = [],
  lanes = null,
  onSeek,
  onMarkerClick,
  className = "",
  ...rest
}) {
  const trackRef = React.useRef(null);
  const pct = t => `${Math.min(100, Math.max(0, t / duration * 100))}%`;
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
  const onDown = e => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekFromEvent(e.clientX);
  };
  const onMove = e => {
    if (dragging.current) seekFromEvent(e.clientX);
  };
  const onUp = () => {
    dragging.current = false;
  };
  function onKey(e) {
    if (!onSeek) return;
    const step = e.shiftKey ? 30 : 5;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onSeek(Math.min(duration, position + step));
    } // RTL: left = forward
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onSeek(Math.max(0, position - step));
    }
    if (e.key === "Home") {
      e.preventDefault();
      onSeek(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      onSeek(duration);
    }
  }
  const legendTypes = Array.from(new Set(markers.map(m => m.type || "action")));
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `vc-scrub ${className}`
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "vc-scrub__head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-scrub__time"
  }, fmt(position), " ", /*#__PURE__*/React.createElement("small", null, "/ ", fmt(duration))), /*#__PURE__*/React.createElement("span", {
    className: "vc-scrub__legend"
  }, legendTypes.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    className: "vc-scrub__lg"
  }, /*#__PURE__*/React.createElement(MarkerGlyph, {
    type: t
  }), " ", HE_TYPE[t] || t)))), /*#__PURE__*/React.createElement("div", {
    ref: trackRef,
    className: "vc-scrub__main",
    role: "slider",
    tabIndex: 0,
    "aria-label": "\u05E6\u05D9\u05E8 \u05D6\u05DE\u05DF \u05D4\u05E1\u05E9\u05DF",
    "aria-valuemin": 0,
    "aria-valuemax": duration,
    "aria-valuenow": Math.round(position),
    "aria-valuetext": fmt(position),
    onPointerDown: onDown,
    onPointerMove: onMove,
    onPointerUp: onUp,
    onKeyDown: onKey
  }, /*#__PURE__*/React.createElement("div", {
    className: "vc-scrub__fill",
    style: {
      inlineSize: pct(position)
    }
  }), markers.map((m, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    type: "button",
    className: "vc-scrub__marker",
    style: {
      insetInlineStart: pct(m.t),
      color: m.severity ? `var(--sev-${m.severity}-fg)` : undefined,
      borderColor: m.severity ? `var(--sev-${m.severity}-edge)` : undefined
    },
    title: `${HE_TYPE[m.type] || m.type || "פעולה"} · ${fmt(m.t)}${m.label ? " · " + m.label : ""}`,
    "aria-label": `${HE_TYPE[m.type] || ""} ${m.label || ""} בזמן ${fmt(m.t)}`,
    onClick: e => {
      e.stopPropagation();
      onSeek && onSeek(m.t);
      onMarkerClick && onMarkerClick(m, i);
    }
  }, /*#__PURE__*/React.createElement(MarkerGlyph, {
    type: m.type || "action"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "vc-scrub__playhead",
    style: {
      insetInlineStart: pct(position)
    }
  })), lanes ? lanes.map(lane => /*#__PURE__*/React.createElement("div", {
    key: lane.role,
    className: "vc-scrub__lane"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-scrub__laneName"
  }, lane.label), /*#__PURE__*/React.createElement("div", {
    className: "vc-scrub__laneTrack"
  }, markers.filter(m => m.role === lane.role).map((m, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    type: "button",
    className: "vc-scrub__marker",
    style: {
      insetInlineStart: pct(m.t),
      width: 18,
      height: 18,
      color: m.severity ? `var(--sev-${m.severity}-fg)` : undefined
    },
    title: `${lane.label} · ${HE_TYPE[m.type] || m.type} · ${fmt(m.t)}`,
    "aria-label": `${lane.label} ${HE_TYPE[m.type] || ""} ${fmt(m.t)}`,
    onClick: () => {
      onSeek && onSeek(m.t);
      onMarkerClick && onMarkerClick(m, i);
    }
  }, /*#__PURE__*/React.createElement(MarkerGlyph, {
    type: m.type || "action"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "vc-scrub__laneTick",
    style: {
      insetInlineStart: pct(position)
    }
  })))) : null);
}
Object.assign(__ds_scope, { TimelineScrubber });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/timeline/TimelineScrubber.jsx", error: String((e && e.message) || e) }); }

// components/vitals/VitalCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function inject(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const el = document.createElement("style");
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}
inject("vc-vital", `
.vc-vital{position:relative;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--sp-2);
  background:var(--surface);border:var(--border-w) solid var(--border);border-radius:var(--radius-lg);
  padding:var(--sp-4) var(--sp-5);overflow:hidden;
  transition:border-color var(--dur-base) var(--ease-standard),background var(--dur-base) var(--ease-standard);}
.vc-vital--station{padding:var(--sp-5) var(--sp-6);min-height:180px;}
.vc-vital--compact{padding:var(--sp-3) var(--sp-4);gap:var(--sp-1);}
/* severity accent: inline-start edge + faint wash, only when NOT normal */
.vc-vital[data-sev="watch"]{border-inline-start:4px solid var(--sev-watch-edge);}
.vc-vital[data-sev="elevated"]{border-inline-start:4px solid var(--sev-elevated-edge);background:color-mix(in srgb,var(--sev-elevated-fill) 40%,var(--surface));}
.vc-vital[data-sev="critical"]{border-inline-start:4px solid var(--sev-critical-edge);background:color-mix(in srgb,var(--sev-critical-fill) 46%,var(--surface));}
.vc-vital__head{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);flex-wrap:wrap;}
.vc-vital__labels{display:flex;align-items:baseline;gap:var(--sp-2);min-width:0;flex:1 1 auto;}
.vc-vital__name{font-family:var(--font-ui);font-weight:var(--fw-semibold);color:var(--text);font-size:var(--fs-body);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.vc-vital--station .vc-vital__name{font-size:var(--fs-h3);}
.vc-vital__abbr{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--text-faint);letter-spacing:var(--ls-caps);text-transform:uppercase;}
.vc-vital__readout{display:flex;align-items:flex-end;gap:var(--sp-2);}
.vc-vital__num{font-family:var(--font-metric);font-variant-numeric:tabular-nums lining-nums;font-weight:var(--fw-semibold);
  color:var(--text-strong);line-height:.95;font-size:var(--fs-h1);border-radius:var(--radius-xs);padding-inline:2px;}
.vc-vital--station .vc-vital__num{font-size:var(--fs-vital);font-weight:var(--fw-medium);}
.vc-vital__num--up{animation:vc-tick-up var(--dur-tick) var(--ease-standard);}
.vc-vital__num--down{animation:vc-tick-down var(--dur-tick) var(--ease-standard);}
.vc-vital__unit{font-family:var(--font-metric);font-size:var(--fs-sm);color:var(--text-muted);padding-bottom:.35em;}
.vc-vital--station .vc-vital__unit{font-size:var(--fs-body-lg);}
.vc-vital__trend{display:inline-flex;align-items:center;margin-inline-start:auto;padding-bottom:.35em;}
.vc-vital__foot{display:flex;align-items:center;justify-content:space-between;gap:var(--sp-2);min-height:20px;}
/* ---- STALE / RECONNECTING — must NEVER read as live -------------------- */
.vc-vital--stale .vc-vital__num,.vc-vital--stale .vc-vital__unit,.vc-vital--stale .vc-vital__trend{color:var(--text-faint);filter:grayscale(1);}
.vc-vital__veil{position:absolute;inset:0;pointer-events:none;background-image:var(--stale-hatch);border-radius:inherit;}
.vc-vital__veil::after{content:"";position:absolute;inset:0;background:var(--stale-veil);}
.vc-vital__lastseen{font-family:var(--font-mono);font-size:var(--fs-xs);color:var(--status-reconnecting-fg);letter-spacing:var(--ls-num);position:relative;z-index:1;}
`);
const HE_LASTSEEN = "עודכן לאחרונה";
const HE_STALE_A11Y = "נתונים לא עדכניים — מתחבר מחדש";
function TrendIcon({
  dir,
  color
}) {
  if (dir === "flat") return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "4",
    y1: "12",
    x2: "20",
    y2: "12",
    stroke: color,
    strokeWidth: "2.5",
    strokeLinecap: "round"
  }));
  const up = dir === "up";
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    width: "20",
    height: "20",
    "aria-hidden": "true",
    style: {
      transform: up ? "none" : "scaleY(-1)"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M5 15 L12 7 L19 15",
    fill: "none",
    stroke: color,
    strokeWidth: "2.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }));
}

/**
 * VitalCard — a single monitored parameter. Severity is redundantly coded
 * (chip glyph + accent edge + wash). Number uses tabular mono so digits don't
 * jitter as it ticks; a value change flashes (up=amber / down=blue) WITHOUT
 * relayout. When `stale` (connection dropped) the card freezes: values are
 * desaturated + hatched + veiled, a reconnecting pill and last-seen timestamp
 * appear — it can never be mistaken for live data.
 */
function VitalCard({
  name,
  abbr,
  value,
  unit,
  level = "normal",
  trend = "flat",
  stale = false,
  lastSeen,
  size = "station",
  lang = "he",
  className = "",
  ...rest
}) {
  const meta = __ds_scope.severityMeta(level);
  const [flash, setFlash] = React.useState("");
  const prev = React.useRef(value);
  React.useEffect(() => {
    if (stale) return;
    const p = prev.current,
      n = value;
    if (typeof p === "number" && typeof n === "number" && n !== p) {
      setFlash(n > p ? "up" : "down");
      const t = setTimeout(() => setFlash(""), 320);
      prev.current = n;
      return () => clearTimeout(t);
    }
    prev.current = n;
  }, [value, stale]);
  const trendColor = level === "normal" ? "var(--text-faint)" : meta.fg;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: `vc-vital vc-vital--${size} ${stale ? "vc-vital--stale" : ""} ${className}`,
    "data-sev": stale ? "normal" : level,
    role: "group",
    "aria-label": stale ? `${name}${abbr ? " " + abbr : ""} — ${HE_STALE_A11Y}. ${HE_LASTSEEN} ${lastSeen || "—"}` : `${name}${abbr ? " " + abbr : ""}`,
    "aria-live": "off"
  }, rest), /*#__PURE__*/React.createElement("div", {
    className: "vc-vital__head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-vital__labels"
  }, /*#__PURE__*/React.createElement("span", {
    className: "vc-vital__name"
  }, name), abbr ? /*#__PURE__*/React.createElement("span", {
    className: "vc-vital__abbr"
  }, abbr) : null), !stale && level !== "normal" && size !== "compact" ? /*#__PURE__*/React.createElement(__ds_scope.SeverityChip, {
    level: level,
    appearance: "bare",
    size: size === "station" ? "md" : "sm",
    lang: lang
  }) : null), /*#__PURE__*/React.createElement("div", {
    className: "vc-vital__readout"
  }, /*#__PURE__*/React.createElement("span", {
    className: `vc-vital__num ${flash ? "vc-vital__num--" + flash : ""}`
  }, value), unit ? /*#__PURE__*/React.createElement("span", {
    className: "vc-vital__unit"
  }, unit) : null, !stale ? /*#__PURE__*/React.createElement("span", {
    className: "vc-vital__trend"
  }, /*#__PURE__*/React.createElement(TrendIcon, {
    dir: trend,
    color: trendColor
  })) : null), /*#__PURE__*/React.createElement("div", {
    className: "vc-vital__foot"
  }, stale ? /*#__PURE__*/React.createElement("span", {
    className: "vc-vital__lastseen"
  }, HE_LASTSEEN, " ", lastSeen || "—") : size === "compact" ? /*#__PURE__*/React.createElement(__ds_scope.SeverityChip, {
    level: level,
    appearance: "bare",
    size: "sm",
    lang: lang
  }) : level === "normal" ? /*#__PURE__*/React.createElement(__ds_scope.SeverityChip, {
    level: "normal",
    appearance: "bare",
    size: "sm",
    lang: lang
  }) : /*#__PURE__*/React.createElement("span", null), stale ? /*#__PURE__*/React.createElement(__ds_scope.ConnectionPill, {
    state: "reconnecting",
    lang: lang
  }) : null), stale ? /*#__PURE__*/React.createElement("div", {
    className: "vc-vital__veil",
    "aria-hidden": "true"
  }) : null);
}
Object.assign(__ds_scope, { VitalCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/vitals/VitalCard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/aar/AarViewer.jsx
try { (() => {
/* VetCrew — AAR replay viewer. Register: reflective, data-rich, trustworthy.
   Composes DS primitives from window.DesignSystem_ad98cb. Exposes window.VCKit.AarViewer. */
(function () {
  const R = window.React;
  const DS = window.DesignSystem_ad98cb;
  const {
    TimelineScrubber,
    SeverityChip,
    VitalCard,
    AntsRating,
    SessionState,
    Button,
    IconButton
  } = DS;
  const Icon = window.VC.Icon;
  const D = window.VCAAR_DATA;
  function interp(series, t) {
    if (t <= series[0][0]) return series[0][1];
    for (let i = 1; i < series.length; i++) {
      if (t <= series[i][0]) {
        const [t0, v0] = series[i - 1],
          [t1, v1] = series[i];
        return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
      }
    }
    return series[series.length - 1][1];
  }
  const sevHR = v => v >= 192 ? "critical" : v >= 176 ? "elevated" : v >= 166 ? "watch" : "normal";
  const sevSpO2 = v => v < 90 ? "critical" : v < 92 ? "elevated" : v < 95 ? "watch" : "normal";
  const sevRR = v => v >= 52 ? "elevated" : v >= 46 ? "watch" : "normal";
  const fmt = s => {
    s = Math.max(0, Math.round(s));
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };
  const trend = (series, t) => {
    const a = interp(series, Math.max(0, t - 12)),
      b = interp(series, t);
    return b - a > 0.6 ? "up" : b - a < -0.6 ? "down" : "flat";
  };
  const VMETA = {
    hr: {
      name: "דופק",
      abbr: "HR",
      unit: "bpm",
      sev: sevHR
    },
    spo2: {
      name: "ריווי חמצן",
      abbr: "SpO₂",
      unit: "%",
      sev: sevSpO2
    },
    rr: {
      name: "נשימות",
      abbr: "RR",
      unit: "/min",
      sev: sevRR
    },
    temp: {
      name: "חום",
      abbr: "TEMP",
      unit: "°C",
      sev: () => "normal"
    }
  };
  const TYPES = [{
    id: "action",
    label: "פעולות"
  }, {
    id: "injection",
    label: "הזרקות"
  }, {
    id: "vitals",
    label: "מדדים"
  }, {
    id: "callout",
    label: "קריאות"
  }, {
    id: "phase",
    label: "שלבים"
  }];
  function FilterChip({
    active,
    children,
    onClick
  }) {
    return R.createElement("button", {
      onClick,
      className: "aar-fchip",
      "aria-pressed": active,
      style: {
        minHeight: 36,
        padding: "0 14px",
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--fs-sm)",
        fontWeight: 600,
        border: "var(--border-w) solid " + (active ? "var(--action)" : "var(--border)"),
        background: active ? "var(--action-fill)" : "var(--surface)",
        color: active ? "var(--action-quiet)" : "var(--text-muted)"
      }
    }, children);
  }
  function RolePanel({
    role,
    event
  }) {
    return R.createElement("div", {
      style: {
        background: "var(--surface)",
        border: "var(--border-w) solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--sp-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
        minWidth: 0
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)"
      }
    }, R.createElement("span", {
      style: {
        fontSize: "var(--fs-sm)",
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, role.label), R.createElement("span", {
      className: "vc-caps",
      style: {
        marginInlineStart: "auto",
        color: "var(--text-faint)",
        fontFamily: "var(--font-mono)"
      }
    }, role.short)), event ? R.createElement(R.Fragment, null, R.createElement("div", {
      style: {
        fontSize: "var(--fs-body)",
        color: "var(--text)",
        fontWeight: 600
      }
    }, event.label), R.createElement("div", {
      style: {
        fontSize: "var(--fs-sm)",
        color: "var(--text-muted)",
        lineHeight: "var(--lh-normal)"
      }
    }, event.detail), R.createElement("div", {
      className: "vc-num",
      style: {
        fontSize: "var(--fs-xs)",
        color: "var(--text-faint)"
      }
    }, "T+" + fmt(event.t))) : R.createElement("div", {
      style: {
        fontSize: "var(--fs-sm)",
        color: "var(--text-faint)",
        fontStyle: "italic"
      }
    }, "טרם פעל בפרק זמן זה"));
  }
  function TweakRadio({
    label,
    value,
    options,
    onChange
  }) {
    return R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)"
      }
    }, R.createElement("span", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)"
      }
    }, label), R.createElement("div", {
      role: "radiogroup",
      "aria-label": label,
      style: {
        display: "inline-flex",
        background: "var(--surface-2)",
        border: "var(--border-w) solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 3,
        gap: 3
      }
    }, options.map(o => R.createElement("button", {
      key: String(o.v),
      role: "radio",
      "aria-checked": value === o.v,
      onClick: () => onChange(o.v),
      style: {
        minHeight: 36,
        padding: "0 14px",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--fs-sm)",
        fontWeight: 600,
        background: value === o.v ? "var(--action)" : "transparent",
        color: value === o.v ? "var(--on-action)" : "var(--text-muted)"
      }
    }, o.label))));
  }
  function TweaksPanel({
    dark,
    setDark,
    speed,
    setSpeed,
    showLanes,
    setShowLanes,
    onClose
  }) {
    return R.createElement("div", {
      role: "region",
      "aria-label": "התאמות תצוגה",
      style: {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "var(--sp-6)",
        padding: "var(--sp-3) var(--sp-6)",
        background: "var(--surface-2)",
        borderBottom: "var(--border-w) solid var(--border)"
      }
    }, R.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        fontSize: "var(--fs-sm)",
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, R.createElement(Icon, {
      name: "sliders-horizontal",
      size: 16,
      style: {
        color: "var(--action-quiet)"
      }
    }), "התאמות"), R.createElement(TweakRadio, {
      label: "ערכת נושא",
      value: dark ? "dark" : "light",
      onChange: v => setDark(v === "dark"),
      options: [{
        v: "light",
        label: "יום"
      }, {
        v: "dark",
        label: "לילה"
      }]
    }), R.createElement(TweakRadio, {
      label: "מהירות ניגון",
      value: speed,
      onChange: setSpeed,
      options: [{
        v: 1,
        label: "1×"
      }, {
        v: 2,
        label: "2×"
      }, {
        v: 4,
        label: "4×"
      }]
    }), R.createElement(TweakRadio, {
      label: "מסלולי תפקידים",
      value: showLanes,
      onChange: setShowLanes,
      options: [{
        v: true,
        label: "מוצג"
      }, {
        v: false,
        label: "מוסתר"
      }]
    }), R.createElement(IconButton, {
      label: "סגור התאמות",
      onClick: onClose,
      className: "aar-tweak-close",
      icon: R.createElement(Icon, {
        name: "x",
        size: 18
      }),
      style: {
        marginInlineStart: "auto"
      }
    }));
  }
  function AarViewer() {
    const [pos, setPos] = R.useState(196);
    const [playing, setPlaying] = R.useState(false);
    const [roleFilter, setRoleFilter] = R.useState(null);
    const [typeFilter, setTypeFilter] = R.useState(() => new Set());
    const [selId, setSelId] = R.useState("e7");
    const [dark, setDark] = R.useState(false);
    const [speed, setSpeed] = R.useState(2); // tweak: playback rate (1/2/4×)
    const [showLanes, setShowLanes] = R.useState(true); // tweak: per-role lanes
    const [tweaksOpen, setTweaksOpen] = R.useState(false);
    R.useEffect(() => {
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    }, [dark]);
    R.useEffect(() => {
      if (!playing) return;
      const id = setInterval(() => setPos(p => {
        const n = p + 3;
        if (n >= D.session.duration) {
          setPlaying(false);
          return D.session.duration;
        }
        return n;
      }), 200 / speed);
      return () => clearInterval(id);
    }, [playing, speed]);
    const markers = D.events.filter(e => !roleFilter || e.role === roleFilter).filter(e => typeFilter.size === 0 || typeFilter.has(e.type)).map(e => ({
      t: e.t,
      type: e.type,
      role: e.role,
      label: e.label,
      severity: e.severity
    }));
    const lanes = showLanes ? D.roles.map(r => ({
      role: r.id,
      label: r.label
    })) : null;
    const sel = D.events.find(e => e.id === selId);
    const latestForRole = rid => D.events.filter(e => e.role === rid && e.t <= pos).slice(-1)[0];
    function jumpTo(t, id) {
      setPos(t);
      if (id) setSelId(id);
      setPlaying(false);
    }
    function toggleType(id) {
      setTypeFilter(s => {
        const n = new Set(s);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
      });
    }
    const vitalNow = k => {
      const raw = interp(D.vitals[k], pos);
      return k === "temp" ? raw.toFixed(1) : Math.round(raw);
    };
    return R.createElement("div", {
      className: "aar",
      dir: "rtl",
      style: {
        minHeight: "100vh",
        background: "var(--bg-canvas)",
        color: "var(--text)",
        fontFamily: "var(--font-ui)",
        display: "flex",
        flexDirection: "column"
      }
    }, /* ---- header ---- */
    R.createElement("header", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)",
        padding: "var(--sp-4) var(--sp-6)",
        borderBottom: "var(--border-w) solid var(--border)",
        background: "var(--surface)"
      }
    }, R.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: "var(--fs-h3)",
        letterSpacing: "var(--ls-tight)"
      }
    }, "Vet", R.createElement("span", {
      style: {
        color: "var(--action)"
      }
    }, "Crew")), R.createElement("div", {
      style: {
        width: 1,
        height: 28,
        background: "var(--border)"
      }
    }), R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 0
      }
    }, R.createElement("span", {
      style: {
        fontWeight: 600,
        fontSize: "var(--fs-body)",
        color: "var(--text-strong)",
        whiteSpace: "nowrap"
      }
    }, D.session.title), R.createElement("span", {
      className: "vc-num",
      style: {
        fontSize: "var(--fs-xs)",
        color: "var(--text-faint)"
      }
    }, D.session.date + " · " + D.session.engine)), R.createElement("div", {
      style: {
        marginInlineStart: "auto",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)"
      }
    }, R.createElement(SessionState, {
      state: D.session.state,
      variant: "stepper"
    }), R.createElement(IconButton, {
      label: dark ? "מצב יום" : "מצב לילה",
      onClick: () => setDark(v => !v),
      icon: R.createElement(Icon, {
        name: dark ? "sun" : "moon",
        size: 20
      })
    }), R.createElement(IconButton, {
      label: "התאמות תצוגה",
      variant: tweaksOpen ? "solid" : "ghost",
      onClick: () => setTweaksOpen(v => !v),
      icon: R.createElement(Icon, {
        name: "sliders-horizontal",
        size: 20
      })
    }))), tweaksOpen && R.createElement(TweaksPanel, {
      dark,
      setDark,
      speed,
      setSpeed,
      showLanes,
      setShowLanes,
      onClose: () => setTweaksOpen(false)
    }), /* ---- body: stage + scores rail ---- */
    R.createElement("div", {
      style: {
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 380px",
        gap: "var(--sp-6)",
        padding: "var(--sp-6)",
        alignItems: "start",
        minHeight: 0
      }
    }, /* stage */
    R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-4)",
        minWidth: 0
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: "var(--sp-3)"
      }
    }, R.createElement("span", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)"
      }
    }, "מצב המטופל בזמן"), R.createElement("span", {
      className: "vc-num",
      style: {
        fontSize: "var(--fs-h3)",
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, fmt(pos))), R.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(4,1fr)",
        gap: "var(--sp-3)"
      }
    }, ["hr", "spo2", "rr", "temp"].map(k => {
      const v = vitalNow(k),
        m = VMETA[k];
      return R.createElement(VitalCard, {
        key: k,
        name: m.name,
        abbr: m.abbr,
        value: v,
        unit: m.unit,
        level: m.sev(parseFloat(v)),
        trend: trend(D.vitals[k], pos),
        size: "compact"
      });
    })), R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        gap: "var(--sp-3)",
        marginTop: "var(--sp-2)"
      }
    }, R.createElement("span", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)"
      }
    }, "מה ראה כל תפקיד"), R.createElement("span", {
      style: {
        fontSize: "var(--fs-xs)",
        color: "var(--text-faint)"
      }
    }, "· תצוגה חלקית לכל תפקיד")), R.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(3,1fr)",
        gap: "var(--sp-3)"
      }
    }, D.roles.map(r => R.createElement(RolePanel, {
      key: r.id,
      role: r,
      event: latestForRole(r.id)
    }))), /* selected event detail */
    sel && R.createElement("div", {
      style: {
        background: "var(--surface-2)",
        border: "var(--border-w) solid var(--border)",
        borderInlineStart: "4px solid var(--action)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--sp-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)"
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)"
      }
    }, R.createElement(Icon, {
      name: "crosshair",
      size: 16,
      style: {
        color: "var(--action-quiet)"
      }
    }), R.createElement("span", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)"
      }
    }, "אירוע נבחר"), R.createElement("span", {
      className: "vc-num",
      style: {
        marginInlineStart: "auto",
        fontSize: "var(--fs-xs)",
        color: "var(--text-faint)"
      }
    }, "T+" + fmt(sel.t)), sel.severity && R.createElement(SeverityChip, {
      level: sel.severity,
      size: "sm"
    })), R.createElement("div", {
      style: {
        fontSize: "var(--fs-body-lg)",
        fontWeight: 600,
        color: "var(--text-strong)"
      }
    }, sel.label), R.createElement("div", {
      style: {
        fontSize: "var(--fs-body)",
        color: "var(--text-muted)",
        lineHeight: "var(--lh-normal)"
      }
    }, sel.detail))), /* scores rail */
    R.createElement("aside", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-5)",
        background: "var(--surface)",
        border: "var(--border-w) solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--sp-5)",
        boxShadow: "var(--elev-1)",
        position: "sticky",
        top: "var(--sp-6)"
      }
    }, R.createElement("div", null, R.createElement("div", {
      style: {
        fontSize: "var(--fs-h3)",
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, "דירוג מיומנויות צוות"), R.createElement("div", {
      style: {
        fontSize: "var(--fs-sm)",
        color: "var(--text-muted)"
      }
    }, "ANTS · לחיצה על דירוג קופצת לראיה בציר")), R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-5)"
      }
    }, D.scores.ants.map(a => R.createElement(AntsRating, {
      key: a.key,
      category: a.label,
      value: a.value,
      anchors: a.anchors,
      evidenceCount: a.evidence.length,
      onChange: () => {},
      onJumpToEvidence: () => {
        const ev = D.events.find(e => e.id === a.evidence[0]);
        if (ev) jumpTo(ev.t, ev.id);
      }
    }))), R.createElement("div", {
      style: {
        height: 1,
        background: "var(--hairline)"
      }
    }), R.createElement("div", {
      style: {
        fontSize: "var(--fs-body)",
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, "צ'קליסט טכני"), R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)"
      }
    }, D.scores.technical.map((c, i) => R.createElement("button", {
      key: i,
      onClick: () => jumpTo(c.t),
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        textAlign: "start",
        cursor: "pointer",
        background: "transparent",
        border: "none",
        padding: "var(--sp-2)",
        borderRadius: "var(--radius-sm)",
        minHeight: 44
      }
    }, R.createElement("span", {
      "aria-hidden": "true",
      style: {
        width: 22,
        height: 22,
        borderRadius: "var(--radius-xs)",
        flex: "0 0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: c.done ? "var(--status-running-fill)" : "var(--surface-2)",
        border: "var(--border-w) solid " + (c.done ? "var(--status-running-dot)" : "var(--border-strong)"),
        color: "var(--status-running-fg)"
      }
    }, c.done ? R.createElement(Icon, {
      name: "check",
      size: 14,
      stroke: 3
    }) : null), R.createElement("span", {
      style: {
        flex: 1,
        fontSize: "var(--fs-sm)",
        color: c.done ? "var(--text)" : "var(--text-muted)"
      }
    }, c.label), R.createElement("span", {
      className: "vc-num",
      style: {
        fontSize: "var(--fs-xs)",
        color: "var(--text-faint)"
      }
    }, "×" + c.weight)))))), /* ---- footer: transport + scrubber + filters ---- */
    R.createElement("footer", {
      style: {
        borderTop: "var(--border-w) solid var(--border)",
        background: "var(--surface)",
        padding: "var(--sp-4) var(--sp-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-3)"
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        flexWrap: "wrap"
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        gap: "var(--sp-2)"
      }
    }, R.createElement(IconButton, {
      label: "להתחלה",
      onClick: () => jumpTo(0),
      icon: R.createElement(Icon, {
        name: "skip-forward",
        size: 20,
        flip: true
      })
    }), R.createElement(IconButton, {
      label: "אחורה",
      onClick: () => setPos(p => Math.max(0, p - 10)),
      icon: R.createElement(Icon, {
        name: "rewind",
        size: 20,
        flip: true
      })
    }), R.createElement(IconButton, {
      label: playing ? "השהה" : "נגן",
      variant: "solid",
      size: "lg",
      onClick: () => setPlaying(v => !v),
      icon: R.createElement(Icon, {
        name: playing ? "pause" : "play",
        size: 22
      })
    }), R.createElement(IconButton, {
      label: "קדימה",
      onClick: () => setPos(p => Math.min(D.session.duration, p + 10)),
      icon: R.createElement(Icon, {
        name: "fast-forward",
        size: 20,
        flip: true
      })
    })), R.createElement("div", {
      style: {
        marginInlineStart: "auto",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        flexWrap: "wrap"
      }
    }, R.createElement("span", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)",
        marginInlineEnd: "var(--sp-1)"
      }
    }, "תפקיד"), R.createElement(FilterChip, {
      active: !roleFilter,
      onClick: () => setRoleFilter(null)
    }, "הכל"), D.roles.map(r => R.createElement(FilterChip, {
      key: r.id,
      active: roleFilter === r.id,
      onClick: () => setRoleFilter(x => x === r.id ? null : r.id)
    }, r.label)))), R.createElement(TimelineScrubber, {
      duration: D.session.duration,
      position: pos,
      markers,
      lanes,
      onSeek: t => {
        setPos(t);
        setPlaying(false);
      },
      onMarkerClick: m => {
        const ev = D.events.find(e => Math.abs(e.t - m.t) < 1 && e.label === m.label);
        if (ev) setSelId(ev.id);
      }
    }), R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        flexWrap: "wrap"
      }
    }, R.createElement("span", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)",
        marginInlineEnd: "var(--sp-1)"
      }
    }, "סנן לפי סוג"), TYPES.map(t => R.createElement(FilterChip, {
      key: t.id,
      active: typeFilter.has(t.id),
      onClick: () => toggleType(t.id)
    }, t.label)))));
  }
  window.VCKit = window.VCKit || {};
  window.VCKit.AarViewer = AarViewer;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/aar/AarViewer.jsx", error: String((e && e.message) || e) }); }

// ui_kits/aar/data.js
try { (() => {
/* VetCrew AAR — sample session data (event-sourced replay).
   window.VCAAR_DATA. Times are seconds from session start. */
window.VCAAR_DATA = {
  session: {
    title: "החייאת כלב — הרחבת קיבה (GDV)",
    scenario: "gdv-canine-v1",
    date: "24 ביולי 2026 · 08:14",
    duration: 420,
    state: "scored",
    engine: "Alpha · פרוצדורלי"
  },
  roles: [{
    id: "primary_tech",
    label: "טכנאי ראשי",
    short: "ט.ר"
  }, {
    id: "vet",
    label: "וטרינר",
    short: "וט"
  }, {
    id: "triage_tech",
    label: "טכנאי טריאז'",
    short: "ט.ט"
  }],
  // ordered event log
  events: [{
    id: "e1",
    t: 12,
    type: "phase",
    role: "patient",
    label: "קבלה וטריאז'",
    detail: "כלב גזע גדול, בטן תפוחה, ניסיונות הקאה."
  }, {
    id: "e2",
    t: 34,
    type: "callout",
    role: "triage_tech",
    label: "זיהוי GDV והסלמה",
    detail: "הטכנאי מזהה את התמונה ומסלים מיידית לצוות."
  }, {
    id: "e3",
    t: 74,
    type: "action",
    role: "primary_tech",
    label: "גישה ורידית",
    detail: "צנתר 18G בגף קדמי שמאלי — 62 שניות מהקבלה."
  }, {
    id: "e4",
    t: 96,
    type: "callout",
    role: "vet",
    label: "קריאת מדדים בקול",
    detail: "\"דופק 176, ריריות חיוורות\" — לולאה סגורה חלקית."
  }, {
    id: "e5",
    t: 132,
    type: "action",
    role: "primary_tech",
    label: "התחלת נוזלים",
    detail: "בולוס גבישי 20ml/kg."
  }, {
    id: "e6",
    t: 168,
    type: "vitals",
    role: "patient",
    label: "דופק עולה",
    detail: "HR 188 — טרם ייצוב.",
    severity: "elevated"
  }, {
    id: "e7",
    t: 196,
    type: "injection",
    role: "instructor",
    label: "בעל הבית נכנס נסער",
    detail: "הזרקת מדריך — הסחת דעת בזמן טיפול."
  }, {
    id: "e8",
    t: 244,
    type: "action",
    role: "vet",
    label: "דקומפרסיה",
    detail: "החדרת צינור קיבה, שחרור גז."
  }, {
    id: "e9",
    t: 300,
    type: "vitals",
    role: "patient",
    label: "החמרה חולפת",
    detail: "HR 196, CRT 4ש' — לפני תגובה לטיפול.",
    severity: "critical"
  }, {
    id: "e10",
    t: 348,
    type: "vitals",
    role: "patient",
    label: "התייצבות",
    detail: "HR יורד ל-150, ריריות משתפרות.",
    severity: "watch"
  }, {
    id: "e11",
    t: 396,
    type: "phase",
    role: "patient",
    label: "סיום — מטופל מיוצב",
    detail: "מועבר להמשך ניטור."
  }],
  // vitals breakpoints; the viewer interpolates between them
  vitals: {
    hr: [[0, 160], [74, 176], [168, 188], [300, 196], [348, 150], [420, 142]],
    spo2: [[0, 95], [168, 93], [300, 90], [348, 94], [420, 96]],
    rr: [[0, 44], [168, 48], [300, 52], [348, 36], [420, 30]],
    temp: [[0, 38.9], [420, 38.4]]
  },
  scores: {
    ants: [{
      key: "sa",
      label: "מודעות מצבית",
      value: 4,
      anchors: ["חסרה", "מוגבלת", "מספקת", "טובה", "מצוינת"],
      evidence: ["e2", "e6", "e9"]
    }, {
      key: "dm",
      label: "קבלת החלטות",
      value: 4,
      anchors: ["חסרה", "מוגבלת", "מספקת", "טובה", "מצוינת"],
      evidence: ["e3", "e5", "e8"]
    }, {
      key: "comm",
      label: "תקשורת",
      value: 3,
      anchors: ["חסרה", "מוגבלת", "מספקת", "טובה", "מצוינת"],
      evidence: ["e4", "e7"]
    }, {
      key: "lead",
      label: "מנהיגות וצוות",
      value: 3,
      anchors: ["חסרה", "מוגבלת", "מספקת", "טובה", "מצוינת"],
      evidence: ["e2", "e8"]
    }],
    technical: [{
      label: "גישה ורידית < 3 דקות",
      done: true,
      weight: 3,
      t: 74
    }, {
      label: "בולוס נוזלים מתאים",
      done: true,
      weight: 2,
      t: 132
    }, {
      label: "דקומפרסיה בזמן",
      done: true,
      weight: 3,
      t: 244
    }, {
      label: "ניטור רציף מדווח בקול",
      done: false,
      weight: 2,
      t: 96
    }]
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/aar/data.js", error: String((e && e.message) || e) }); }

// ui_kits/instructor/Console.jsx
try { (() => {
/* VetCrew — Instructor console. Register: dense-but-controlled, high-pressure.
   Fast-fire injections (no confirm); ONLY destructive actions confirm.
   Exposes window.VCKit.Console. */
(function () {
  const R = window.React;
  const DS = window.DesignSystem_ad98cb;
  const {
    SessionState,
    ConnectionPill,
    VitalCard,
    InjectionTrigger,
    Button,
    IconButton,
    SeverityChip
  } = DS;
  const Icon = window.VC.Icon;
  const D = window.VCINS_DATA;
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const sevHR = v => v >= 192 ? "critical" : v >= 176 ? "elevated" : v >= 166 ? "watch" : "normal";
  const sevSpO2 = v => v < 90 ? "critical" : v < 92 ? "elevated" : v < 95 ? "watch" : "normal";
  const sevRR = v => v >= 52 ? "elevated" : v >= 46 ? "watch" : "normal";
  function ConfirmDialog({
    onCancel,
    onConfirm
  }) {
    return R.createElement("div", {
      role: "dialog",
      "aria-modal": "true",
      style: {
        position: "fixed",
        inset: 0,
        background: "color-mix(in srgb, var(--n-950) 55%, transparent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: "var(--sp-6)"
      }
    }, R.createElement("div", {
      style: {
        background: "var(--surface-raised)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--sp-6)",
        maxWidth: 440,
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-4)",
        boxShadow: "var(--elev-4)",
        border: "var(--border-w) solid var(--border)"
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)"
      }
    }, R.createElement("span", {
      style: {
        color: "var(--sev-critical-fg)",
        display: "inline-flex"
      }
    }, R.createElement(Icon, {
      name: "octagon-alert",
      size: 26
    })), R.createElement("h2", {
      style: {
        margin: 0,
        fontSize: "var(--fs-h2)",
        color: "var(--text-strong)"
      }
    }, "לסיים את הסשן?")), R.createElement("p", {
      style: {
        margin: 0,
        fontSize: "var(--fs-body)",
        color: "var(--text-muted)",
        lineHeight: "var(--lh-normal)"
      }
    }, "פעולה זו עוצרת את הסימולציה לכל התחנות ומעבירה לתחקיר. לא ניתן לחזור אחורה."), R.createElement("div", {
      style: {
        display: "flex",
        gap: "var(--sp-3)",
        justifyContent: "flex-start",
        marginTop: "var(--sp-2)"
      }
    }, R.createElement(Button, {
      variant: "danger",
      onClick: onConfirm
    }, "סיים והעבר לתחקיר"), R.createElement(Button, {
      variant: "ghost",
      onClick: onCancel
    }, "המשך סשן"))));
  }
  function RoleStatus({
    role
  }) {
    return R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        padding: "var(--sp-3) var(--sp-4)",
        background: "var(--surface)",
        border: "var(--border-w) solid var(--border)",
        borderRadius: "var(--radius-md)",
        opacity: role.conn === "reconnecting" ? 0.9 : 1
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 0,
        flex: 1
      }
    }, R.createElement("span", {
      style: {
        fontWeight: 700,
        fontSize: "var(--fs-sm)",
        color: "var(--text-strong)"
      }
    }, role.label), R.createElement("span", {
      style: {
        fontSize: "var(--fs-xs)",
        color: "var(--text-muted)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, role.who + (role.conn === "reconnecting" ? "" : " · " + role.task))), R.createElement(ConnectionPill, {
      state: role.conn
    }));
  }
  function Console() {
    const [dark, setDark] = R.useState(false);
    const [elapsed, setElapsed] = R.useState(78);
    const [paused, setPaused] = R.useState(false);
    const [vitals, setVitals] = R.useState(D.vitals);
    const [fired, setFired] = R.useState({});
    const [shockAvailable, setShockAvailable] = R.useState(true);
    const [confirm, setConfirm] = R.useState(false);
    const [ended, setEnded] = R.useState(false);
    R.useEffect(() => {
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    }, [dark]);
    R.useEffect(() => {
      if (paused || ended) return;
      const id = setInterval(() => {
        setElapsed(e => e + 1);
        setVitals(v => ({
          hr: Math.max(140, Math.min(200, v.hr + (Math.random() > 0.45 ? 1 : -1))),
          spo2: Math.max(88, Math.min(97, v.spo2 + (Math.random() > 0.5 ? 0 : Math.random() > 0.5 ? 1 : -1))),
          rr: Math.max(28, Math.min(54, v.rr + (Math.random() > 0.5 ? 1 : -1))),
          temp: v.temp
        }));
      }, 1000);
      return () => clearInterval(id);
    }, [paused, ended]);
    function fire(id, t) {
      setFired(f => ({
        ...f,
        [id]: "T+" + fmt(elapsed)
      }));
    }
    return R.createElement("div", {
      dir: "rtl",
      style: {
        height: "100vh",
        background: "var(--bg-canvas)",
        color: "var(--text)",
        fontFamily: "var(--font-ui)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }
    }, /* command bar */
    R.createElement("header", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)",
        padding: "var(--sp-3) var(--sp-5)",
        background: "var(--surface)",
        borderBottom: "var(--border-w-strong) solid var(--border-strong)"
      }
    }, R.createElement("div", {
      style: {
        fontWeight: 700,
        fontSize: "var(--fs-h3)"
      }
    }, "Vet", R.createElement("span", {
      style: {
        color: "var(--action)"
      }
    }, "Crew")), R.createElement(SessionState, {
      state: ended ? "debrief" : paused ? "paused" : "running",
      elapsed: fmt(elapsed)
    }), R.createElement("span", {
      style: {
        fontSize: "var(--fs-sm)",
        color: "var(--text-muted)"
      }
    }, D.session.title + " · " + D.session.engine), R.createElement("div", {
      style: {
        marginInlineStart: "auto",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)"
      }
    }, R.createElement(Button, {
      variant: paused ? "primary" : "secondary",
      size: "lg",
      iconStart: R.createElement(Icon, {
        name: paused ? "play" : "pause",
        size: 20
      }),
      onClick: () => setPaused(p => !p)
    }, paused ? "המשך" : "השהה"), R.createElement(Button, {
      variant: "danger",
      size: "lg",
      iconStart: R.createElement(Icon, {
        name: "square",
        size: 18
      }),
      onClick: () => setConfirm(true)
    }, "סיים סשן"), R.createElement(IconButton, {
      label: dark ? "מצב יום" : "מצב לילה",
      onClick: () => setDark(v => !v),
      icon: R.createElement(Icon, {
        name: dark ? "sun" : "moon",
        size: 20
      })
    }))), /* main: patient + roles | injections */
    R.createElement("div", {
      style: {
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1.35fr 1fr",
        gap: "var(--sp-5)",
        padding: "var(--sp-5)",
        minHeight: 0,
        overflow: "auto"
      }
    }, /* left: live monitor + roles */
    R.createElement("section", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-4)",
        minWidth: 0
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)"
      }
    }, R.createElement("span", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)"
      }
    }, "מוניטור מטופל · חי"), paused && R.createElement(SeverityChip, {
      level: "normal",
      appearance: "outline",
      size: "sm",
      lang: "he",
      showLabel: true
    }), R.createElement("span", {
      style: {
        marginInlineStart: "auto"
      }
    }, R.createElement(ConnectionPill, {
      state: paused ? "paused" : "live"
    }))), R.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "var(--sp-3)"
      }
    }, R.createElement(VitalCard, {
      name: "דופק",
      abbr: "HR",
      value: vitals.hr,
      unit: "bpm",
      level: sevHR(vitals.hr),
      trend: "up",
      size: "station",
      stale: false
    }), R.createElement(VitalCard, {
      name: "ריווי חמצן",
      abbr: "SpO₂",
      value: vitals.spo2,
      unit: "%",
      level: sevSpO2(vitals.spo2),
      trend: "down",
      size: "station"
    }), R.createElement(VitalCard, {
      name: "נשימות",
      abbr: "RR",
      value: vitals.rr,
      unit: "/min",
      level: sevRR(vitals.rr),
      trend: "up",
      size: "station"
    }), R.createElement(VitalCard, {
      name: "חום",
      abbr: "TEMP",
      value: vitals.temp.toFixed(1),
      unit: "°C",
      level: "normal",
      trend: "flat",
      size: "station"
    })), R.createElement("div", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)",
        marginTop: "var(--sp-1)"
      }
    }, "תחנות מחוברות"), R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)"
      }
    }, D.roles.map(r => R.createElement(RoleStatus, {
      key: r.id,
      role: r
    })))), /* right: injections */
    R.createElement("section", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-3)",
        minWidth: 0,
        background: "var(--surface-2)",
        border: "var(--border-w) solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--sp-4)"
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between"
      }
    }, R.createElement("h2", {
      style: {
        margin: 0,
        fontSize: "var(--fs-h3)",
        color: "var(--text-strong)"
      }
    }, "הזרקות אירועים"), R.createElement("span", {
      style: {
        fontSize: "var(--fs-xs)",
        color: "var(--text-faint)"
      }
    }, "לחיצה = הזרקה מיידית")), shockAvailable && R.createElement("div", {
      style: {
        border: "var(--border-w-strong) solid var(--sev-elevated-edge)",
        borderRadius: "var(--radius-md)",
        background: "var(--sev-elevated-fill)",
        padding: "var(--sp-2)"
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        padding: "0 var(--sp-1) var(--sp-1)"
      }
    }, R.createElement(Icon, {
      name: "triangle-alert",
      size: 15,
      style: {
        color: "var(--sev-elevated-fg)"
      }
    }), R.createElement("span", {
      style: {
        fontSize: "var(--fs-xs)",
        fontWeight: 700,
        color: "var(--sev-elevated-fg)",
        letterSpacing: "var(--ls-caps)",
        textTransform: "uppercase"
      }
    }, "נפתח לפי תנאי")), R.createElement(InjectionTrigger, {
      title: D.conditional.title,
      description: D.conditional.desc,
      kind: D.conditional.kind,
      icon: R.createElement(Icon, {
        name: D.conditional.icon,
        size: 22
      }),
      fired: !!fired[D.conditional.id],
      firedAt: fired[D.conditional.id],
      onFire: () => fire(D.conditional.id)
    })), R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-3)",
        overflow: "auto"
      }
    }, D.injections.map(inj => R.createElement(InjectionTrigger, {
      key: inj.id,
      title: inj.title,
      description: inj.desc,
      kind: inj.kind,
      icon: R.createElement(Icon, {
        name: inj.icon,
        size: 22
      }),
      fired: !!fired[inj.id],
      firedAt: fired[inj.id],
      onFire: () => fire(inj.id)
    }))))), confirm && R.createElement(ConfirmDialog, {
      onCancel: () => setConfirm(false),
      onConfirm: () => {
        setConfirm(false);
        setEnded(true);
        setPaused(true);
      }
    }));
  }
  window.VCKit = window.VCKit || {};
  window.VCKit.Console = Console;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instructor/Console.jsx", error: String((e && e.message) || e) }); }

// ui_kits/instructor/data.js
try { (() => {
/* VetCrew instructor console — sample live-session data. window.VCINS_DATA */
window.VCINS_DATA = {
  session: {
    title: "החייאת כלב — GDV",
    scenario: "gdv-canine-v1",
    engine: "Alpha · פרוצדורלי"
  },
  roles: [{
    id: "primary_tech",
    label: "טכנאי ראשי",
    who: "נועה ל.",
    conn: "live",
    task: "מבצע גישה ורידית"
  }, {
    id: "vet",
    label: "וטרינר",
    who: "ד״ר כהן",
    conn: "live",
    task: "מעריך ריריות ו-CRT"
  }, {
    id: "triage_tech",
    label: "טכנאי טריאז'",
    who: "יונתן ר.",
    conn: "reconnecting",
    task: "—"
  }],
  vitals: {
    hr: 176,
    spo2: 93,
    rr: 46,
    temp: 38.7
  },
  injections: [{
    id: "owner",
    title: "בעל הבית נכנס נסער",
    desc: "הסחת דעת לצוות בזמן טיפול",
    kind: "מידע",
    icon: "user-round"
  }, {
    id: "history",
    title: "היסטוריה חדשה מהתיק",
    desc: "אירוע דומה לפני חודשיים",
    kind: "מידע",
    icon: "file-text"
  }, {
    id: "iv-fail",
    title: "כשל בגישה הורידית",
    desc: "הצנתר יוצא — נדרשת גישה חוזרת",
    kind: "ציוד",
    icon: "zap-off"
  }, {
    id: "monitor",
    title: "תקלה במוניטור",
    desc: "קריאת SpO₂ הופכת ללא אמינה",
    kind: "ציוד",
    icon: "monitor-off"
  }, {
    id: "second",
    title: "מטופל שני בטריאז'",
    desc: "עומס — חלוקת קשב בין שני מטופלים",
    kind: "מטופל נוסף",
    icon: "plus"
  }],
  // becomes available on a condition (surfaced, not auto-fired)
  conditional: {
    id: "shock",
    title: "החמרה למצב הלם",
    desc: "זמין: לא בוצעה גישה ורידית עד T+90ש'",
    kind: "סיבוך",
    icon: "activity"
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/instructor/data.js", error: String((e && e.message) || e) }); }

// ui_kits/trainee/Station.jsx
try { (() => {
/* VetCrew — Trainee station. Register: calm, glanceable, deliberately partial.
   Two modalities (base/procedural — clock can freeze; realtime — continuous),
   plus the never-stale reconnecting state. Exposes window.VCKit.Station. */
(function () {
  const R = window.React;
  const DS = window.DesignSystem_ad98cb;
  const {
    VitalCard,
    SessionState,
    ConnectionPill,
    Button,
    SeverityChip
  } = DS;
  const Icon = window.VC.Icon;
  const D = window.VCTR_DATA;
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const sevHR = v => v >= 192 ? "critical" : v >= 176 ? "elevated" : v >= 166 ? "watch" : "normal";
  const sevSpO2 = v => v < 90 ? "critical" : v < 92 ? "elevated" : v < 95 ? "watch" : "normal";
  function Seg({
    options,
    value,
    onChange,
    label
  }) {
    return R.createElement("div", {
      role: "group",
      "aria-label": label,
      style: {
        display: "inline-flex",
        background: "var(--surface-2)",
        border: "var(--border-w) solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 3,
        gap: 3
      }
    }, options.map(o => R.createElement("button", {
      key: o.v,
      onClick: () => onChange(o.v),
      "aria-pressed": value === o.v,
      style: {
        minHeight: 36,
        padding: "0 12px",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        border: "none",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--fs-sm)",
        fontWeight: 600,
        background: value === o.v ? "var(--action)" : "transparent",
        color: value === o.v ? "var(--on-action)" : "var(--text-muted)"
      }
    }, o.label)));
  }
  function WithheldTile({
    item
  }) {
    return R.createElement("div", {
      style: {
        background: "var(--surface)",
        border: "var(--border-w) dashed var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--sp-5) var(--sp-6)",
        minHeight: 180,
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-2)",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center"
      }
    }, R.createElement(Icon, {
      name: "eye-off",
      size: 30,
      style: {
        color: "var(--text-faint)"
      }
    }), R.createElement("div", {
      style: {
        fontSize: "var(--fs-h3)",
        fontWeight: 600,
        color: "var(--text-muted)"
      }
    }, item.name), R.createElement("div", {
      style: {
        fontFamily: "var(--font-mono)",
        fontSize: "var(--fs-xs)",
        color: "var(--text-faint)",
        letterSpacing: "var(--ls-caps)",
        textTransform: "uppercase"
      }
    }, item.abbr), R.createElement("div", {
      style: {
        fontSize: "var(--fs-sm)",
        color: "var(--text-faint)"
      }
    }, "לא בתחום שלך · בקש מ" + item.holder));
  }
  function Station() {
    const [dark, setDark] = R.useState(false);
    const [mode, setMode] = R.useState("base"); // base | realtime
    const [conn, setConn] = R.useState("live"); // live | reconnecting
    const [step, setStep] = R.useState(2);
    const [elapsed, setElapsed] = R.useState(96);
    const [v, setV] = R.useState(D.visible);
    R.useEffect(() => {
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    }, [dark]);
    R.useEffect(() => {
      if (mode !== "realtime" || conn !== "live") return; // base mode: clock is frozen
      const id = setInterval(() => {
        setElapsed(e => e + 1);
        setV(x => ({
          hr: Math.max(150, Math.min(198, x.hr + (Math.random() > 0.45 ? 1 : -1))),
          spo2: Math.max(88, Math.min(96, x.spo2 + (Math.random() > 0.6 ? 0 : Math.random() > 0.5 ? 1 : -1)))
        }));
      }, 1000);
      return () => clearInterval(id);
    }, [mode, conn]);
    const stale = conn === "reconnecting";
    return R.createElement("div", {
      dir: "rtl",
      style: {
        minHeight: "100vh",
        background: "var(--bg-canvas)",
        color: "var(--text)",
        fontFamily: "var(--font-ui)",
        display: "flex",
        flexDirection: "column"
      }
    }, /* demo controls */
    R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        padding: "var(--sp-2) var(--sp-5)",
        background: "var(--surface-2)",
        borderBottom: "var(--border-w) solid var(--border)",
        flexWrap: "wrap"
      }
    }, R.createElement("span", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)"
      }
    }, "תצוגת הדגמה"), R.createElement(Seg, {
      label: "מודליות",
      value: mode,
      onChange: setMode,
      options: [{
        v: "base",
        label: "בסיס · פרוצדורלי"
      }, {
        v: "realtime",
        label: "זמן אמת"
      }]
    }), R.createElement(Seg, {
      label: "חיבור",
      value: conn,
      onChange: setConn,
      options: [{
        v: "live",
        label: "מחובר"
      }, {
        v: "reconnecting",
        label: "מתנתק"
      }]
    }), R.createElement("button", {
      onClick: () => setDark(x => !x),
      "aria-label": "החלף ערכת נושא",
      style: {
        marginInlineStart: "auto",
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "var(--text-muted)",
        display: "inline-flex",
        padding: 8
      }
    }, R.createElement(Icon, {
      name: dark ? "sun" : "moon",
      size: 20
    }))), /* role header */
    R.createElement("header", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)",
        padding: "var(--sp-4) var(--sp-6)",
        borderBottom: "var(--border-w) solid var(--border)",
        background: "var(--surface)"
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2
      }
    }, R.createElement("span", {
      style: {
        fontSize: "var(--fs-h2)",
        fontWeight: 700,
        color: "var(--text-strong)"
      }
    }, D.role.label), R.createElement("span", {
      style: {
        fontSize: "var(--fs-sm)",
        color: "var(--text-muted)"
      }
    }, D.patient)), R.createElement("div", {
      style: {
        marginInlineStart: "auto",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)"
      }
    }, mode === "realtime" && !stale && R.createElement(SessionState, {
      state: "running",
      elapsed: fmt(elapsed)
    }), R.createElement(ConnectionPill, {
      state: stale ? "reconnecting" : "live"
    }))), /* main */
    R.createElement("main", {
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-5)",
        padding: "var(--sp-6)",
        maxWidth: 1000,
        width: "100%",
        marginInline: "auto",
        boxSizing: "border-box"
      }
    }, stale && R.createElement("div", {
      role: "alert",
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        padding: "var(--sp-4)",
        background: "var(--status-reconnecting-fill)",
        backgroundImage: "var(--stale-hatch)",
        border: "var(--border-w-strong) solid var(--status-reconnecting-dot)",
        borderRadius: "var(--radius-lg)",
        color: "var(--status-reconnecting-fg)"
      }
    }, R.createElement(Icon, {
      name: "wifi-off",
      size: 22
    }), R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column"
      }
    }, R.createElement("strong", {
      style: {
        fontSize: "var(--fs-body-lg)"
      }
    }, "החיבור אבד — הנתונים אינם עדכניים"), R.createElement("span", {
      style: {
        fontSize: "var(--fs-sm)",
        opacity: 0.9
      }
    }, "אל תפעל לפי המספרים הקפואים. ממתין להתחברות מחדש…"))), /* glanceable vitals — partial */
    R.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: "var(--sp-4)"
      }
    }, R.createElement(VitalCard, {
      name: "דופק",
      abbr: "HR",
      value: v.hr,
      unit: "bpm",
      level: sevHR(v.hr),
      trend: "up",
      size: "station",
      stale,
      lastSeen: "12:04:38"
    }), R.createElement(VitalCard, {
      name: "ריווי חמצן",
      abbr: "SpO₂",
      value: v.spo2,
      unit: "%",
      level: sevSpO2(v.spo2),
      trend: "down",
      size: "station",
      stale,
      lastSeen: "12:04:38"
    }), R.createElement(WithheldTile, {
      item: D.withheld[0]
    })), /* task / tempo panel */
    mode === "base" ? R.createElement("div", {
      style: {
        background: "var(--surface)",
        border: "var(--border-w) solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--sp-6)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-4)",
        boxShadow: "var(--elev-1)"
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)"
      }
    }, R.createElement("span", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)"
      }
    }, "שלב " + (step + 1) + " מתוך " + D.steps.length), R.createElement("span", {
      style: {
        marginInlineStart: "auto",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-1)",
        fontSize: "var(--fs-xs)",
        color: "var(--text-muted)"
      }
    }, R.createElement(Icon, {
      name: "pause",
      size: 14
    }), "השעון קפוא — בצע כשמוכן")), R.createElement("div", {
      style: {
        fontSize: "var(--fs-display)",
        fontWeight: 700,
        color: "var(--text-strong)",
        lineHeight: "var(--lh-snug)"
      }
    }, D.steps[step]), R.createElement("div", {
      style: {
        display: "flex",
        gap: "var(--sp-3)",
        flexWrap: "wrap",
        marginTop: "var(--sp-1)"
      }
    }, R.createElement(Button, {
      variant: "primary",
      size: "lg",
      disabled: stale || step >= D.steps.length - 1,
      iconStart: R.createElement(Icon, {
        name: "check",
        size: 20
      }),
      onClick: () => setStep(s => Math.min(D.steps.length - 1, s + 1))
    }, "בצע והמשך"), R.createElement(Button, {
      variant: "secondary",
      size: "lg",
      disabled: stale,
      iconStart: R.createElement(Icon, {
        name: "megaphone",
        size: 20
      })
    }, "בקש מידע מהצוות"))) : R.createElement("div", {
      style: {
        background: "var(--surface)",
        border: "var(--border-w) solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--sp-6)",
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-4)",
        boxShadow: "var(--elev-1)",
        flexWrap: "wrap"
      }
    }, R.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2
      }
    }, R.createElement("span", {
      className: "vc-caps",
      style: {
        color: "var(--text-faint)"
      }
    }, "זמן אמת · המטופל מתדרדר"), R.createElement("span", {
      style: {
        fontSize: "var(--fs-body)",
        color: "var(--text-muted)"
      }
    }, "פעל ותקשר בזמן אמת — אין השהיה בין פעולות")), R.createElement("div", {
      style: {
        marginInlineStart: "auto",
        display: "flex",
        gap: "var(--sp-3)"
      }
    }, R.createElement(Button, {
      variant: "primary",
      size: "lg",
      disabled: stale,
      iconStart: R.createElement(Icon, {
        name: "megaphone",
        size: 20
      })
    }, "קרא מדד בקול"), R.createElement(Button, {
      variant: "secondary",
      size: "lg",
      disabled: stale,
      iconStart: R.createElement(Icon, {
        name: "hand",
        size: 20
      })
    }, "בקש עזרה")))));
  }
  window.VCKit = window.VCKit || {};
  window.VCKit.Station = Station;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trainee/Station.jsx", error: String((e && e.message) || e) }); }

// ui_kits/trainee/data.js
try { (() => {
/* VetCrew trainee station — sample data. window.VCTR_DATA */
window.VCTR_DATA = {
  role: {
    label: "טכנאי ראשי",
    who: "נועה ל."
  },
  patient: "כלב · גזע גדול · GDV",
  // what THIS role sees (partial view). abp is withheld — must ask the team.
  visible: {
    hr: 168,
    spo2: 92
  },
  withheld: [{
    abbr: "ABP",
    name: "לחץ דם",
    holder: "וטרינר"
  }],
  steps: ["אשר זהות מטופל ומשקל", "הכן ערכת צנתר 18G", "בצע גישה ורידית — גף קדמי שמאלי", "חבר סט עירוי ובצע בולוס גבישי", "קרא מדדים בקול לצוות", "תעד את הפעולה ועדכן וטרינר"]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/trainee/data.js", error: String((e && e.message) || e) }); }

__ds_ns.AntsRating = __ds_scope.AntsRating;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.InjectionTrigger = __ds_scope.InjectionTrigger;

__ds_ns.TaskChip = __ds_scope.TaskChip;

__ds_ns.PatientMonitor = __ds_scope.PatientMonitor;

__ds_ns.ConnectionPill = __ds_scope.ConnectionPill;

__ds_ns.SESSION_STATES = __ds_scope.SESSION_STATES;

__ds_ns.SessionState = __ds_scope.SessionState;

__ds_ns.SeverityChip = __ds_scope.SeverityChip;

__ds_ns.SEVERITY = __ds_scope.SEVERITY;

__ds_ns.SeverityGlyph = __ds_scope.SeverityGlyph;

__ds_ns.SEVERITY_ORDER = __ds_scope.SEVERITY_ORDER;

__ds_ns.TimelineScrubber = __ds_scope.TimelineScrubber;

__ds_ns.VitalCard = __ds_scope.VitalCard;

})();
