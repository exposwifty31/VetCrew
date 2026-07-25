/* VetCrew — Trainee station. Register: calm, glanceable, deliberately partial.
   Two modalities (base/procedural — clock can freeze; realtime — continuous),
   plus the never-stale reconnecting state. Exposes window.VCKit.Station. */
(function () {
  const R = window.React;
  const DS = window.DesignSystem_ad98cb;
  const { VitalCard, SessionState, ConnectionPill, Button, SeverityChip } = DS;
  const Icon = window.VC.Icon;
  const D = window.VCTR_DATA;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const sevHR = (v) => v >= 192 ? "critical" : v >= 176 ? "elevated" : v >= 166 ? "watch" : "normal";
  const sevSpO2 = (v) => v < 90 ? "critical" : v < 92 ? "elevated" : v < 95 ? "watch" : "normal";

  function Seg({ options, value, onChange, label }) {
    return R.createElement("div", { role: "group", "aria-label": label, style: {
      display: "inline-flex", background: "var(--surface-base)", border: "var(--border-w) solid var(--border-default)",
      borderRadius: "var(--radius-md)", padding: 3, gap: 3, boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.35)",
    }},
      options.map((o) => R.createElement("button", {
        key: o.v, onClick: () => onChange(o.v), "aria-pressed": value === o.v, style: {
          minHeight: 32, padding: "0 14px", borderRadius: "calc(var(--radius-md) - 3px)", cursor: "pointer", border: "none",
          fontFamily: "var(--font-ui)", fontSize: "var(--fs-sm)", fontWeight: 600,
          background: value === o.v ? "var(--action)" : "transparent",
          color: value === o.v ? "var(--on-action)" : "var(--text-secondary)",
          transition: "all var(--dur-fast) var(--ease-standard)",
          boxShadow: value === o.v ? "var(--shadow-glow-running)" : "none",
        },
      }, o.label))
    );
  }

  function WithheldTile({ item }) {
    return R.createElement("div", { style: {
      background: "var(--surface-base)", border: "var(--border-w) solid var(--border-subtle)", borderRadius: "var(--radius-xl)",
      padding: "6px", boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column", minHeight: 180,
    }},
      R.createElement("div", { style: {
        background: "var(--surface-card)", border: "var(--border-w) dashed var(--border-default)", borderRadius: "calc(var(--radius-xl) - 6px)",
        padding: "var(--sp-5) var(--sp-6)", display: "flex", flexDirection: "column", gap: "var(--sp-2)", justifyContent: "center", alignItems: "center", textAlign: "center", flex: 1,
        boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)",
      }},
        R.createElement(Icon, { name: "eye-off", size: 30, style: { color: "var(--text-muted)", opacity: 0.5 } }),
        R.createElement("div", { style: { fontSize: "var(--fs-h3)", fontWeight: 600, color: "var(--text-secondary)" }}, item.name),
        R.createElement("div", { style: { fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--text-muted)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase" }}, item.abbr),
        R.createElement("div", { style: { fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}, "לא בתחום שלך · בקש מ" + item.holder)
      )
    );
  }

  function Station() {
    const [dark, setDark] = R.useState(false);
    const [mode, setMode] = R.useState("base");        // base | realtime
    const [conn, setConn] = R.useState("live");         // live | reconnecting
    const [step, setStep] = R.useState(2);
    const [elapsed, setElapsed] = R.useState(96);
    const [v, setV] = R.useState(D.visible);

    R.useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
    R.useEffect(() => {
      if (mode !== "realtime" || conn !== "live") return; // base mode: clock is frozen
      const id = setInterval(() => {
        setElapsed((e) => e + 1);
        setV((x) => ({ hr: Math.max(150, Math.min(198, x.hr + (Math.random() > 0.45 ? 1 : -1))), spo2: Math.max(88, Math.min(96, x.spo2 + (Math.random() > 0.6 ? 0 : (Math.random() > 0.5 ? 1 : -1)))) }));
      }, 1000);
      return () => clearInterval(id);
    }, [mode, conn]);

    const stale = conn === "reconnecting";

    return R.createElement("div", { dir: "rtl", style: {
      minHeight: "100vh", background: "var(--surface-base)", color: "var(--text-primary)", fontFamily: "var(--font-ui)",
      display: "flex", flexDirection: "column",
    }},
      /* demo controls */
      R.createElement("div", { style: {
        display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "var(--sp-2) var(--sp-5)",
        background: "var(--surface-card)", borderBottom: "var(--border-w) solid var(--border-default)", flexWrap: "wrap",
        boxShadow: "var(--shadow-card)", zIndex: 10,
      }},
        R.createElement("span", { className: "vc-caps", style: { color: "var(--text-muted)", fontWeight: "var(--fw-semibold)" }}, "תצוגת הדגמה"),
        R.createElement(Seg, { label: "מודליות", value: mode, onChange: setMode, options: [{ v: "base", label: "בסיס · פרוצדורלי" }, { v: "realtime", label: "זמן אמת" }] }),
        R.createElement(Seg, { label: "חיבור", value: conn, onChange: setConn, options: [{ v: "live", label: "מחובר" }, { v: "reconnecting", label: "מתנתק" }] }),
        R.createElement("button", { onClick: () => setDark((x) => !x), "aria-label": "החלף ערכת נושא", style: { marginInlineStart: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "inline-flex", padding: 8 }}, R.createElement(Icon, { name: dark ? "sun" : "moon", size: 20 }))
      ),

      /* role header */
      R.createElement("header", { style: {
        display: "flex", alignItems: "center", gap: "var(--sp-4)", padding: "var(--sp-4) var(--sp-6)",
        borderBottom: "var(--border-w) solid var(--border-default)", background: "var(--surface-card)",
      }},
        R.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2 }},
          R.createElement("span", { style: { fontSize: "var(--fs-h2)", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "var(--ls-tight)" }}, D.role.label),
          R.createElement("span", { style: { fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}, D.patient)
        ),
        R.createElement("div", { style: { marginInlineStart: "auto", display: "flex", alignItems: "center", gap: "var(--sp-3)" }},
          mode === "realtime" && !stale && R.createElement(SessionState, { state: "running", elapsed: fmt(elapsed) }),
          R.createElement(ConnectionPill, { state: stale ? "reconnecting" : "live" })
        )
      ),

      /* main */
      R.createElement("main", { style: { flex: 1, display: "flex", flexDirection: "column", gap: "var(--sp-5)", padding: "var(--sp-6)", maxWidth: 1000, width: "100%", marginInline: "auto", boxSizing: "border-box" }},
        stale && R.createElement("div", { role: "alert", style: {
          display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "var(--sp-4)",
          background: "var(--bg-elevated-subtle)", backgroundImage: "var(--stale-hatch)",
          border: "var(--border-w-strong) solid var(--border-elevated-subtle)", borderRadius: "var(--radius-lg)",
          color: "var(--text-elevated)", boxShadow: "var(--shadow-glow-elevated)",
        }},
          R.createElement(Icon, { name: "wifi-off", size: 22 }),
          R.createElement("div", { style: { display: "flex", flexDirection: "column" }},
            R.createElement("strong", { style: { fontSize: "var(--fs-body-lg)" }}, "החיבור אבד — הנתונים אינם עדכניים"),
            R.createElement("span", { style: { fontSize: "var(--fs-sm)", opacity: 0.9 }}, "אל תפעל לפי המספרים הקפואים. ממתין להתחברות מחדש…"))
        ),

        /* glanceable vitals — partial */
        R.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--sp-4)" }},
          R.createElement(VitalCard, { name: "דופק", abbr: "HR", value: v.hr, unit: "bpm", level: sevHR(v.hr), trend: "up", size: "station", stale, lastSeen: "12:04:38" }),
          R.createElement(VitalCard, { name: "ריווי חמצן", abbr: "SpO₂", value: v.spo2, unit: "%", level: sevSpO2(v.spo2), trend: "down", size: "station", stale, lastSeen: "12:04:38" }),
          R.createElement(WithheldTile, { item: D.withheld[0] })
        ),

        /* task / tempo panel - Double Bezel Architecture */
        mode === "base"
          ? R.createElement("div", { style: {
              background: "var(--surface-base)", border: "var(--border-w) solid var(--border-subtle)", borderRadius: "var(--radius-xl)",
              padding: "6px", boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column",
            }},
              R.createElement("div", { style: {
                background: "var(--surface-card)", border: "var(--border-w) solid var(--border-default)", borderRadius: "calc(var(--radius-xl) - 6px)",
                padding: "var(--sp-6)", display: "flex", flexDirection: "column", gap: "var(--sp-4)",
                boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)",
              }},
                R.createElement("div", { style: { display: "flex", alignItems: "center", gap: "var(--sp-3)" }},
                  R.createElement("span", { className: "vc-caps", style: { color: "var(--text-muted)", fontWeight: "var(--fw-semibold)" }}, "שלב " + (step + 1) + " מתוך " + D.steps.length),
                  R.createElement("span", { style: { marginInlineStart: "auto", display: "inline-flex", alignItems: "center", gap: "var(--sp-1)", fontSize: "var(--fs-xs)", color: "var(--text-muted)" }},
                    R.createElement(Icon, { name: "pause", size: 14 }), "השעון קפוא — בצע כשמוכן")
                ),
                R.createElement("div", { style: { fontSize: "var(--fs-display)", fontWeight: 700, color: "var(--text-primary)", lineHeight: "var(--lh-snug)", letterSpacing: "var(--ls-tight)" }}, D.steps[step]),
                R.createElement("div", { style: { display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", marginTop: "var(--sp-1)" }},
                  R.createElement(Button, { variant: "primary", size: "lg", disabled: stale || step >= D.steps.length - 1,
                    iconStart: R.createElement(Icon, { name: "check", size: 20 }), onClick: () => setStep((s) => Math.min(D.steps.length - 1, s + 1)) }, "בצע והמשך"),
                  R.createElement(Button, { variant: "secondary", size: "lg", disabled: stale, iconStart: R.createElement(Icon, { name: "megaphone", size: 20 }) }, "בקש מידע מהצוות")
                )
              )
            )
          : R.createElement("div", { style: {
              background: "var(--surface-base)", border: "var(--border-w) solid var(--border-subtle)", borderRadius: "var(--radius-xl)",
              padding: "6px", boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column",
            }},
              R.createElement("div", { style: {
                background: "var(--surface-card)", border: "var(--border-w) solid var(--border-default)", borderRadius: "calc(var(--radius-xl) - 6px)",
                padding: "var(--sp-6)", display: "flex", alignItems: "center", gap: "var(--sp-4)", flexWrap: "wrap",
                boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)",
              }},
                R.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2 }},
                  R.createElement("span", { className: "vc-caps", style: { color: "var(--text-muted)", fontWeight: "var(--fw-semibold)" }}, "זמן אמת · המטופל מתדרדר"),
                  R.createElement("span", { style: { fontSize: "var(--fs-body)", color: "var(--text-secondary)" }}, "פעל ותקשר בזמן אמת — אין השהיה בין פעולות")),
                R.createElement("div", { style: { marginInlineStart: "auto", display: "flex", gap: "var(--sp-3)" }},
                  R.createElement(Button, { variant: "primary", size: "lg", disabled: stale, iconStart: R.createElement(Icon, { name: "megaphone", size: 20 }) }, "קרא מדד בקול"),
                  R.createElement(Button, { variant: "secondary", size: "lg", disabled: stale, iconStart: R.createElement(Icon, { name: "hand", size: 20 }) }, "בקש עזרה"))
              )
            )
      )
    );
  }

  window.VCKit = window.VCKit || {};
  window.VCKit.Station = Station;
})();
