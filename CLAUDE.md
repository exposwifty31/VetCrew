# VetCrew — Project Context for Claude Code

**Status:** pre-v1 pitch package — deterministic engine, live station + instructor console, AAR/ANTS, manager evidence desk, Clerk + Railway wired. Solo build (Dan), AI-agent-driven.
**Last updated:** 2026-07-25 (Sprint 5a + Clerk/Railway live; Reviewer is the pitch audience)

**Current milestone (2026-07-25):** pitch-ready package for the Reviewer (§6) — concept end-to-end and UI visible enough to judge problem/solution fit. Standing open: Clerk→`role_stations` binding, clinical review stamps, scenario Option (a) countersign. No hiring verdicts until N + three raters.

Read this file before writing any code. It encodes decisions that are expensive to reverse and marks the ones that are cheap. Do not silently re-litigate anything under "Frozen for v1"; do raise it explicitly if you think it's wrong.

---

## 1. What VetCrew is

A crew trainer for veterinary ER / internal-medicine hospital staff — conceptually a tank-crew simulator for a care team.

An authoritative sim server runs a deterministic, evolving patient (vitals, labs, timed phases, intervention effects). Role-specific stations act on it under time pressure. An instructor console injects events live. Everything is logged, replayable, and scored.

Two products from one engine:
- **Refresher training** — for fresh and veteran staff, targeted by skill drift.
- **Readiness assessment** — pre-hire screening and onboarding ("is this person ready for the floor, given time-in-training").

---

## 2. Product truths that constrain engineering

These come out of competitive research and drive most decisions below. If a technical choice conflicts with one of these, the technical choice is wrong.

**2.1 — The moat is the non-technical axis, not the checklist.**
Technical checklist scoring is commoditized (VetBloom, Honen, any LMS competency tracker does it). Nobody scores veterinary crew *communication, situational awareness, closed-loop callouts, leadership, decision-making*. That axis is the product. Protect it in the data model and the AAR, not as a feature bolted on later.

**2.2 — The two use cases have different evidentiary bars.**
Refresher = within-person comparison. Needs no norms, no defensibility. Can ship immediately.
Readiness/hiring = cross-person judgment. Needs a score distribution that does not exist yet, and needs to survive being challenged by HR, a rejected candidate, or a manager.
**Consequence: the hiring gate is the output of the pilot, not a feature of it.** Build the data capture for it; do not ship a "not ready for the floor" verdict until there is N.
Reliability data sharpens this further. In video-recorded canine CPR simulations, non-technical-skills scoring reached sufficient reliability only with **three raters**, and several individual domains of every instrument tested fell below ICC 0.75. Live single-instructor scoring is harder than video review, so one instructor cannot support a hiring verdict at any sample size.
**Reframe: VetCrew produces evidence for a hiring conversation, not a score that decides one.** A replayable, role-attributed record that a manager reviews is defensible; a number from one live rater is not. This strengthens rather than weakens the event-sourced architecture — the evidence is the product.

*External corroboration (research run B, high confidence).* AVECCTN — the veterinary ECC credentialing body itself — uses **single-rater binary sign-off** for its 42-item skills list, but escalates to **three blinded raters** for its one genuinely consequential judgment (case reports are randomized, de-identified, and read three times, with recusal on recognition). The domain independently converges on the same three-rater threshold from the CPR reliability literature. Cite this when the evidence-not-verdict posture is challenged: it is not our invention, it is how the field already behaves.
Its competency verification also rests on **first-hand observation of live, unaided performance** by a credentialed colleague — which is exactly what a replayable, role-attributed record is a defensible analog of.

**2.3 — Auditability is a liability boundary.**
Any score that could influence a hiring decision must be traceable to specific timestamped, role-attributed events. No black-box ML for the readiness score. A transparent rubric tied to event-log evidence is defensible; a model output is not.

**2.4 — The base rung is the adoption vehicle; the summit is the differentiator.**
Target segment (ER/specialty) runs ~79% technician turnover and is chronically understaffed. Understaffed floors struggle to release 4–5 people simultaneously for a co-located session. Expect the solo base rung to be what actually gets used, and expect that to pull the product toward the commoditized end. Do not let it become the only tested path.

**Friction is the measured risk, and it is severe (research run A, high confidence).** A fully built, **resident-requested** competency-progression curriculum (15 institution-specific EPAs, one assessment per resident per month) produced **zero completed assessments and zero supervisor evaluations three months after launch.** The cause was not rejection of the framework — both residents and supervisors endorsed it — it was that **clinical service demand systematically outranks structured training** in the daily workflow. Participants concluded that a *voluntary* progression ladder is not viable and that leadership-mandated, quantified completion is a precondition.
**Consequence: the first rung must be near-zero-friction or leadership-mandated. A "nice-to-have solo trainer" is the exact profile that got zero uptake.** This is why the base rung inherits the colour-coded task mental model technicians already use every shift — familiarity is the friction reduction.

**Do not solo-ize the non-technical axis.** FAA CRM guidance (AC 120-51E, active) treats the individual/classroom tier as a "necessary first step" that alone does not change behaviour, and recommends recurrent crew exercises run with **a complete crew, each member in their normal position**. Segmenting by individual position is appropriate for seat-dependent technical skills and explicitly inappropriate for most crew-skill training. So: the base rung trains **individual technical** competence; **team/non-technical competence belongs at the summit** and must not be reduced to a solo exercise.

**2.5 — Clinical accuracy in scenarios is a liability boundary, not content polish.**
Scenario content that feeds a readiness decision must be reviewed against current standards (RECOVER for CPR/resuscitation sequencing, etc.). Every scenario carries a `clinically_reviewed` flag. Unreviewed scenarios are internal-testing only.

**2.6 — Instructor console + logged session + debrief is now table stakes, not differentiation.**
3B Scientific (which owns both VSI and iSimulate) sells iSimulate REALITi into the veterinary channel as "Simulated Veterinary Monitors." REALITi Go already ships an instructor control tablet driving a separate monitor tablet, remote control over the internet, a configurable checklist interface, an observer app, a built-in training management system capturing event log / vital signs history / scoring / waveforms / video, plus PDF and CSV export.
That covers a large share of what v1 was going to build. What it does not do: multi-role stations with genuine information asymmetry (it is one monitor plus passive observers), veterinary-native physiology (it mimics human monitors and attaches to VSI manikins), longitudinal readiness relative to time-in-training, the hiring use case, or Hebrew.
**Consequence: the defensible ground is multi-role information asymmetry + longitudinal readiness + veterinary-native scenario physiology.** Do not spend build time competing on session logging and debrief export — match it and move on.

**2.7 — The mountain is the product vision. It is not the wedge.**
VetCrew is a competency progression: a solo, low-stakes base of everyday floor competence rising to a summit of multi-patient CPR under the emergency ward manager. Altitude *is* the readiness-relative-to-time-in-training axis, made literal — and run B confirms that axis is real and long (the ECC specialty credential requires **6,000 ECC hours within five years**, ≈3 years FTE).

But the mountain **fails the wedge test** and must not be shipped as one: it is not narrow, and it does not reduce the behaviour-change cost of §2.4. **Ship one rung.** The mountain is what the rung grows into.

**The progression structure is not the moat.** Research run A could find **no evidence that competency frameworks or progression ladders are defensible assets** — published behavioural-marker instruments are freely adapted and re-skinned by third parties. What *is* defensible:
- the **auditable, role-attributed evidence record** (§2.2/§2.3 — now the strongest scored mechanism), and
- **validated veterinary-specific non-technical anchor points**, which do not exist anywhere. Run B established the ECC credential's 42-item inventory is **100% technical** — a keyword search for communication, teamwork, leadership, handoff, situational, closed-loop returned **zero matches**. The whitespace in §2.1 is now documented, not asserted.

**Authoring those anchors from observed floor failures is IP, not content.** Two are already recorded (route errors — e.g. a drug that is SC-only being given IV; and priority inversion under stress — reaching for IV access before airway and pulses). Both are decision tests requiring no 3D. Collect more; they are the product.

---

## 3. Stack — decided

TypeScript end-to-end. Every choice below is either (a) transferable from VetTrack to reduce solo cognitive load, or (b) required by determinism/auditability.

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript, both ends | One mental model; strong AI-agent ergonomics |
| Sim core | Pure TS reducer — `(state, event) => state` | Determinism and audit come from the same design |
| Randomness | Seeded PRNG, seed stored per session | Reproducible replay |
| Event log | Postgres append-only table | The source of truth. Not a side effect. |
| Transport | Socket.IO | Free reconnect/heartbeat/fallback; replay-from-seq is trivial given the log |
| Server | Node + Express, standalone stateful process | Stateful sim cannot run serverless |
| ORM / DB | Drizzle + Postgres | Transfers from VetTrack |
| Frontend | Vite + React + TS | Transfers: i18n convention, RTL, design system, existing skills |
| Auth | Clerk | Transfers from VetTrack |
| Hosting | Railway (sim server + frontend + Postgres) | One platform already in use |
| Testing | Vitest | Engine is pure — unit-testable before any UI exists |

### Dropped from the earlier plan, with reasons

- **Colyseus** — justified partly by a phase-2 Unity/3D goal that is cut from v1, and it solves the easier half. It gives authoritative *state sync*; the hard requirement is an immutable, replayable, role-attributed *event log*, which you build regardless. Room lifecycle/matchmaking value scales with concurrency; one pilot hospital has ~1–3 concurrent sessions ever. **Concession: if 3D happens, Colyseus can sit in front of the same event-sourced core later.** Nothing here forecloses it.
- **Voice (TTS + push-to-talk STT)** — cut on cost and sequencing, not feasibility. Nova-3 Medical is English-only, but Nova-3 Hebrew monolingual is production-available with Keyterm Prompting for domain vocabulary. Re-enters after scoring is validated (see §6.1).
- **Claude API / LLM skin** — not needed for v1. Owner dialogue and scenario prose can be pre-written. Re-enter once scoring is validated.
- **Next.js + Vercel** — Vercel cannot host the stateful sim server anyway; Vite keeps tooling consistent with VetTrack. Low-stakes and reversible either way.
- **Unity / Mirror / Photon / Redis / LAN-native (ADR-001, accepted 2026-07-24)** — formally evaluated after the spec expanded to a networked, VR-ready simulator, and **deferred**. Reasons: ~90% of the specified training content is 2D (monitor, task surface, calculations, tube selection, locking, triage, debrief); the durable asset is the **reducer and the event log**, not the renderer, so any client can be swapped later; **Redis as the system of record is rejected outright** — the certification report is hiring evidence and cannot sit on a volatile substrate (Redis is permitted as a lock/presence cache only); and per-station installs, GPU workstations, CAT6/switch, and headset logistics maximise exactly the friction §2.4 identifies as the measured killer.
  **VR is kept open via WebXR, not Unity** — Quest 3 runs WebXR natively in-browser, so a future 3D client can render the same event log without leaving the web stack. **Revisit triggers:** a competency that genuinely cannot be assessed in 2D (motor skill, not knowledge); §6.4 resolving *and* a request for spatial team training; a buyer making VR a purchase condition; or the WebXR spike failing.

### Determinism rules (non-negotiable)

The reducer is pure. Inside it:
- No `Date.now()`, no `Math.random()`, no I/O, no network.
- Time enters as explicit tick events. Randomness enters via the seeded PRNG.
- Same seed + same event sequence must produce byte-identical state. There is a test for this.

---

## 4. Frozen for v1

- Event-sourced core; the log is authoritative, all state is derived.
- One authoritative engine per session; role stations and instructor console are thin clients that render pushed state and send intents. No client-side state computation.
- Role stations see a genuinely **partial** view of session state — information hiding is a feature, not a permissions filter over a full view. Trainees must communicate to obtain what other roles hold.
- Sessions are scoped by `session_id`; no cross-session shared state.
- Session lifecycle: `draft → briefing → running ⇄ paused → debrief → scored → archived`. Model this as an explicit state machine on both ends, not boolean flags.
- Instructor-only actions: pause, resume, inject, end. Everything else is role-attributed trainee action.
- Two scoring axes stored separately: technical (checklist) and non-technical crew-resource-management skills. **Default instrument: ANTS** (task management, team working, situation awareness, decision-making) — it out-performed T-NOTECHS on inter-rater reliability in exactly the canine-CPR context (ICC 0.803/0.925 vs 0.716/0.883, JVME Jan 2026). Per-domain scores are directional only; overall scores drive anything consequential. Consequential (hiring) decisions need three raters (or recorded sessions for async multi-rater review) — a single live rater is formative feedback only. See `vetcrew-readiness-scoring`.
- Scenarios are data (YAML/JSON), versioned independently of the engine. A score records the scenario version used.
- Injections are a **menu the instructor triggers live**, not an authored branching tree. Conditional auto-triggers stay rare and legible.
- Hebrew-first UI, RTL, all strings through a single i18n module (same convention as VetTrack).
- WCAG 2.1 AA baseline; color-blind-safe severity coding for vitals/criticality.
- **Time-in-training is captured on every scored session from the first one**, even before scoring surfaces exist — it is the axis the whole progression is measured against, and it cannot be backfilled.
- **The base rung's task inventory maps onto the existing national standard**, not an invented one: AVMA CVTEA mandates that every graduate complete the centrally-defined *Veterinary Technology Student Essential and Recommended Skills List*, each skill individually evaluated and dated. Map to it; do not reinvent it. (It standardizes *what* is checked off, not mastery level or method — which is the gap VetCrew fills.)
- **Two colour systems, hard-contained.** Patient-monitor **channel colours** signal parameter identity (always on, never severity). Task-surface **code colours** signal task type and live only inside the task panel. Neither may appear in the other's zone. Severity/alarm is a third, redundantly-coded layer (flash + frame + shape + label + audio) riding on top. Full-screen critical-alarm framing is the only permitted crossing.

---

## 5. Build order

Scoring moved to position 2. Reason: **scoring is the product.** If it ships fourth, you learn whether a manager finds the output credible in month four or five.

1. **Bootstrap** — repo, TS config, Vitest, Postgres + Drizzle schema for the event log, Railway deploy skeleton.
2. **Deterministic scenario engine + AAR + instructor rating** — pure reducer, seeded PRNG, replay test, one minimal scenario, instructor rates the non-technical dimensions, AAR renders from replay. **No trainee UI yet.** Goal: put a scored session in front of the department manager as early as possible.
   **MVP refinement (2026-07-24):** the first scenario is **one base rung** — a single-role, technical-competence task sequence producing a role-attributed record — not a full crew scenario. Per §2.7, ship the rung, not the mountain.
3. **One room, one station** — the trainee role station against the live engine.
4. **Full crew + instructor console** — remaining role stations, live injection, partial-view enforcement.
5. **Scoring surfaces** — readiness bands, per-dimension drift detection for veterans, manager-facing views.
6. **Access modes** — pre-hire screening flow, onboarding cohorts.

Voice, LLM, and 3D all sit after this list, gated on §6.

---

## 6. Open risks — validate before building past step 2

**6.1 — Hebrew STT (downgraded: model substitution, not a blocker).**
Nova-3 Medical is trained on English medical conversations, so that specific model choice would have failed at an Israeli pilot site. But Deepgram now ships production Hebrew monolingual STT on Nova-3 — streaming and batch, with Keyterm Prompting and Numerals. Keyterm Prompting allows injecting up to 100 domain terms without retraining, which is the likely path for veterinary drug names.
Voice stays cut from v1 on cost and sequencing grounds, not feasibility. **Before voice re-enters scope:** benchmark Nova-3 Hebrew (not Medical) against a real recording of a Hebrew code callout with English drug names, using Keyterm Prompting loaded with your formulary.

**6.2 — No normative data for readiness thresholds.** *(Partially relieved.)*
"Per-role thresholds you set" — set from what distribution? Nobody has scored a competent 6-month tech vs a competent 3-year tech on these scenarios. Until N exists, a readiness verdict is an opinion with a number attached. Capture the data; withhold the verdict.
**Relief:** the progression gives a **within-person** axis (a technician against their own earlier sessions and their time-in-training), which needs no cross-person norms and serves the refresher use case immediately per §2.2. The **hiring** verdict still requires N and three raters. The withhold-the-verdict rule is unchanged.

**6.3 — Inter-rater reliability on the non-technical axis is unmeasured.**
The differentiating axis is human-scored live. Two instructors may score the same candidate differently. Before the hiring gate ships, run the same recorded session past two raters and measure the gap. Market direction is toward automated feedback without faculty (Oxford Medical Simulation cites ~$1.08 vs $3.62 per virtual vs physical simulation) — instructor-scored comms is the expensive model, chosen deliberately, and it needs to earn its keep.

**6.4 — Team-mode scheduling feasibility at the pilot site.**
Unvalidated whether the pilot hospital can release a full crew simultaneously. If it can't, solo mode is the product and differentiation needs rethinking. (The 79% ER/specialty turnover figure is from Instinct Science's September 2024 report. Re-check for a 2025 or 2026 edition before using this number externally.)

**6.5 — Competitor encroachment on the multi-role gap.**
iSimulate REALITi already supports adding tablets that act as monitor, defibrillator, or ventilator. That is one configuration change away from multi-station. If 3B/iSimulate ships role-specific views with information asymmetry into the veterinary channel, the primary differentiator disappears. Monitor their veterinary product releases and InVeST conference announcements quarterly.

### The one question that resolves 6.2 and 6.3 at once

Ask the department manager, before more code:

> *"If I showed you a scored session for a new hire, what would make you trust it enough to act on it — and what would make you dismiss it?"*

Free, and it determines whether the hiring gate is viable at all.

**Partial answer (2026-07-25, Dan's ground truth — the manager himself has not yet been asked):** the hospital has NO rating infrastructure for new technicians beyond a written exam that is outdated, does not reflect the actual floor work, and covers only part of the required theory. Dan's assessment: the manager will welcome any credible infrastructure for this, especially one that costs him zero work. Still put the question to the manager verbatim — but the incumbent VetCrew competes against is "nothing," and the bar is correspondingly low.

**The Reviewer exists and is singular (2026-07-25).** Exactly one technician in the hospital holds a US veterinary-technician degree (not recognized as a degree title in Israel). She is the only viable Reviewer, and that will not change while she holds the credential. Consequences: (a) she is the pitch audience — the product must be presentable end-to-end, UI/UX included, for her to evaluate the concept; (b) a one-Reviewer reality reinforces §2.2 — a second live rater does not exist, so anything consequential rests on recorded, replayable sessions reviewed asynchronously, exactly what the event-sourced record provides.

---

## 7. Explicitly out of v1

3D / Unity · VR headsets · voice (TTS + push-to-talk STT) · LLM-generated dialogue · multi-tenant SaaS onboarding · authored branching decision trees · ML-derived scoring · mobile/native app.

**3D/VR is now a decided question, not an open one — see ADR-001 in §3.** It was formally evaluated against the expanded simulator spec and deferred, with a WebXR (not Unity) path preserved and explicit revisit triggers. Do not re-open it without hitting one of those triggers.

Data model stays SaaS-shaped (tenant-scoped) so multi-tenancy is not a rewrite — but only one hospital exists in v1.

---

## 8. Working agreements

- **Every implementation session ends with a Final QA pass**: launch locally, capture screenshots for all screens touched, report Screenshot / Expected / Actual / Pass-Fail per screen. TypeScript compiling is not sufficient evidence.
- The engine gets tests before it gets a UI. A determinism test (same seed + same events → identical state) is part of step 2, not a later addition.
- Do not add abstraction for the phase-2 3D goal. It is cut (ADR-001). **The seam already exists and costs nothing: keep simulation logic in the pure reducer and keep it out of React components.** That discipline alone preserves the WebXR/Unity option — no extra abstraction layer is wanted or permitted.
- If a change would make a score untraceable to its source events, stop and raise it.
- **Clinical claims that drive a score need sign-off before they score anyone** (§2.5), no matter how confident the source — including floor-observed failure modes contributed from inside the hospital. Record the reviewer and the scenario version alongside the claim.
