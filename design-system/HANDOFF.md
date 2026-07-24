# Handoff: VetCrew Design System (Phase 2 — Dark Instrument)

> Imported verbatim from the Claude Design project `ad98cb77-d76d-4f65-9f2e-ec5b870a371e`
> on 2026-07-24 via DesignSync. Source of truth for design remains that project;
> re-import when the open items below land. See `IMPORT.md` for import scope and
> known inconsistencies found during import.

## Overview
VetCrew is a simulation-based crew trainer / readiness-assessment tool for veterinary ER-ICU staff. **Tablet-first, Hebrew-first (RTL).** One design system expressed as three distinct registers: a reflective **AAR replay viewer**, a dense **instructor console**, and a calm, glanceable **trainee station** — plus a **base-rung task surface** (work software) that sits beside a **patient monitor** (instrument).

## About the design files
The files in the design project are **design references created in HTML/JSX** — prototypes of intended look and behaviour, not production code to ship. The task is to **recreate them in the target codebase's environment** (React + CSS variables map directly; a Tailwind theme can be generated from the tokens) using its established patterns.

## Fidelity
**High-fidelity.** Final colours, typography, spacing, motion, and interactions are specified. Recreate pixel-accurately. Exceptions are listed under "Open items".

## Design tokens (source of truth)
All tokens are CSS custom properties. Entry point: `styles.css` (an `@import` list). Files: `tokens/color.css` (review-surface semantics + light/dark), `tokens/instrument.css` (Dark Instrument), `tokens/task.css` (work-software), `tokens/typography.css`, `tokens/space.css`, `tokens/shape.css`, `tokens/motion.css`.

### Theme / direction
- **Dark Instrument** — the three simulation surfaces (patient monitor, trainee station, instructor console) are **dark-only**, base `#0A0F18`.
- **Light** — the **AAR/debrief only** (manager reads in a lit office; job is trust, not immersion). AAR light bg `#F9FAFB`.
- **Action accent** `#008080` (teal) — interactive controls **only**; never a vital, never an alarm.

### Layer A — channel identity (always on, NEVER severity)
A channel keeps its hue at every value. `--ch-hr` green `#00FF66` · `--ch-spo2` cyan `#00CCFF` · `--ch-etco2` yellow `#FFCC00` · `--ch-rr` yellow `#FFCC00` · `--ch-art` red `#FF3B30` · NIBP/Temp white `#FFFFFF`. Verified against the uMEC12 Vet reference photo.

**Channel-identity rule:** never identify a channel by hue alone — persistent text label + fixed lane position in every view, at every size. No compact variant may drop the label. (Under deuteranopia green/yellow/red converge; cyan + white hold.)

### Layer B — alarm / severity (rides on top, IEC 60601-1-8)
Canonical **4-level** model is the source of truth (also drives the `SeverityChip` review-surface ramp):

| Level | Colour | Shape | Motion | Monitor treatment |
|---|---|---|---|---|
| normal | none | — | none | none (quiet) |
| watch / low-advisory | `#00CCFF` | dot | none | advisory |
| elevated / medium-urgent | `#FFCC00` | triangle | flash-slow | **caution** |
| critical / high | `#FF3333` | octagon | pulse-fast | **critical** |

Review-surface ramp mapping: `watch`+`elevated` → monitor **caution**; `critical` → **critical**.

**Alarm-placement rule:** alarm colour may appear ONLY in: device LED strip · full-screen edge frame · alarm message bar · flashing of the affected value. **Never** as a static fill beside a channel readout (that merges Layers A and B). Colour-blind safety for severity comes from this layer (flash + frame + LED + shape + text), never hue.

### Type
Hebrew UI: **IBM Plex Sans Hebrew**. Metrics/numerals: **bold, condensed, neutral tabular sans** matching the device — explicitly NOT a stylised sci-fi mono. Tabular figures mandatory so ticking values don't jitter. Scale: `--fs-vital 56` down to `--fs-xs 13` (nothing smaller). *(See `IMPORT.md` — the token file has not yet caught up with this decision.)*

### Spacing / shape / motion
4px base spacing scale (`--sp-1`=4 … `--sp-16`=64). Touch floor `--touch-min 44px`; controls 48px default, 56px large. Radii 4/6/10/14/20/pill. Elevation 4 steps (restrained; dark leans on borders). Motion: `--dur-fast 130 / base 200 / slow 320 / tick 260`, `--ease-standard cubic-bezier(.2,0,0,1)` (no bounce). All durations → 0 under `prefers-reduced-motion`.

### Zone-scoped hatch (disambiguated by zone, not hue)
Diagonal matte hatch means **stale/reconnecting data** in the monitor zone and **locked-by-another-user** in the task panel. Zone containment keeps them distinct — do not let either escape its zone.

## Components (namespace `window.DesignSystem_ad98cb`)
Each has `.jsx` + `.d.ts` (props) + `.prompt.md` (usage) + a `@dsCard` preview HTML, in the design project.

- **controls/** `Button` (primary/secondary/ghost/danger; sm40/md48/lg56) · `IconButton` (≥44px, required `label`) · `InjectionTrigger` (fast-fire, no confirm; armed/fired) · `AntsRating` (1–5, redundantly coded, one-click evidence link) · `TaskChip` (base-rung: codes do/report/timed/approval × states available/in_progress/done/error/locked/released; matte, contained; never computes an answer).
- **status/** `SeverityChip` (color+shape+label) · `SeverityGlyph` (dot/ring/triangle/octagon) · `ConnectionPill` (live/paused/offline/reconnecting) · `SessionState` (FSM: draft→briefing→running⇄paused→debrief→scored→archived) · `severity.js` (level model).
- **vitals/** `VitalCard` (severity-coded, tabular tick flash, never-stale reconnecting state with a11y-announced staleness).
- **monitor/** `PatientMonitor` — uMEC12-Vet-style: 5 sweep-rendered lanes (ECG I/II, Pleth, Art, CO₂; cursor erases+rewrites, never scrolls), rich right-column readouts + sub-values, Temp/C.O./NIBP band, side button column + rotary knob, heart-pulse indicator, LED strip + full-screen alarm frame. **Renders `dir="ltr"`** (device is LTR — waveforms left, values right) even though the app is Hebrew RTL; Hebrew aria/labels retained. **Intentional island, not a bug.** No real brand marks (neutral "VET MONITOR / VM-12").
- **timeline/** `TimelineScrubber` (AAR spine; RTL playhead, shape-coded markers, role lanes, click-to-seek = score→source-event).

## Screens / kits
- **aar/** AAR replay viewer (light-capable): timeline scrubber, per-role partial views, event-linked ANTS + technical scores.
- **instructor/** dense control console: session FSM + clock, live monitor, connected-role pills, fast-fire injection grid, confirm only on destructive (end session).
- **trainee/** calm partial-view station: base-procedural + real-time modalities, withheld-info tiles, never-stale reconnecting.
- **base-rung/split-screen.html** the zone-coexistence proof: matte task panel + glowing monitor, hard containment, one permitted crossing (critical full-screen frame).

## Interactions & behaviour
- Injections fire immediately (no confirm); destructive actions use confirm/hold. Scores link one click to their source events (non-negotiable traceability).
- Monitor sweep via canvas + rAF; value flash on change without relayout. Reconnecting freezes + hatches + desaturates + announces staleness — never mistakable for live.
- Base-rung constraints that must not soften: the system **never computes** mg→ml or drops/min; wrong values at Tier 2+ are **permitted and logged, never blocked** (silent failure is the measurement).

## Open items (not yet built, in the design project)
Canonical-severity token wiring, medication **route** as a 3rd scored dimension (F1), **ABC-before-access** ordering mechanic (F2), the three calculation interactions + Tier 1/Tier 4 + SunTech Vet20 + base-rung debrief, alarm audio, restyle the three original kits to Dark Instrument, numeral polish.
