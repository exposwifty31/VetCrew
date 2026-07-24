# Design system import — provenance, scope, and findings

**Imported:** 2026-07-24 via the `DesignSync` tool
**Source:** Claude Design project `ad98cb77-d76d-4f65-9f2e-ec5b870a371e` ("Design System", owner Dan, `PROJECT_TYPE_DESIGN_SYSTEM`)
**Direction:** read-only pull (design → repo). Nothing was written back.

---

## What was imported, and why only this

| Imported | Rationale |
|---|---|
| `styles.css` | The entry point consumers link. |
| `tokens/*.css` (8 files) | **The only part that transfers verbatim.** CSS custom properties map 1:1 into the real app; a Tailwind theme can be generated from them. |
| `HANDOFF.md` | The design→code contract. |

**Deliberately NOT imported:** `components/**/*.jsx`, `ui_kits/**`, `guidelines/*.html`, `_ds_bundle.js`.

That is not an omission — the handoff document itself instructs it:

> *"The files in this project are design references created in HTML/JSX — prototypes of intended look and behaviour, not production code to ship. The task is to recreate them in the target codebase's environment."*

Copying the JSX into the repo would import prototype code as if it were production, which the design system explicitly says not to do. The component **contracts** (`.d.ts`) and **usage notes** (`.prompt.md`) stay in the design project and should be read there when each component is built. `uploads/FOTO2_uMEC-12-vet-scaled.webp` is the device reference photo and stays there too.

---

## Verification performed at import

**✅ Channel colours are correct.** `tokens/instrument.css` carries the uMEC12-verified mapping in full:

```
--ch-hr #00ff66 · --ch-spo2 #00ccff · --ch-rr #ffcc00
--ch-etco2 #ffcc00 · --ch-art #ff3b30 · --ch-nibp/--ch-temp #ffffff
```

This matters because a circulated audit document proposed reverting SpO₂ to yellow and EtCO₂ to lilac. **That regression is not in the system and must not be applied.** The correct values are also independently implemented and visually verified in `spikes/webxr/src/monitor.js`.

**✅ Layer separation is real at the token level.** Task-surface colours are deliberately **matte** (`--task-do #c1941d`, `--task-timed #2f9e5b`, `--task-approval #c33a2b`) against the monitor's **neon** channels (`#ffcc00`, `#00ff66`, `#ff3b30`). Saturation separates the two systems even where hue families overlap — a stronger mechanism than hue-avoidance alone.

**✅ Reduced-motion preserves safety.** `instrument.css` holds alarms **steady-on** under `prefers-reduced-motion` rather than removing them, so a motion-sensitivity preference never suppresses a clinical alarm.

---

## Known inconsistencies found during import

These are recorded rather than silently fixed, because the design project is the source of truth and should be corrected there first, then re-imported.

**1. Numeral typeface — token contradicts the decision.**
`tokens/typography.css` still assigns `--font-mono: "IBM Plex Mono"` for *"Numbers/vitals/timestamps/code"*, and the `.vc-num` helper applies it. But `HANDOFF.md` and the rebuilt `PatientMonitor` both specify **bold, condensed, neutral tabular sans** for metrics. The monitor component moved; the token did not.

*Consequence:* any surface using `.vc-num` for a vital renders mono while the monitor renders sans — inconsistent numerals across surfaces.

*Suggested fix:* add a distinct `--font-metric` for device numerals and keep `--font-mono` for timestamps/code/offsets (where mono is genuinely right). Point `PatientMonitor` and `VitalCard` at `--font-metric`.

**2. Stale direction comment.**
`tokens/color.css` header still reads `Direction: "Instrument Calm"`, superseded by **Dark Instrument**. The README was updated; this comment was missed. Cosmetic, but it is the first thing a developer reads in the colour file.

---

## Re-import

Re-run when the design project's open items land (route scoring, ABC ordering, the calculation interactions, Tier 1/Tier 4, SunTech Vet20, debrief, kit restyle). `DesignSync` can also write **back** to the project — that direction is unused so far and should stay deliberate, not incidental.
