/* VetCrew — Instructor console. Register: dense-but-controlled, high-pressure.
   Fast-fire injections (no confirm); ONLY destructive actions confirm.
   Exposes window.VCKit.Console. */
(function () {
  const R = window.React;
  const DS = window.DesignSystem_ad98cb;
  const { SessionState, ConnectionPill, VitalCard, InjectionTrigger, Button, IconButton, SeverityChip } = DS;
  const Icon = window.VC.Icon;
  const D = window.VCINS_DATA;
  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const sevHR = (v) => v >= 192 ? "critical" : v >= 176 ? "elevated" : v >= 166 ? "watch" : "normal";
  const sevSpO2 = (v) => v < 90 ? "critical" : v < 92 ? "elevated" : v < 95 ? "watch" : "normal";
  const sevRR = (v) => v >= 52 ? "elevated" : v >= 46 ? "watch" : "normal";

  function ConfirmDialog({ onCancel, onConfirm }) {
    return R.createElement("div", { role: "dialog", "aria-modal": "true", style: {
      position: "fixed", inset: 0, background: "rgba(7, 13, 16, 0.65)",
      backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "var(--sp-6)",
    }},
      R.createElement("div", { style: {
        padding: "6px", background: "var(--surface-base)", border: "var(--border-w) solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-overlay)", width: "100%", maxWidth: 440,
      }},
        R.createElement("div", { style: {
          background: "var(--surface-overlay)", borderRadius: "calc(var(--radius-xl) - 6px)", padding: "var(--sp-6)",
          display: "flex", flexDirection: "column", gap: "var(--sp-4)", border: "var(--border-w) solid var(--border-default)",
          boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)",
        }},
          R.createElement("div", { style: { display: "flex", alignItems: "center", gap: "var(--sp-3)" }},
            R.createElement("span", { style: { color: "var(--text-critical)", display: "inline-flex" }}, R.createElement(Icon, { name: "octagon-alert", size: 26 })),
            R.createElement("h2", { style: { margin: 0, fontSize: "var(--fs-h2)", color: "var(--text-primary)", fontWeight: "var(--fw-semibold)", letterSpacing: "var(--ls-tight)" }}, "לסיים את הסשן?")
          ),
          R.createElement("p", { style: { margin: 0, fontSize: "var(--fs-body)", color: "var(--text-secondary)", lineHeight: "var(--lh-normal)" }},
            "פעולה זו עוצרת את הסימולציה לכל התחנות ומעבירה לתחקיר. לא ניתן לחזור אחורה."),
          R.createElement("div", { style: { display: "flex", gap: "var(--sp-3)", justifyContent: "flex-start", marginTop: "var(--sp-2)" }},
            R.createElement(Button, { variant: "danger", onClick: onConfirm }, "סיים והעבר לתחקיר"),
            R.createElement(Button, { variant: "ghost", onClick: onCancel }, "המשך סשן")
          )
        )
      )
    );
  }

  function RoleStatus({ role }) {
    return R.createElement("div", { style: {
      display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "4px",
      background: "var(--surface-base)", border: "var(--border-w) solid var(--border-subtle)", borderRadius: "var(--radius-md)",
      opacity: role.conn === "reconnecting" ? 0.9 : 1,
    }},
      R.createElement("div", { style: {
        display: "flex", alignItems: "center", gap: "var(--sp-3)", padding: "var(--sp-2) var(--sp-3)",
        background: "var(--surface-card)", border: "var(--border-w) solid var(--border-default)", borderRadius: "calc(var(--radius-md) - 4px)",
        flex: 1, minWidth: 0,
      }},
        R.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }},
          R.createElement("span", { style: { fontWeight: 700, fontSize: "var(--fs-sm)", color: "var(--text-primary)" }}, role.label),
          R.createElement("span", { style: { fontSize: "var(--fs-xs)", color: "var(--text-secondary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }},
            role.who + (role.conn === "reconnecting" ? "" : " · " + role.task))
        ),
        R.createElement(ConnectionPill, { state: role.conn })
      )
    );
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

    R.useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
    R.useEffect(() => {
      if (paused || ended) return;
      const id = setInterval(() => {
        setElapsed((e) => e + 1);
        setVitals((v) => ({
          hr: Math.max(140, Math.min(200, v.hr + (Math.random() > 0.45 ? 1 : -1))),
          spo2: Math.max(88, Math.min(97, v.spo2 + (Math.random() > 0.5 ? 0 : (Math.random() > 0.5 ? 1 : -1)))),
          rr: Math.max(28, Math.min(54, v.rr + (Math.random() > 0.5 ? 1 : -1))),
          temp: v.temp,
        }));
      }, 1000);
      return () => clearInterval(id);
    }, [paused, ended]);

    function fire(id, t) { setFired((f) => ({ ...f, [id]: "T+" + fmt(elapsed) })); }

    return R.createElement("div", { dir: "rtl", style: {
      height: "100vh", background: "var(--surface-base)", color: "var(--text-primary)", fontFamily: "var(--font-ui)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }},
      /* command bar */
      R.createElement("header", { style: {
        display: "flex", alignItems: "center", gap: "var(--sp-4)", padding: "var(--sp-3) var(--sp-5)",
        background: "var(--surface-card)", borderBottom: "var(--border-w-strong) solid var(--border-default)",
        boxShadow: "var(--shadow-card)", zIndex: 10,
      }},
        R.createElement("div", { style: { fontWeight: 800, fontSize: "var(--fs-h3)", letterSpacing: "var(--ls-tight)" }}, "Vet", R.createElement("span", { style: { color: "var(--action)" }}, "Crew")),
        R.createElement(SessionState, { state: ended ? "debrief" : (paused ? "paused" : "running"), elapsed: fmt(elapsed) }),
        R.createElement("span", { style: { fontSize: "var(--fs-sm)", color: "var(--text-secondary)", fontWeight: "var(--fw-medium)" }}, D.session.title + " · " + D.session.engine),
        R.createElement("div", { style: { marginInlineStart: "auto", display: "flex", alignItems: "center", gap: "var(--sp-3)" }},
          R.createElement(Button, { variant: paused ? "primary" : "secondary", size: "lg",
            iconStart: R.createElement(Icon, { name: paused ? "play" : "pause", size: 20 }),
            onClick: () => setPaused((p) => !p) }, paused ? "המשך" : "השהה"),
          R.createElement(Button, { variant: "danger", size: "lg", iconStart: R.createElement(Icon, { name: "square", size: 18 }), onClick: () => setConfirm(true) }, "סיים סשן"),
          R.createElement(IconButton, { label: dark ? "מצב יום" : "מצב לילה", onClick: () => setDark((v) => !v), icon: R.createElement(Icon, { name: dark ? "sun" : "moon", size: 20 }) })
        )
      ),

      /* main: patient + roles | injections */
      R.createElement("div", { style: { flex: 1, display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: "var(--sp-5)", padding: "var(--sp-5)", minHeight: 0, overflow: "auto" }},
        /* left: live monitor + roles */
        R.createElement("section", { style: { display: "flex", flexDirection: "column", gap: "var(--sp-4)", minWidth: 0 }},
          R.createElement("div", { style: { display: "flex", alignItems: "center", gap: "var(--sp-3)" }},
            R.createElement("span", { className: "vc-caps", style: { color: "var(--text-muted)", fontWeight: "var(--fw-semibold)" }}, "מוניטור מטופל · חי"),
            paused && R.createElement(SeverityChip, { level: "normal", appearance: "outline", size: "sm", lang: "he", showLabel: true }),
            R.createElement("span", { style: { marginInlineStart: "auto" }}, R.createElement(ConnectionPill, { state: paused ? "paused" : "live" }))
          ),
          R.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-4)" }},
            R.createElement(VitalCard, { name: "דופק", abbr: "HR", value: vitals.hr, unit: "bpm", level: sevHR(vitals.hr), trend: "up", size: "station", stale: false }),
            R.createElement(VitalCard, { name: "ריווי חמצן", abbr: "SpO₂", value: vitals.spo2, unit: "%", level: sevSpO2(vitals.spo2), trend: "down", size: "station" }),
            R.createElement(VitalCard, { name: "נשימות", abbr: "RR", value: vitals.rr, unit: "/min", level: sevRR(vitals.rr), trend: "up", size: "station" }),
            R.createElement(VitalCard, { name: "חום", abbr: "TEMP", value: vitals.temp.toFixed(1), unit: "°C", level: "normal", trend: "flat", size: "station" })
          ),
          R.createElement("div", { className: "vc-caps", style: { color: "var(--text-muted)", marginTop: "var(--sp-2)", fontWeight: "var(--fw-semibold)" }}, "תחנות מחוברות"),
          R.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "var(--sp-2)" }},
            D.roles.map((r) => R.createElement(RoleStatus, { key: r.id, role: r }))
          )
        ),

        /* right: injections - Double Bezel Architecture */
        R.createElement("section", { style: {
          display: "flex", padding: "6px", background: "var(--surface-base)", border: "var(--border-w) solid var(--border-subtle)",
          borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-card)", minWidth: 0,
        }},
          R.createElement("div", { style: {
            display: "flex", flexDirection: "column", gap: "var(--sp-3)", minWidth: 0, flex: 1,
            background: "var(--surface-card)", border: "var(--border-w) solid var(--border-default)",
            borderRadius: "calc(var(--radius-xl) - 6px)", padding: "var(--sp-4)", overflow: "auto",
            boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.05)",
          }},
            R.createElement("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: "var(--border-w) solid var(--border-subtle)", paddingBottom: "var(--sp-2)" }},
              R.createElement("h2", { style: { margin: 0, fontSize: "var(--fs-h3)", color: "var(--text-primary)", fontWeight: "var(--fw-bold)", letterSpacing: "var(--ls-tight)" }}, "הזרקות אירועים"),
              R.createElement("span", { style: { fontSize: "var(--fs-xs)", color: "var(--text-muted)", fontWeight: "var(--fw-medium)" }}, "לחיצה = הזרקה מיידית")
            ),
            shockAvailable && R.createElement("div", { style: {
              border: "var(--border-w-strong) solid var(--border-elevated-subtle)", borderRadius: "var(--radius-lg)",
              background: "var(--bg-elevated-subtle)", padding: "var(--sp-3)", boxShadow: "var(--shadow-glow-elevated)",
            }},
              R.createElement("div", { style: { display: "flex", alignItems: "center", gap: "var(--sp-2)", padding: "0 var(--sp-1) var(--sp-2)" }},
                R.createElement(Icon, { name: "triangle-alert", size: 15, style: { color: "var(--text-elevated)" } }),
                R.createElement("span", { style: { fontSize: "var(--fs-xs)", fontWeight: 700, color: "var(--text-elevated)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase" }}, "נפתח לפי תנאי")
              ),
              R.createElement(InjectionTrigger, { title: D.conditional.title, description: D.conditional.desc, kind: D.conditional.kind,
                icon: R.createElement(Icon, { name: D.conditional.icon, size: 22 }), fired: !!fired[D.conditional.id], firedAt: fired[D.conditional.id],
                onFire: () => fire(D.conditional.id) })
            ),
            R.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "var(--sp-3)" }},
              D.injections.map((inj) => R.createElement(InjectionTrigger, {
                key: inj.id, title: inj.title, description: inj.desc, kind: inj.kind,
                icon: R.createElement(Icon, { name: inj.icon, size: 22 }), fired: !!fired[inj.id], firedAt: fired[inj.id],
                onFire: () => fire(inj.id),
              }))
            )
          )
        )
      ),

      confirm && R.createElement(ConfirmDialog, { onCancel: () => setConfirm(false), onConfirm: () => { setConfirm(false); setEnded(true); setPaused(true); } })
    );
  }

  window.VCKit = window.VCKit || {};
  window.VCKit.Console = Console;
})();
