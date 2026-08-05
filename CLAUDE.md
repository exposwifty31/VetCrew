# VetCrew — Project Context for Claude Code

**Status:** pre-v1 — deterministic engine; **shipped:** trainee station, instructor console (live inject/pause), manager evidence desk, AAR/ANTS; auth-bound live join via Clerk + `role_stations`; CI/e2e test-auth seam (`VETCREW_TEST_AUTH`). Solo build (Dan), AI-agent-driven.
**Last updated:** 2026-08-05 (product model settled — see §1; four blocking code defects found, see `docs/design-alignment-2026-08-05.md`)

**⚠️ THIS IS AN INTERNAL TOOL FOR ONE HOSPITAL, NOT A PRODUCT FOR SALE.** Dan works at a veterinary hospital in Israel. **The department manager commissioned this work** as a task: improve how the hospital evaluates technicians applying for jobs, because the current method is not good enough. The users are colleagues Dan sees every day. If it later grows into something the hospital or others adopt, good — that is not the driving force. **Consequence: the competitive analysis below (SimX, iSimulate, market positioning) is context, not strategy. There is no buyer to persuade.** The former "pitch track" framing is obsolete; where older sections still read that way, §1 supersedes them.

**Adoption is mandated, which relocates the §2.4 risk.** Assessment is **mandatory** for candidates and both replaces and supplements the written exam. [A4]'s zero-uptake finding was specifically about *voluntary* programmes, and its authors concluded leadership mandate is the precondition — this is the mandated case. The friction risk now binds only the **voluntary practice platform**.

**Current milestone: make the assessment path work as designed.** Session mode, three-rater scoring, and the time-in-training removal — spec at `docs/superpowers/specs/2026-08-04-assessment-path-design.md`. **Do not start it before reading `docs/design-alignment-2026-08-05.md` §2:** a product-strategist review found four defects that make the spec as written non-functional or dishonest, and two of them are false claims inside the spec itself.

**Shipped:** station + instructor + manager under auth-bound join; floor deep-link station entry, trainee never creates ([#17](https://github.com/exposwifty31/VetCrew/pull/17)); tamper-evident ANTS evidence attestation — every rating binds to verified evidence seqs plus a frozen `log_head_seq`/`log_head_hash` ([#18](https://github.com/exposwifty31/VetCrew/pull/18)); AAR checklist rendering Hebrew and the patient monitor wired into the station ([#22](https://github.com/exposwifty31/VetCrew/pull/22)). Parallel-worktree dev infrastructure ([#23](https://github.com/exposwifty31/VetCrew/pull/23)), whose stop condition still stands: no further worktree investment without recorded collision pain at ≥3 concurrent agents.

**Open HITL:** clinical review stamp ([#12](https://github.com/exposwifty31/VetCrew/issues/12)) — no real-person scores without it; code gates only. The ask is now scoped to **thirteen scoring claims on a printed Hebrew review sheet**, not a whole-file boolean, because the Reviewer is 65 and will never log into anything. See §1.6.

**Content constraint, now a product problem rather than a demo one:** the two scenarios are capability-disjoint by design (`scenario-srs-divergence-memo.md`, Option (a), countersign in [#10](https://github.com/exposwifty31/VetCrew/issues/10)) — `base-rung-stepped-tasks` has 7 tasks and **0 injections**; `base-rung-resp-distress` has 2 injections and **0 tasks**. An assessment scenario needs **both halves** — the tasks are what score, the pressure is what paper cannot test. The first assessment scenario is a merge of the two.

Read this file before writing any code. It encodes decisions that are expensive to reverse and marks the ones that are cheap. Do not silently re-litigate anything under "Frozen for v1"; do raise it explicitly if you think it's wrong.

---

## 1. What VetCrew is

A crew trainer for veterinary ER / internal-medicine hospital staff — conceptually a tank-crew simulator for a care team.

An authoritative sim server runs a deterministic, evolving patient (vitals, labs, timed phases, intervention effects). Role-specific stations act on it under time pressure. An instructor console injects events live. Everything is logged, replayable, and scored.

**The problem it replaces.** A job candidate ("Trainee Technician") completes at least 30 shadowing shifts, then sits a written exam **the Reviewer herself wrote** years ago. It reaches theory — dosage arithmetic, drop rates, which fluid set for a 10 kg dog — and stops. It cannot see what a technician does when an owner walks into the treatment area shouting mid-task, or when blood pressure crashes while they are occupied, or whether they escalate rather than improvise. Underneath the task is a conviction that incoming technicians are underprepared, and that a hospital which refuses to compromise on hiring builds a reputation that draws strong people rather than deterring them.

### 1.1 Two platforms, one record (structure taken from Elbit trainer systems)

| | Practice | Assessment |
|---|---|---|
| Purpose | Learning, skill-building, confidence | Certification, scoring, comparability |
| Instructor | Full flexibility — pause, adapt difficulty, inject at will, coach mid-run | **Observer only.** No pause, no inject, no intervention |
| Events | Dynamic, personalised to observed weakness | Pre-set at fixed time points, identical for the cohort |
| Feedback | Immediate, during the run | Only at the end |
| Mistakes | The point | Not correctable |

**The mode must be a capability the system withholds, not a policy someone follows.** In assessment mode, pause and inject intents are refused at the transport layer the way a trainee's injection attempt already is (`authorizeIntent`, `server/live/socket.ts`). Both underlying mechanisms already exist: time-triggered events (`{ kind: "time", atMs }`) for assessment, the live injection menu for practice.

**Mode is declared on the scenario file, not on the session (D3, 2026-08-04).** Elbit's model: training and qualification scenarios are *different content*, not one scenario in two settings. Implementation follows the `clinicallyReviewed` precedent — an authored field, mirrored to a column, **never entering `EngineState`** (content metadata must not be able to alter replay). Three values: `assessment`, `practice`, `tutorial`.

Two consequences: the separate-scenario-banks boundary becomes free, because the bank *is* the mode field; and **practice content must be authored separately rather than reused from the assessment bank**, which is the cost that stops the exam measuring rehearsal.

### 1.2 Three populations

- **Trainee technicians** — the original brief. Assessment, mandatory, **one long session**.
- **Existing technicians** — voluntary practice on realistic cases without an animal paying for mistakes, alone or with colleagues. Motivation is **personal bests and personal trend lines, never leaderboards** — ranking colleagues in a building where the same tool decides hiring is a social hazard.
- **Veterinarians** — observed on what nobody in Israel tests: event management, triage, performance under pressure, and **managing the technicians under them**. Not a gate and not a separate build: they appear in crew practice sessions as the lead, and ANTS is applied to the lead role. This lands exactly on the §2.1 axis with the highest-leverage person in the room.

### 1.3 The candidate path

Optional practice with a shadowing mentor during the 30 shifts → **a short standard unscored familiarisation run immediately before assessment, identical for everyone** → one locked assessment session → three raters → an evidence packet the manager acts on.

The familiarisation run is not polish. Practice is the mentor's choice, so candidates arrive with unequal interface fluency, and simulator fluency contaminates simulation scores by enough to reorder candidates (application-specific familiarisation, d = 0.67; generic familiarity does not help). A fixed pre-assessment run puts everyone over the same threshold. **The count of prior practice sessions is recorded and surfaced in the evidence packet** rather than hidden inside a score.

### 1.4 Content: written questions become lived situations

A written question names a situation; putting the candidate inside it changes what it measures. "Do you know dexmedetomidine causes bradycardia" becomes "the monitor drops to 45 — do you correctly *not* escalate." Almost anything embodies this way. Pure mechanism-of-action questions do not. Image identification does, but needs assets the engine cannot render.

Deciding what each embodied version measures is **clinical judgment**, which makes the Reviewer part of authoring rather than a stamp at the end.

**Structure is domains → scenarios → beats**: a small number of rich situations covering the VTNE domains at roughly their proper weight, not a pile of micro-tests. **Practice scenarios are a difficulty ladder** (stable patient → mild abnormality → live clock → equipment failure → conflicting priorities → second patient → role asymmetry → full crew). **Assessment scenarios must be difficulty-*matched*, not ordered:** a candidate takes one session, so comparability requires equivalent load. Expand the assessment set only for anti-memorisation, authoring siblings of the same weight.

**Four interaction shapes are missing** and should be built only when a scenario forces each one: prioritisation across several patients (highest value — the triage competency paper cannot reach; `step_order` is not a substitute), image identification (needs an asset pipeline), duration-constrained action (the checklist's `withinMs` measures when something started, not how long it was held), and repeated rhythm (essentially CPR, better served by an instrumented manikin). Plus a `med_admin` extension: the Israeli formula is weight × mg/kg for the total dose, then total ÷ available, where a percentage concentration converts at ×10 (5% = 50 mg/ml). **Both cognitive steps are currently pre-computed for the candidate.**

### 1.5 The tutorial is the first thing built

Not because it is easy — because it is the only scenario that **needs no clinical review** (so it is not gated on the Reviewer, the scarcest resource in the project), it **is** the fairness gate of §1.3, everyone touches it, and it is the safe place to build the coaching machinery before pointing that machinery at clinical content.

**Design rule: tutorial tasks have their answers visible on screen.** The trainee transcribes rather than decides — "the monitor reads HR 92, enter 92." That teaches the interface while testing no clinical knowledge, needs no sign-off, and gives nobody an exam advantage.

Elbit's five tutorial phases translate rather than port (gaze tracking, haptics and invisible walls are driver-trainer affordances): guided discovery becomes one task chip revealed at a time; micro-steps are what tasks already are; fading scaffolds is the same task with decreasing help across attempts; the protected sandbox is a scenario with flat vitals and no scoring; and the gatekeeper **is** the familiarisation gate.

**Sequencing consequence:** a tutorial without immediate feedback is not a tutorial, so **coaching becomes the first behaviour built**, not a later practice-platform item.

### 1.6 Who judges

The technical half scores itself from the log. The non-technical half does not compute and needs **three raters** (§6.3): **a vet, the Reviewer, and a senior technician who is deliberately not the mentor.** Ten senior technicians are available, so the third seat is easy to staff.

**A rating set is complete when all three assigned raters have each submitted their ratings (D2, 2026-08-04)**, and only then does the session transition `debrief → scored`. Today the *first* submission makes that transition, locking raters two and three out with a 409 (`server/routes/sessions.ts:492`, `523-527`) — the single blocking contradiction between this doctrine and the code.

**Derived requirement: the system must know which three.** "All three submitted" is uncheckable against `antsRatings.raterId` alone, since it is free text stamped from auth and any three people would satisfy a bare distinct-count — including the mentor. So per-session **rater assignment** is required, following the `vc_role_stations` pattern. Mentor exclusion from that list is **procedural**, not API-enforced.

Excluding the mentor removes a conflict *and* creates a signal — if one mentor's trainees consistently come out weak in the same domain, that is about the shadowing. Real, and unusable for years at a few candidates annually: **record mentor attribution now, use it when N exists.** If mentor quality becomes readable, mentors should be told so up front.

The mentor still contributes, and better than a testimonial: their contribution is whatever practice record accumulated during shadowing. Data from the person best placed to produce it, judgment from people without a stake.

**The Reviewer is 65 and completely non-technical.** She reads paper, ticks boxes, signs, and hands it back; she will never log into anything. Everything reaching her is printed Hebrew in plain clinical language with clinical notation in Latin exactly as a medical record writes it (`SpO₂`, `HR`, `mg/ml`). **This collides with D2** — see `docs/design-alignment-2026-08-05.md` §2.5, which is unresolved and cannot be retrofitted onto packets already produced.

### 1.7 Three Elbit mechanisms that look like they break frozen rules, and do not

**Coaching.** The no-verdict rule governs the log and the trainee's view, not the concept of live feedback. In practice mode the server evaluates a submission the instant it lands and shows the trainee what went wrong, while the log still records only the raw capture. The judgment is still computed over the log — just computed now instead of at debrief. Assessment mode simply does not include that projection.

**Rewind.** You cannot rewind an append-only log. Practice rewind means **branching**: replay to a point, start a new run carrying a pointer to its parent. That gives a tree of attempts, which is more useful than a rewind.

**Pre-set injections.** Not an authored branching tree — just time-triggered events, which the engine already does.

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
**Consequence: the first rung must be near-zero-friction or leadership-mandated. A "nice-to-have solo trainer" is the exact profile that got zero uptake.** **Resolved 2026-08-05 for the assessment path: it *is* leadership-mandated** — the department manager commissioned the work and a session is a required step in hiring (see the header). The finding still binds the **voluntary practice platform**, where nothing is mandated and the only defence is that the tool is good enough to be chosen. This is also why the base rung inherits the colour-coded task mental model technicians already use every shift — familiarity is the friction reduction.

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

**Do not author the communication anchors from scratch either — instrument TeamSTEPPS (added 2026-07-30).** The floor-failure anchors above are ours and unavailable elsewhere; the *communication* behaviours are not, and TeamSTEPPS (AHRQ/DoD) already names them in a form an event log can capture semi-objectively: **SBAR**, **call-out**, **check-back** (three-step closed loop), shared mental model. RECOVER's 2024 guidelines independently recommend closed-loop communication and structured debrief for CPR training without supplying a scored instrument — so the behaviours are endorsed in our domain and unmeasured in it, which is the gap. This is the vocabulary crew mode will use; it is **not** work for the solo base rung.

**Verdicts vs capture — founder decision 2026-07-30. Read this before adding any event type.**
The solo base rung exists for **objective raw data capture, not real-time right/wrong checks.** Two different things follow, and conflating them is how this gets built wrong:

- **A verdict is a judgment** — "this was correct", "that was a closed loop", "this was too slow. **No verdict ever enters the event log, in any mode.** Judgments are computed *post-run*, over the log, where they can be recomputed, challenged, and revised. This is `evidence-not-verdict` (§2.2/§2.3) expressed at the event level, and it is why `task_submit` records the submission **verbatim and uninterpreted** while the checklist evaluates it afterwards as a pure query.
- **A capture is a fact** — "at T+47s, role X did/said Y". Captures are what post-run analysis runs *on*. **The log can only replay what was recorded**, so an unrecorded run is unrecoverable forever — no later cleverness gets the data back. Capture is therefore never a thing to withhold on principle.

**Raw communication capture in the solo rung is deferred, not banned:** solo has no counterparty, so there is no second half of a closed loop to record. When crew mode lands, those captures enter as `action` events with new action ids (raw facts) — never as verdict events. See `docs/doctrines/event-taxonomy.md`, which is the governing registry.

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
  **Spike status (corrected 2026-07-30): it ran and it PASSED on desktop** — `spikes/webxr/` (README records the result). One `MonitorRenderer` canvas drives both a 2D DOM client and a `THREE.CanvasTexture` VR client with zero monitor-code changes, and the Layer A / Layer B colour separation held under a critical alarm. So the "spike failing" trigger is **retired for desktop**; the only unverified part is on-headset frame pacing and legibility on a Quest 3. This changes nothing about the deferral — it confirms the escape hatch works, which is the reason no Unity cost is paid now.

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
- Two scoring axes stored separately: technical (checklist) and non-technical crew-resource-management skills. **Default instrument: ANTS** (task management, team working, situation awareness, decision-making) — it out-performed T-NOTECHS on inter-rater reliability in exactly the canine-CPR context (ICC 0.803/0.925 vs 0.716/0.883, JVME Jan 2026). Per-domain scores are directional only; overall scores drive anything consequential. Consequential (hiring) decisions need three raters (or recorded sessions for async multi-rater review) — a single live rater is formative feedback only. ~~See `vetcrew-readiness-scoring`.~~ **Dead reference (2026-07-30):** that plugin skill did not load in a clean checkout of this repo, while `vetcrew-sim-architecture`, `vetcrew-scenario-authoring`, and `vetcrew-realtime-ui` did — exactly the failure `docs/CLAUDE.md` warns about ("not vendored here — a fresh clone cannot read them"). **The unreadable thing is that external plugin, not the doctrine itself** — the operative scoring rules are versioned and readable, now exported to **[`docs/doctrines/readiness-scoring.md`](docs/doctrines/readiness-scoring.md)**, which is the source of truth, with this section plus §2.2/§6.2–6.3 as its summary. (Wording corrected after CodeRabbit rightly flagged the original as self-contradictory: it called the doctrine unreadable while pointing at the file containing it.)
  **ANTS challenged and upheld (2026-07-30).** An external research memo recommended switching to **T-NOTECHS** on the grounds that its five trauma-team domains are a better structural fit for an emergency crew. The recommendation is not adopted, because **the memo's own reported reliability figures contradict it** — it cites the same JVME Jan 2026 canine-CPR study and the same numbers used above (ANTS 0.803/0.925 > OGRS 0.726/0.888 > T-NOTECHS 0.716/0.883), i.e. ANTS was the most reliable of the three instruments tested in exactly our context, and then recommends the least reliable one on structural-fit grounds alone. Structural fit is a real argument, but it does not outrank measured reliability in the target setting. ANTS stays frozen. Revisit only if a study measures T-NOTECHS as *more* reliable in a veterinary crew setting.
- Scenarios are data (YAML/JSON), versioned independently of the engine. A score records the scenario version used.
- Injections are a **menu the instructor triggers live**, not an authored branching tree. Conditional auto-triggers stay rare and legible.
- Hebrew-first UI, RTL, all strings through a single i18n module (same convention as VetTrack).
- WCAG 2.1 AA baseline; color-blind-safe severity coding for vitals/criticality.
- ~~**Time-in-training is captured on every scored session from the first one**, even before scoring surfaces exist — it is the axis the whole progression is measured against, and it cannot be backfilled.~~ **UNFROZEN 2026-08-05 (D1) — there is no time-in-training metric.** The 30 shadowing shifts are not visible to the system, and a candidate takes one session, so they have no longitudinal axis at all. **This is a live blocker:** the ratings route returns 422 `no_time_in_training` when the column is null (`server/routes/sessions.ts:495`) **and** `0002_integrity.sql` carries a check constraint `vc_sim_sessions_scored_needs_time_in_training` forbidding `phase = 'scored'` without it — so removal is a migration, not just code deletion, and as things stand **no session can be scored at all** once the field stops being populated. 62 references across 23 files; keep the column (Zod strips unknown keys, saving ~20 test call sites) and remove every read. **Derived decision:** `packages/engine/src/scoring-surfaces.ts:85-89` sorts the within-person trend *by* this field, so `createdAtMs` — already the tie-break — becomes the sole sort key.
- **The lifecycle forks on mode (2026-08-04).** Assessment runs `debrief → scored → archived` and requires a complete rating set. Practice and tutorial **never reach `scored`** — ratings on them are formative annotations. This required widening `packages/engine/src/fsm.ts` to `debrief: ["scored", "archived"]`, because `scored` was the only exit and the fork would otherwise strand every practice session with no terminal state. The widening is **mode-blind**, so D3 holds: `canTransition` describes shape, the server enforces policy.
- **The base rung's task inventory maps onto the existing national standard**, not an invented one: AVMA CVTEA mandates that every graduate complete the centrally-defined *Veterinary Technology Student Essential and Recommended Skills List*, each skill individually evaluated and dated. Map to it; do not reinvent it. (It standardizes *what* is checked off, not mastery level or method — which is the gap VetCrew fills.)
- **Two colour systems, hard-contained.** Patient-monitor **channel colours** signal parameter identity (always on, never severity). Task-surface **code colours** signal task type and live only inside the task panel. Neither may appear in the other's zone. Severity/alarm is a third, redundantly-coded layer (flash + frame + shape + label + audio) riding on top. Full-screen critical-alarm framing is the only permitted crossing.
- **The patient monitor's own face is exempt from Hebrew-first (founder ruling 2026-07-30).** `HR`, `SpO₂`, `EtCO₂`, `RR`, `NIBP`, `Temp` and the device header render in Latin instrument notation and do **not** go through i18n. This is deliberate and narrow: the monitor simulates a real uMEC12-Vet, and the notation above is what a technician actually reads on the floor — localizing it would make the trainer less faithful to the equipment being learned. The exemption covers **device-face text only**; every other string in `src/**`, including task chips and all UI chrome around the monitor, goes through i18n as normal.
- **Monitor channels must not be inferred from a different modality.** A waveform lane may only be driven by a vital the scenario actually models for that lane's equipment. Concretely: `Art` means an **invasive** arterial line and may never be keyed on cuff (`sys_bp`/`dia_bp`) values — non-invasive pressure is intermittent and produces no trace, so drawing one claims monitoring hardware that was never attached and double-reports the same reading under two modalities (§2.3/§2.5). The arterial lane was removed for exactly this reason on 2026-07-30; a scenario that models an arterial line must supply its own invasive-pressure vital.

---

## 5. Build order

Scoring moved to position 2. Reason: **scoring is the product.** If it ships fourth, you learn whether a manager finds the output credible in month four or five.

1. **Bootstrap** — repo, TS config, Vitest, Postgres + Drizzle schema for the event log, Railway deploy skeleton. ✓
2. **Deterministic scenario engine + AAR + instructor rating** — pure reducer, seeded PRNG, replay test, one minimal scenario, instructor rates the non-technical dimensions, AAR renders from replay. ✓ Goal: put a scored session in front of the department manager as early as possible.
   **MVP refinement (2026-07-24):** the first scenario is **one base rung** — a single-role, technical-competence task sequence producing a role-attributed record — not a full crew scenario. Per §2.7, ship the rung, not the mountain.
3. **One room, one station** — the trainee role station against the live engine. ✓ Auth-bound join via Clerk + `role_stations.assigned_user_id`; CI test-auth seam.
4. **Instructor console** — live injection, pause/resume, end. ✓ **Full crew** — remaining role stations, partial-view enforcement — **future**.
5. **Scoring surfaces** — manager evidence desk ✓; readiness bands, per-dimension drift detection for veterans — **future**.
6. **Access modes** — pre-hire screening flow, onboarding cohorts — **future**.

Voice, LLM, and 3D all sit after this list, gated on §6.

---

## 6. Open risks — pilot validation (pitch path shipped)

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

**Consequence for any "two raters, ICC ≥ 0.75" target (2026-07-30).** External guidance proposes exactly that as the gate before a scoring rubric ships. **It is unreachable at this pilot site as stated** — there is one qualified rater, and §6.3's own reliability logic is what makes a second one necessary rather than optional. So the rubric-validation gate is not "recruit a second live rater"; it is recorded sessions scored asynchronously by additional raters. Anyone proposing an inter-rater target must say where the second and third raters come from, or the target is decoration.

**CORRECTED 2026-08-05 — raters are internal, and the pool was never one person.** An earlier version concluded the raters must come from *outside* the hospital. That rested on a conflation: the US veterinary-technician degree matters for judging whether scenario *content* is clinically correct (§2.5, the Reviewer's job), and has little to do with judging whether a candidate managed a deteriorating patient competently. ANTS is designed for domain experts, not for holders of a specific credential. Founder decision: external raters are neither necessary nor desirable — applicant data should not leave the hospital, and internal raters know the floor. **The three are a vet, the Reviewer, and a senior technician who is not the candidate's mentor;** there are ten senior technicians. The constraint that stays is the separation of duties in §1.6: the mentor supplies data, not scores.

---

## 7. Explicitly out of v1

3D / Unity · VR headsets · voice (TTS + push-to-talk STT) · LLM-generated dialogue · multi-tenant SaaS onboarding · authored branching decision trees · ML-derived scoring · mobile/native app.

**3D/VR is now a decided question, not an open one — see ADR-001 in §3.** It was formally evaluated against the expanded simulator spec and deferred, with a WebXR (not Unity) path preserved and explicit revisit triggers. Do not re-open it without hitting one of those triggers.

**A trigger fired and the revisit closed — 2026-08-05.** ADR-001's first revisit trigger ("a pedagogical requirement that genuinely cannot be assessed in 2D — motor skill, not knowledge") was legitimately hit: femoral pulse palpation, TPR, and IV/jugular catheter placement cannot be assessed on a screen, and they are required items on the CVTEA skills list §4 commits to. **The revisit resolved against headset VR**, on three grounds. Quest 3 fingertip tracking error is 1.73 cm best case against a canine cephalic vein of ~3 mm — the noise floor is four to six times the target, a hardware limit no rubric can recover from. No validated haptic-free VR psychomotor assessment instrument exists; all 26 studies in the 2025 review were formative and none reached Miller's "does" level. And CVTEA states *"skill assessment is expected to be performed on live animals,"* with exactly one carve-out — *"Apply established emergency protocols (simulation acceptable): … perform first aid and cardiopulmonary resuscitation"* — which is the domain VetCrew already occupies. **Adopted remedy: an instrumented physical trainer feeding raw telemetry into the same event log, never a headset.** Also relevant if VR is ever revisited: simulator fluency is a measured confound in simulation-based assessment (d = 0.67), so a headset would add construct-irrelevant variance on top of everything above.

**Also decided and closed (2026-08-05):** no offline appliance — one hospital, cloud, Dan as data owner, so hiring data sits where he has direct access. No leaderboards (§1.2). No time-in-training (§4).

Data model stays SaaS-shaped (tenant-scoped) so multi-tenancy is not a rewrite — but only one hospital exists in v1.

---

## 8. Working agreements

- **Every implementation session ends with a Final QA pass**: launch locally, capture screenshots for all screens touched, report Screenshot / Expected / Actual / Pass-Fail per screen. TypeScript compiling is not sufficient evidence.
- The engine gets tests before it gets a UI. A determinism test (same seed + same events → identical state) is part of step 2, not a later addition.
- Do not add abstraction for the phase-2 3D goal. It is cut (ADR-001). **The seam already exists and costs nothing: keep simulation logic in the pure reducer and keep it out of React components.** That discipline alone preserves the WebXR/Unity option — no extra abstraction layer is wanted or permitted.
- If a change would make a score untraceable to its source events, stop and raise it.
- **Clinical claims that drive a score need sign-off before they score anyone** (§2.5), no matter how confident the source — including floor-observed failure modes contributed from inside the hospital. Record the reviewer and the scenario version alongside the claim.
