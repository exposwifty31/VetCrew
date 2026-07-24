# Base Rung — Scenario #1 SRS (the v1 MVP)

**Status:** draft for review · **Date:** 2026-07-24
**Purpose:** the single consolidated, buildable specification for the first scenario — the MVP the whole pipeline exists to produce. Until now this was spread across `CLAUDE.md §5`, `mountain-decision-memo.md`, `design-system/HANDOFF.md`, and the doctrine skills; this document reconciles them into one enumerated feature list with pass/fail criteria, so development doesn't begin from five documents held in the head. (Closes audit finding F3.)

**Scope discipline:** this specifies **one scenario, one role, technical competence, no crew, no crash.** Everything a later tier or the summit adds is listed under §9 Non-goals. If a requirement here implies real-time deterioration, multi-role, or CPR, it is out of scope — flag it.

---

## 1. What Scenario #1 is

A single veterinary technician runs a slice of a shift on **one stable, hospitalised patient**, completing a sequence of everyday technical tasks presented through a SmartFlow-style task panel, beside a live patient monitor. **Species is a scenario parameter (dog or cat), and both are authored as interchangeable instances** with species-specific reference ranges (OD-2) — the technician must know both equally, so the scenario varies species across runs and the monitor's ranges follow the patient. The task *structure* is identical for either species. The engine is **deliberate/stepped (Engine Alpha)** — the clock does not punish; the trainee works task by task. The session produces a **replayable, role-attributed, scored record** an instructor rates and a department manager can review as onboarding evidence.

It exercises the new-technician competencies A–F from the floor test (§3). It does **not** exercise G (CPR/resuscitation) — that is summit content.

**One thing it must do that nothing else on the market does:** score not just *whether* the task was done but *the decision* — route of administration, tube choice, and whether the technician escalates an abnormality instead of proceeding. That decision layer is the product; see §4 and `CLAUDE.md §2.1, §2.7`.

## 2. Actors

| Actor | Role in Scenario #1 |
|---|---|
| **Technician (trainee)** | The single role station. Reads the monitor, performs tasks, enters values, selects routes/tubes, escalates. Sees a genuinely partial view (only what a technician on shift would know). |
| **Instructor** | Runs the session; can pause; injects the one abnormality (§4 task 7). Rates the applicable ANTS domains **post-hoc from the AAR replay** (OD-4), not live — which also makes the recorded session re-scorable by additional raters later (`CLAUDE.md §6.3`). Formative only — no hiring verdict (`CLAUDE.md §2.2`). |
| **Engine (authoritative)** | Deterministic reducer over the event log. Presents tasks, records every action, computes technical pass/fail from events, never computes the trainee's answers for them. |

## 3. Competency coverage (floor test A–F → tasks)

| # | Competency (from the floor test) | Covered by task |
|---|---|---|
| A | TPR — know min/max respiration, pulse, temp (dog & cat) | T1 |
| B | Blood pressure — know min/max (dog & cat) | T2 |
| C | Blood draw — tube types (Serum / EDTA / Citrate / Heparin) + technique | T4 |
| D | IV catheter placement + correct bandaging | T5 |
| E | Fluids — types, regular line vs burette | T6 |
| F | Fluids to a pump; if no pump, calculate drops/min | T6 |
| F′ | Medication mg → ml (fixed concentrations) | T3 |
| — | Decision/critical-eye: recognise an abnormality, escalate not proceed | T7 |
| G | Resuscitation steps (CPR) | **Deferred to summit — §9** |

## 4. The task sequence (enumerated)

Seven tasks, presented in order. Each uses a `TaskChip` code (do / report / timed / approval) and moves through the lifecycle states `available → in_progress → done | error` (locked/released are multi-user, not used in solo Scenario #1). Every task's outcome is one or more **role-attributed events** in the log; every score links back to them (`CLAUDE.md §2.3, §8`).

> **Clinical values below are placeholders pending sign-off (§2.5).** Ranges, concentrations, and contraindications must be reviewed and stamped `clinically_reviewed` before they score anyone. They are shown here to specify *structure*, not to assert clinical truth.

### T1 — Initial TPR · code `do` · competency A
- **Interaction:** trainee reads HR and RR from the monitor and measures temp; enters three values into the task.
- **Format enforcement:** a value in the wrong medical format (e.g. `3.8` where `38.5` is meant) turns the field red, shakes, and blocks submission — teaches notation. (Format block ≠ answer block; see §4 rules.)
- **Scored:** each value within the correct species range (pass) or outside (logged, fail). Correct format required to submit.
- **Edge cases:** value plausible but wrong (e.g. transposed digits) → accepted, scored wrong, logged. Empty submit → blocked.

### T2 — NIBP measurement · code `timed` · competency B
- **Interaction:** trainee triggers NIBP (SunTech surface); reads SYS/DIA/**MAP**.
- **Window:** the window is **scenario-phase, turn-based — not wall-clock** (OD-1, decided). The task must be done in the correct scenario phase; the trainee is never under real-clock pressure in the base rung. Scored on being taken in the correct phase and MAP read/entered correctly.
- **Scored:** in-window (pass/fail) + value correctness.

### T3 — Medication administration · code `report` · competency F′ + route
- **The three scored dimensions — drug · dose · route** (`TaskChip` route selector already built, F1):
  - **drug** — named in the task (context).
  - **dose** — task states mg; trainee computes **ml** themselves (never computed for them). Wrong volume shown invalid, never auto-corrected.
  - **route** — trainee selects IV/IM/SC/PO; never pre-filled, never hinted. Contraindicated route is selectable, **logged as a critical error, never blocked**. Correct volume by wrong route is a **FAIL, not partial credit**.
- **Reference concentrations (pending sign-off):** Cefazolin 100 mg/ml · Augmentin 50 mg/ml · NAC 200 mg/ml. Worked: 250 mg Cefazolin → 2.5 ml.
- **Scored:** ml correctness AND route correctness, **separately**.
- **Edge cases:** right ml + wrong route → fail on route (this is the diphenhydramine-IV class of fatal error). Right route + wrong ml → fail on dose. Which routes are contraindicated is scenario data, sign-off-gated.

### T4 — Blood draw · code `report` · competency C
- **Interaction:** task requests a panel (e.g. CBC + biochemistry); trainee selects the correct tube(s) from Serum / EDTA / Citrate / Heparin (by standard cap colour) and draws.
- **Scored:** correct tube for the test (CBC → EDTA; biochemistry → Serum). Wrong tube **permitted and logged, never blocked** — silent failure is the measurement.

### T5 — IV catheter + bandaging · code `do` · competency D
- **Interaction:** an ordered step sequence the trainee assembles: shave → disinfect → insert → secure → bandage.
- **Scored:** correct order. Out-of-order (e.g. disinfect before shave) is the failure being tested — the interaction must let the wrong order be expressed.

### T6 — Fluids setup · code `do` · competency E + F
- **Interaction:** choose **regular line vs burette** (burette/microdrip = 60 drops/ml, for small patients / precise dosing). If the instructor set **"no pump available,"** trainee enters **drops/min** (never computed).
- **Reference:** 45 ml/hr on a 60 drops/ml burette → 45 drops/min. The 15-vs-45 (3×) class of error must be catchable.
- **Consequence visible:** the fluid rate shown on the patient side reflects the entered number — a wrong number has a visible effect.
- **Scored:** correct device choice + correct drops/min.

### T7 — Recognise & escalate · code `approval` · decision/critical-eye
- **Setup:** the instructor injects one abnormality during the sequence: **low HR + high BP** (bradycardia with hypertension) — a "catchy," recognisable pattern a technician should notice and escalate rather than treat (OD-3, decided). *Clinical-review-gated (§2.5): the specific HR/BP values, the admitting context that makes this pattern appear, and confirmation that it is escalate-appropriate (not a technician-treatable event) must be reviewed and stamped before it scores anyone. The pattern is clinically coherent — e.g. it is associated with raised intracranial pressure, and with alpha-2 agonist sedation (dexmedetomidine/medetomidine), both common — but the reviewer confirms the authored specifics, not this note.*
- **Interaction:** the correct action is to **notice it and escalate** — the task is `approval`-locked; the only permitted action is **call doctor / senior**. Proceeding as if normal, or missing it, is the failure.
- **Scored:** noticed (yes/no, and time-to-notice as a directional metric), escalated correctly (yes/no). This is the seed of the QA-trap / critical-eye competency; the full "refuse a wrong order someone else logged" variant is **Tier-4, deferred (§9)**.

## 5. Rules that must not soften (these ARE the assessment)

1. **Never compute the trainee's answer** — not mg→ml, not drops/min. The arithmetic is the skill.
2. **Never block a wrong answer** (except pure *format* enforcement in T1). Wrong dose, wrong route, wrong tube, wrong order → permitted, logged, scored. A UI that prevents the mistake destroys the instrument.
3. **Route is scored separately from dose;** correct-by-wrong-route is a fail.
4. **Escalation is a first-class action** — as prominent as completing a task, never buried.
5. **Every score links to its source event(s)** — if a change would make a score untraceable, stop (`CLAUDE.md §8`).

## 6. Scoring model

Two axes stored separately (`CLAUDE.md §4`):

- **Technical (checklist):** per-task pass/fail from the event log, deterministic, computed by the engine. Aggregated to an overall technical result. Fully auto-scored and traceable.
- **Non-technical (ANTS), formative only:** at the base rung, only the **solo-observable** domains apply — **Situation Awareness** (did they notice T7's abnormality, catch a format slip) and **Decision-Making** (escalate vs. proceed; route/tube choices). **Team-working and Communication are N/A in a solo scenario** and are not scored here — they belong at the summit (`CLAUDE.md §2.4`). The instructor rates the two applicable domains 1–5 **post-hoc from the AAR replay** (OD-4), each tied to specific events. **Per-domain scores are directional; no consequential verdict** — a single rater is formative feedback only (`CLAUDE.md §2.2`, needs 3 raters for anything consequential); scoring from the recording keeps the door open to that later multi-rater pass.

**Withhold-the-verdict:** Scenario #1 produces evidence + formative feedback, never a "ready / not ready" output (`CLAUDE.md §6.2`).

## 7. Output — the record the manager reviews

- **AAR replay:** timeline of the session; per-task events; the instructor's ANTS ratings, each one click from the events that justify it (score→source-event traceability).
- **Expected-vs-actual per scored item:** task, expected value/route/tube/order, what the trainee did, verdict. (e.g. "Cefazolin: expected 2.5 ml IV · entered 2.5 ml SC · FAIL — wrong route.")
- **Directional timings** where captured (time-to-notice in T7) against a target.
- Role-attributed, replayable, and **stamped with the scenario version and `clinically_reviewed` state.**

## 8. State, determinism, data

- **Session FSM** (`CLAUDE.md §4`): `draft → briefing → running ⇄ paused → debrief → scored → archived`. Explicit on both ends.
- **Task lifecycle:** `available → in_progress → done | error` (Scenario #1 solo; `locked/released` reserved for multi-user).
- **Determinism (non-negotiable):** pure reducer `(state, event) => state`; no `Date.now`/`Math.random`/I/O inside it; time via tick events; randomness via seeded PRNG stored per session. A **determinism golden test** (same seed + events → byte-identical state) is a hard gate, part of build step 2 — not a later addition (`CLAUDE.md §8`).
- **Schema requirements present from the first scored session:**
  - append-only **event log** (source of truth), tenant-scoped.
  - **Clinical sign-off record** — a scenario cannot score a real person unless every clinical claim it contains is signed off (audit F2). Recorded **per clinical claim** (each reference range, drug concentration, route contraindication, and the T7 abnormality), not just per scenario:
    - `reviewed` (bool) · `reviewed_against` (the **named published standard/source** the claim was checked against — e.g. AVMA CVTEA skills list, RECOVER guideline, the drug's label concentration) · `reviewer_role` + `reviewer_credential` (a **name** is attached at review time — not required by this spec) · `review_date`.
    - **`review_tier`**: `formative` (base rung — single credentialed reviewer checking against a standard is sufficient) or `consequential` (any hiring/readiness output — requires a DVM/DACVECC co-signer OR the recorded multi-rater path per §6.2–6.3).
    - scenario-level **`clinically_reviewed`** is true only when *all* its claims are signed at the tier the scenario is used at; **`scenario_version`** stamped on every score.
  - **time-in-training** captured on the session — the axis the whole progression is measured against; cannot be backfilled (`CLAUDE.md §4`).
  - per-event: role attribution, timestamp/seq, task id, action, and the values entered (for expected-vs-actual).

### Clinical review & sign-off (method + risks)

- **Check against a standard, not opinion.** Every clinical claim is signed off as *"confirmed against [named source]"* — CVTEA skills list, RECOVER, the drug label — recorded in `reviewed_against`, **not** "in the reviewer's judgment." Verifying against a published standard is more defensible under challenge than a lone opinion, and it holds up at technician-reviewer level (the reviewer is usually *verifying* against a citable source, not inventing clinical truth).
- **Two tiers of sign-off (schema `review_tier`).** The base rung is **formative** — within-person, no verdict — so a single credentialed reviewer checking against a standard is sufficient, and Scenario #1 may proceed on that. Any **consequential** output (a hiring/readiness verdict) needs a higher bar: a **DVM / DACVECC co-signer**, or the recorded multi-rater path (§6.2–6.3). A formative-tier sign-off must never drive a consequential decision.
- **Operational risk — single reviewer.** If clinical review depends on one person, the sign-off gate has no fallback if they become unavailable — a live risk in a segment running ~79% turnover (the product's own premise). Not a build blocker; recorded here, and a **second qualified reviewer is a precondition for the hiring gate**, not the base rung.

## 9. Non-goals (explicitly deferred — do NOT build into Scenario #1)

- **G / CPR / resuscitation** and any **crash / real-time deterioration** → summit, Engine Beta.
- **Multi-role / crew / information asymmetry across roles** → build order step 4.
- **Team-working & Communication ANTS domains** → summit (need a crew to observe).
- **The QA-trap "refuse a wrong order someone else logged"** and **ABC-before-access priority inversion** → Tier-4 (F1/F2 mechanics exist in the component, but not in Scenario #1's content).
- **Hiring / readiness verdict, readiness bands, drift detection** → gated on N + 3 raters (`CLAUDE.md §6.2–6.3`).
- **Voice, LLM dialogue, 3D/VR** → out of v1 (`CLAUDE.md §7`).

## 10. Open decisions — RESOLVED (2026-07-24)

- **OD-1 — Clock model → DECIDED: scenario-phase, turn-based.** The base rung is Engine-Alpha-pure; the trainee is never under real-clock pressure. T2's `timed` window is a scenario phase, not wall-clock. Real-time is deferred to the summit.
- **OD-2 — Species → DECIDED: parameter, both authored.** Dog and cat are interchangeable instances with species-specific ranges; the scenario varies species across runs so the technician must know both equally. Task structure is species-independent. *(Reference ranges per species remain clinical-review-gated, §2.5.)*
- **OD-3 — T7 abnormality → DECIDED: low HR + high BP** (bradycardia + hypertension) — a recognisable pattern to catch and escalate. **Clinical-review-gated:** exact values, admitting context, and escalate-appropriateness confirmed by the reviewer before it scores anyone (see T7).
- **OD-4 — Rating timing → DECIDED: post-hoc from the AAR replay** (not live). Keeps the recorded session re-scorable by additional raters later (`CLAUDE.md §6.3`).

*No open decisions remain for Scenario #1. Two decided items (OD-2 ranges, OD-3 values) still require clinical sign-off before scoring — that is a §2.5 content gate, not an open design decision.*

## 11. Acceptance criteria (definition of done for Scenario #1)

- [ ] The seven tasks run end-to-end in the deliberate engine, each producing role-attributed events.
- [ ] The determinism golden test passes (same seed + events → byte-identical state).
- [ ] Technical pass/fail is computed from the log and every result traces to its events.
- [ ] mg→ml, drops/min are **never computed** for the trainee; wrong answers (dose/route/tube/order) are **logged, not blocked** (format-only block in T1).
- [ ] Route is scored separately from dose; correct-volume-wrong-route reads as fail.
- [ ] Instructor can rate SA + DM (1–5), each linked to events; no consequential verdict is emitted.
- [ ] The AAR renders from replay with expected-vs-actual per item; manager can open it.
- [ ] The scenario carries `clinically_reviewed` (+ reviewer + version); an unreviewed scenario cannot score a real person.
- [ ] time-in-training captured on the session.
- [ ] Three-surface QA pass (backend / frontend / UX-RTL) with screenshots (`CLAUDE.md §8`).

---

*This SRS is scoped to Scenario #1 only. It inherits the frozen decisions in `CLAUDE.md`, the architecture in `docs/decisions/ADR-001`, and the design surface in `design-system/HANDOFF.md`. Where it conflicts with any of those, that is a defect in this document — raise it.*
