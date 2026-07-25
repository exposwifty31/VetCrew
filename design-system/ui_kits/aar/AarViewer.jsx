/* VetCrew — AAR replay viewer. Register: reflective, data-rich, trustworthy.
   Composes DS primitives from window.DesignSystem_ad98cb. Exposes window.VCKit.AarViewer. */
(function () {
  const R = window.React;
  const DS = window.DesignSystem_ad98cb;
  const { TimelineScrubber, SeverityChip, VitalCard, AntsRating, SessionState, Button, IconButton } = DS;
  const Icon = window.VC.Icon;
  const D = window.VCAAR_DATA;

  function interp(series, t) {
    if (t <= series[0][0]) return series[0][1];
    for (let i = 1; i < series.length; i++) {
      if (t <= series[i][0]) {
        const [t0, v0] = series[i - 1], [t1, v1] = series[i];
        return v0 + (v1 - v0) * ((t - t0) / (t1 - t0));
      }
    }
    return series[series.length - 1][1];
  }
  const sevHR = (v) => v >= 192 ? "critical" : v >= 176 ? "elevated" : v >= 166 ? "watch" : "normal";
  const sevSpO2 = (v) => v < 90 ? "critical" : v < 92 ? "elevated" : v < 95 ? "watch" : "normal";
  const sevRR = (v) => v >= 52 ? "elevated" : v >= 46 ? "watch" : "normal";
  const fmt = (s) => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; };
  const trend = (series, t) => { const a = interp(series, Math.max(0, t - 12)), b = interp(series, t); return b - a > 0.6 ? "up" : b - a < -0.6 ? "down" : "flat"; };

  const VMETA = {
    hr:   { name: "דופק", abbr: "HR", unit: "bpm", sev: sevHR },
    spo2: { name: "ריווי חמצן", abbr: "SpO₂", unit: "%", sev: sevSpO2 },
    rr:   { name: "נשימות", abbr: "RR", unit: "/min", sev: sevRR },
    temp: { name: "חום", abbr: "TEMP", unit: "°C", sev: () => "normal" },
  };

  const TYPES = [
    { id: "action", label: "פעולות" }, { id: "injection", label: "הזרקות" },
    { id: "vitals", label: "מדדים" }, { id: "callout", label: "קריאות" }, { id: "phase", label: "שלבים" },
  ];

  function FilterChip({ active, children, onClick }) {
    return R.createElement("button", {
      onClick, className: "aar-fchip", "aria-pressed": active,
      style: {
        minHeight: 32, padding: "0 14px", borderRadius: "var(--radius-pill)", cursor: "pointer",
        fontFamily: "var(--font-ui)", fontSize: "var(--fs-sm)", fontWeight: 600,
        border: "var(--border-w) solid " + (active ? "var(--action)" : "var(--border-default)"),
        background: active ? "var(--action-fill)" : "var(--surface-card)",
        color: active ? "var(--action-quiet, var(--action))" : "var(--text-secondary)",
        transition: "all var(--dur-fast) var(--ease-standard)",
        boxShadow: active ? "var(--shadow-glow-running)" : "var(--shadow-card)",
      },
    }, children);
  }

  function RolePanel({ role, event }) {
    return R.createElement("div", { style: {
      background: "var(--surface-base)", border: "var(--border-w) solid var(--border-subtle)",
      borderRadius: "var(--radius-lg)", padding: "4px", boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column", minWidth: 0,
    }},
      R.createElement("div", { style: {
        background: "var(--surface-card)", border: "var(--border-w) solid var(--border-default)",
        borderRadius: "calc(var(--radius-lg) - 4px)", padding: "var(--sp-3) var(--sp-4)", display: "flex", flexDirection: "column", gap: "var(--sp-2)", flex: 1, minWidth: 0,
        boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)",
      }},
        R.createElement("div", { style: { display: "flex", alignItems: "center", gap: "var(--sp-2)", borderBottom: "var(--border-w) solid var(--border-subtle)", paddingBottom: "var(--sp-1)" }},
          R.createElement("span", { style: { fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--text-primary)" }}, role.label),
          R.createElement("span", { className: "vc-caps", style: { marginInlineStart: "auto", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)" }}, role.short)
        ),
        event
          ? R.createElement(R.Fragment, null,
              R.createElement("div", { style: { fontSize: "var(--fs-body)", color: "var(--text-primary)", fontWeight: 600 }}, event.label),
              R.createElement("div", { style: { fontSize: "var(--fs-sm)", color: "var(--text-secondary)", lineHeight: "var(--lh-normal)" }}, event.detail),
              R.createElement("div", { className: "vc-num", style: { fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginTop: "auto", fontFamily: "var(--font-mono)" }}, "T+" + fmt(event.t))
            )
          : R.createElement("div", { style: { fontSize: "var(--fs-sm)", color: "var(--text-muted)", fontStyle: "italic", marginTop: "auto" }}, "טרם פעל בפרק זמן זה")
      )
    );
  }

  function TweakRadio({ label, value, options, onChange }) {
    return R.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "var(--sp-1)" }},
      R.createElement("span", { className: "vc-caps", style: { color: "var(--text-muted)", fontSize: "var(--fs-xs)", fontWeight: "var(--fw-semibold)" }}, label),
      R.createElement("div", { role: "radiogroup", "aria-label": label, style: {
        display: "inline-flex", background: "var(--surface-base)", border: "var(--border-w) solid var(--border-default)",
        borderRadius: "var(--radius-md)", padding: 3, gap: 3, boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)"
      }},
        options.map((o) => R.createElement("button", {
          key: String(o.v), role: "radio", "aria-checked": value === o.v, onClick: () => onChange(o.v),
          style: {
            minHeight: 32, padding: "0 12px", borderRadius: "calc(var(--radius-md) - 3px)", cursor: "pointer", border: "none",
            fontFamily: "var(--font-ui)", fontSize: "var(--fs-sm)", fontWeight: 600,
            background: value === o.v ? "var(--action)" : "transparent",
            color: value === o.v ? "var(--on-action)" : "var(--text-secondary)",
            transition: "all var(--dur-fast) var(--ease-standard)",
          },
        }, o.label))
      )
    );
  }

  function TweaksPanel({ dark, setDark, speed, setSpeed, showLanes, setShowLanes, onClose }) {
    return R.createElement("div", { role: "region", "aria-label": "התאמות תצוגה", style: {
      display: "flex", alignItems: "center", flexWrap: "wrap", gap: "var(--sp-6)",
      padding: "var(--sp-3) var(--sp-6)", background: "var(--surface-card)",
      borderBottom: "var(--border-w) solid var(--border-default)", boxShadow: "var(--shadow-card)",
    }},
      R.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: "var(--sp-2)", fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--text-primary)" }},
        R.createElement(Icon, { name: "sliders-horizontal", size: 16, style: { color: "var(--action)" } }), "התאמות"),
      R.createElement(TweakRadio, { label: "ערכת נושא", value: dark ? "dark" : "light", onChange: (v) => setDark(v === "dark"), options: [{ v: "light", label: "יום" }, { v: "dark", label: "לילה" }] }),
      R.createElement(TweakRadio, { label: "מהירות ניגון", value: speed, onChange: setSpeed, options: [{ v: 1, label: "1×" }, { v: 2, label: "2×" }, { v: 4, label: "4×" }] }),
      R.createElement(TweakRadio, { label: "מסלולי תפקידים", value: showLanes, onChange: setShowLanes, options: [{ v: true, label: "מוצג" }, { v: false, label: "מוסתר" }] }),
      R.createElement(IconButton, { label: "סגור התאמות", onClick: onClose, className: "aar-tweak-close", icon: R.createElement(Icon, { name: "x", size: 18 }), style: { marginInlineStart: "auto" } })
    );
  }

  function AarViewer() {
    const [pos, setPos] = R.useState(196);
    const [playing, setPlaying] = R.useState(false);
    const [roleFilter, setRoleFilter] = R.useState(null);
    const [typeFilter, setTypeFilter] = R.useState(() => new Set());
    const [selId, setSelId] = R.useState("e7");
    const [dark, setDark] = R.useState(false);
    const [speed, setSpeed] = R.useState(2);       // tweak: playback rate (1/2/4×)
    const [showLanes, setShowLanes] = R.useState(true); // tweak: per-role lanes
    const [tweaksOpen, setTweaksOpen] = R.useState(false);

    R.useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
    R.useEffect(() => {
      if (!playing) return;
      const id = setInterval(() => setPos((p) => { const n = p + 3; if (n >= D.session.duration) { setPlaying(false); return D.session.duration; } return n; }), 200 / speed);
      return () => clearInterval(id);
    }, [playing, speed]);

    const markers = D.events
      .filter((e) => !roleFilter || e.role === roleFilter)
      .filter((e) => typeFilter.size === 0 || typeFilter.has(e.type))
      .map((e) => ({ t: e.t, type: e.type, role: e.role, label: e.label, severity: e.severity }));
    const lanes = showLanes ? D.roles.map((r) => ({ role: r.id, label: r.label })) : null;
    const sel = D.events.find((e) => e.id === selId);

    const latestForRole = (rid) => D.events.filter((e) => e.role === rid && e.t <= pos).slice(-1)[0];

    function jumpTo(t, id) { setPos(t); if (id) setSelId(id); setPlaying(false); }
    function toggleType(id) { setTypeFilter((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

    const vitalNow = (k) => { const raw = interp(D.vitals[k], pos); return k === "temp" ? raw.toFixed(1) : Math.round(raw); };

    return R.createElement("div", { className: "aar", dir: "rtl", style: {
      minHeight: "100vh", background: "var(--surface-base)", color: "var(--text-primary)", fontFamily: "var(--font-ui)",
      display: "flex", flexDirection: "column",
    }},
      /* ---- header ---- */
      R.createElement("header", { style: {
        display: "flex", alignItems: "center", gap: "var(--sp-4)", padding: "var(--sp-4) var(--sp-6)",
        borderBottom: "var(--border-w) solid var(--border-default)", background: "var(--surface-card)",
        boxShadow: "var(--shadow-card)", zIndex: 10,
      }},
        R.createElement("div", { style: { fontWeight: 800, fontSize: "var(--fs-h3)", letterSpacing: "var(--ls-tight)" }}, "Vet", R.createElement("span", { style: { color: "var(--action)" }}, "Crew")),
        R.createElement("div", { style: { width: 1, height: 28, background: "var(--border-subtle)" }}),
        R.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }},
          R.createElement("span", { style: { fontWeight: 600, fontSize: "var(--fs-body)", color: "var(--text-primary)", whiteSpace: "nowrap" }}, D.session.title),
          R.createElement("span", { className: "vc-num", style: { fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}, D.session.date + " · " + D.session.engine)
        ),
        R.createElement("div", { style: { marginInlineStart: "auto", display: "flex", alignItems: "center", gap: "var(--sp-4)" }},
          R.createElement(SessionState, { state: D.session.state, variant: "stepper" }),
          R.createElement(IconButton, { label: dark ? "מצב יום" : "מצב לילה", onClick: () => setDark((v) => !v), icon: R.createElement(Icon, { name: dark ? "sun" : "moon", size: 20 }) }),
          R.createElement(IconButton, { label: "התאמות תצוגה", variant: tweaksOpen ? "solid" : "ghost", onClick: () => setTweaksOpen((v) => !v), icon: R.createElement(Icon, { name: "sliders-horizontal", size: 20 }) })
        )
      ),

      tweaksOpen && R.createElement(TweaksPanel, {
        dark, setDark, speed, setSpeed, showLanes, setShowLanes, onClose: () => setTweaksOpen(false),
      }),

      /* ---- body: stage + scores rail ---- */
      R.createElement("div", { style: { flex: 1, display: "grid", gridTemplateColumns: "1fr 380px", gap: "var(--sp-6)", padding: "var(--sp-6)", alignItems: "start", minHeight: 0 }},
        /* stage */
        R.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "var(--sp-4)", minWidth: 0 }},
          R.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: "var(--sp-3)" }},
            R.createElement("span", { className: "vc-caps", style: { color: "var(--text-muted)", fontWeight: "var(--fw-semibold)" }}, "מצב המטופל בזמן"),
            R.createElement("span", { className: "vc-num", style: { fontSize: "var(--fs-h3)", fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}, fmt(pos))
          ),
          R.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "var(--sp-4)" }},
            ["hr", "spo2", "rr", "temp"].map((k) => {
              const v = vitalNow(k), m = VMETA[k];
              return R.createElement(VitalCard, { key: k, name: m.name, abbr: m.abbr, value: v, unit: m.unit, level: m.sev(parseFloat(v)), trend: trend(D.vitals[k], pos), size: "compact" });
            })
          ),
          R.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: "var(--sp-3)", marginTop: "var(--sp-2)" }},
            R.createElement("span", { className: "vc-caps", style: { color: "var(--text-muted)", fontWeight: "var(--fw-semibold)" }}, "מה ראה כל תפקיד"),
            R.createElement("span", { style: { fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontWeight: "var(--fw-medium)" }}, "· תצוגה חלקית לכל תפקיד")
          ),
          R.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "var(--sp-4)" }},
            D.roles.map((r) => R.createElement(RolePanel, { key: r.id, role: r, event: latestForRole(r.id) }))
          ),
          /* selected event detail - Ambient Glow styling instead of thick border */
          sel && (function() {
            const glowShadow = sel.severity === "critical" ? "var(--shadow-glow-critical)"
                             : sel.severity === "elevated" ? "var(--shadow-glow-elevated)"
                             : sel.severity === "watch" ? "var(--shadow-glow-watch)"
                             : "var(--shadow-glow-running)";
            const borderColor = sel.severity === "critical" ? "var(--border-critical-subtle)"
                              : sel.severity === "elevated" ? "var(--border-elevated-subtle)"
                              : sel.severity === "watch" ? "var(--border-watch-subtle)"
                              : "var(--border-subtle)";
            const bgSubtle = sel.severity === "critical" ? "var(--bg-critical-subtle)"
                           : sel.severity === "elevated" ? "var(--bg-elevated-subtle)"
                           : sel.severity === "watch" ? "var(--bg-watch-subtle)"
                           : "var(--surface-card)";
            return R.createElement("div", { style: {
              background: bgSubtle, border: "var(--border-w) solid " + borderColor,
              borderRadius: "var(--radius-xl)", padding: "var(--sp-5)", display: "flex", flexDirection: "column", gap: "var(--sp-2)",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.05), " + glowShadow,
              transition: "all var(--dur-fast) var(--ease-standard)",
            }},
              R.createElement("div", { style: { display: "flex", alignItems: "center", gap: "var(--sp-2)" }},
                R.createElement(Icon, { name: "crosshair", size: 16, style: { color: "var(--action)" }}),
                R.createElement("span", { className: "vc-caps", style: { color: "var(--text-muted)", fontWeight: "var(--fw-semibold)" }}, "אירוע נבחר"),
                R.createElement("span", { className: "vc-num", style: { marginInlineStart: "auto", fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}, "T+" + fmt(sel.t)),
                sel.severity && R.createElement(SeverityChip, { level: sel.severity, size: "sm" })
              ),
              R.createElement("div", { style: { fontSize: "var(--fs-body-lg)", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "var(--ls-tight)" }}, sel.label),
              R.createElement("div", { style: { fontSize: "var(--fs-body)", color: "var(--text-secondary)", lineHeight: "var(--lh-normal)" }}, sel.detail)
            );
          })()
        ),

        /* scores rail - Double Bezel Architecture */
        R.createElement("aside", { style: {
          display: "flex", padding: "6px", background: "var(--surface-base)", border: "var(--border-w) solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)", position: "sticky", top: "var(--sp-6)",
        }},
          R.createElement("div", { style: {
            display: "flex", flexDirection: "column", gap: "var(--sp-5)", flex: 1, minWidth: 0,
            background: "var(--surface-card)", border: "var(--border-w) solid var(--border-default)",
            borderRadius: "calc(var(--radius-xl) - 6px)", padding: "var(--sp-5)",
            boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)",
          }},
            R.createElement("div", null,
              R.createElement("div", { style: { fontSize: "var(--fs-h3)", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "var(--ls-tight)" }}, "דירוג מיומנויות צוות"),
              R.createElement("div", { style: { fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}, "ANTS · לחיצה על דירוג קופצת לראיה בציר")
            ),
            R.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "var(--sp-5)" }},
              D.scores.ants.map((a) => R.createElement(AntsRating, {
                key: a.key, category: a.label, value: a.value, anchors: a.anchors, evidenceCount: a.evidence.length,
                onChange: () => {}, onJumpToEvidence: () => { const ev = D.events.find((e) => e.id === a.evidence[0]); if (ev) jumpTo(ev.t, ev.id); },
              }))
            ),
            R.createElement("div", { style: { height: 1, background: "var(--border-subtle)" }}),
            R.createElement("div", { style: { fontSize: "var(--fs-body)", fontWeight: 700, color: "var(--text-primary)" }}, "צ'קליסט טכני"),
            R.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "var(--sp-2)" }},
              D.scores.technical.map((c, i) => R.createElement("button", {
                key: i, onClick: () => jumpTo(c.t), style: {
                  display: "flex", alignItems: "center", gap: "var(--sp-3)", textAlign: "start", cursor: "pointer",
                  background: "transparent", border: "none", padding: "var(--sp-2)", borderRadius: "var(--radius-sm)", minHeight: 44,
                  transition: "background var(--dur-fast) var(--ease-standard)",
                }},
                R.createElement("span", { "aria-hidden": "true", style: {
                  width: 22, height: 22, borderRadius: "var(--radius-xs)", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center",
                  background: c.done ? "var(--bg-running-subtle)" : "var(--surface-base)",
                  border: "var(--border-w) solid " + (c.done ? "var(--border-running-subtle)" : "var(--border-default)"),
                  color: "var(--text-running)",
                  boxShadow: c.done ? "var(--shadow-glow-running)" : "none",
                }}, c.done ? R.createElement(Icon, { name: "check", size: 14, stroke: 3 }) : null),
                R.createElement("span", { style: { flex: 1, fontSize: "var(--fs-sm)", color: c.done ? "var(--text-primary)" : "var(--text-secondary)" }}, c.label),
                R.createElement("span", { className: "vc-num", style: { fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}, "×" + c.weight)
              ))
            )
          )
        )
      ),

      /* ---- footer: transport + scrubber + filters ---- */
      R.createElement("footer", { style: {
        borderTop: "var(--border-w) solid var(--border-default)", background: "var(--surface-card)",
        padding: "var(--sp-4) var(--sp-6)", display: "flex", flexDirection: "column", gap: "var(--sp-3)",
        boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.1)", zIndex: 10,
      }},
        R.createElement("div", { style: { display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }},
          R.createElement("div", { style: { display: "flex", gap: "var(--sp-2)" }},
            R.createElement(IconButton, { label: "להתחלה", onClick: () => jumpTo(0), icon: R.createElement(Icon, { name: "skip-forward", size: 20, flip: true }) }),
            R.createElement(IconButton, { label: "אחורה", onClick: () => setPos((p) => Math.max(0, p - 10)), icon: R.createElement(Icon, { name: "rewind", size: 20, flip: true }) }),
            R.createElement(IconButton, { label: playing ? "השהה" : "נגן", variant: "solid", size: "lg", onClick: () => setPlaying((v) => !v), icon: R.createElement(Icon, { name: playing ? "pause" : "play", size: 22 }) }),
            R.createElement(IconButton, { label: "קדימה", onClick: () => setPos((p) => Math.min(D.session.duration, p + 10)), icon: R.createElement(Icon, { name: "fast-forward", size: 20, flip: true }) })
          ),
          R.createElement("div", { style: { marginInlineStart: "auto", display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }},
            R.createElement("span", { className: "vc-caps", style: { color: "var(--text-muted)", marginInlineEnd: "var(--sp-1)", fontWeight: "var(--fw-semibold)" }}, "תפקיד"),
            R.createElement(FilterChip, { active: !roleFilter, onClick: () => setRoleFilter(null) }, "הכל"),
            D.roles.map((r) => R.createElement(FilterChip, { key: r.id, active: roleFilter === r.id, onClick: () => setRoleFilter((x) => x === r.id ? null : r.id) }, r.label))
          )
        ),
        R.createElement(TimelineScrubber, {
          duration: D.session.duration, position: pos, markers, lanes, onSeek: (t) => { setPos(t); setPlaying(false); },
          onMarkerClick: (m) => { const ev = D.events.find((e) => Math.abs(e.t - m.t) < 1 && e.label === m.label); if (ev) setSelId(ev.id); },
        }),
        R.createElement("div", { style: { display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }},
          R.createElement("span", { className: "vc-caps", style: { color: "var(--text-muted)", marginInlineEnd: "var(--sp-1)", fontWeight: "var(--fw-semibold)" }}, "סנן לפי סוג"),
          TYPES.map((t) => R.createElement(FilterChip, { key: t.id, active: typeFilter.has(t.id), onClick: () => toggleType(t.id) }, t.label))
        )
      )
    );
  }

  window.VCKit = window.VCKit || {};
  window.VCKit.AarViewer = AarViewer;
})();
