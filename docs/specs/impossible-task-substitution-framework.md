# Substituting Physically-Impossible Tasks in VetCrew — A Conceptual Framework

**Status:** design/grounding spec · **Date:** 2026-07-30 · **Type:** conceptual (no code)
**Purpose:** a reusable rule for turning any clinical task that cannot be *physically* performed in a
screen simulator into an action the software can represent — one that still trains and assesses the
competency that mattered, and produces the auditable, role-attributed evidence the readiness use case
depends on (`CLAUDE.md §2.2/§2.3`). Every claim about the codebase below is verified against source with
a `file:line` reference; the document names the code seams each mechanism already lives in so it reads as
buildable, while writing no code.

---

## Context — why this document exists

A screen-based simulator cannot host the physical matter of clinical work: a needle in a vein, a limb
under a palpating hand, a syringe emptying into a patient. Yet a large share of the base-rung task
inventory *is* physical procedures. VetCrew needs a general, reusable rule for substituting them.

**Finding that reframes the request.** The brief is written as if the substitute action is unknown. The
codebase shows the opposite: VetCrew has already shipped **seven working substitution patterns** — the
task `body.kind` widgets `value_entry, choice_chain, med_admin, tube_choice, step_order, fluids_setup,
escalate` (`packages/engine/src/tasks.ts:56`, `packages/shared/src/tasks.ts:40`) plus the free-form
`action` intent — each converting a physical procedure into a *declared decision* whose correctness is
judged **post-hoc by replay**, never live. What is missing is not a mechanism; it is **the named
principle behind those seven**, and **a decision rule for classifying future tasks** (e.g. femoral pulse,
for which no content exists yet). This document supplies both: name the existing principle, then give the
extension rule.

**Real-world anchor #1 — the technician's daily flowsheet.** A live veterinary flowsheet (SmartFlowSheet)
is a rolling 24-hour grid: MONITORING (attitude, RR, HR, MM, BP, catheter/vein check, temperature,
weight, vet sign-off, labs), ACTIVITY, FLUID lines with additives, MEDICATION rows carrying dose + route
(e.g. *Buprenorphine 0.4 mg IV*), and PROCEDURE — cells colour-coded (yellow = recorded, purple = BP),
current hour boxed. This grid is not a documentation afterthought; it is the mental model technicians
inhabit every shift, and it is **already an analog of VetCrew's event log**: a timestamped,
role-attributed record of *declared* clinical actions. When a tech writes `HR 80` in the 14:00 column,
that cell is a declared action-event; when they chart *0.4 mg IV*, that is a `med_admin` declaration. The
flowsheet is the shared vocabulary the substitute actions should speak — the strongest possible answer to
the "don't reduce it to a button" constraint (§2, invariant 4).

**Real-world anchor #2 — the memorized dilution sheet (מהילת תרופות).** Technicians also carry a
drug-reconstitution/dilution reference *by heart*: per drug, the **powder concentration → a preparation
recipe (how much diluent, and which — saline vs D5W) → the resulting final concentration → infusion rate
and special handling** (e.g. Meropenem 1000 mg → 10 mg/ml, IV over 15–30 min; Nitroprusside light-
protected CRI; Cellcept handled with gloves; Hexakapron urine sample first; Baytril diluted 1:1–1:4).
This surfaces a **cognitive kernel the current `med_admin` widget does not fully capture** —
*preparation/reconstitution*, which sits upstream of the dose→volume calculation `med_admin` already
does (`packages/engine/src/evaluate-tasks.ts:154`). And "by heart" is the sharpest statement of invariant
3 (no coaching): the substitute must require *recall*, so the widget must never show the recipe.
Wrong-diluent, wrong-rate, and wrong-final-concentration are exactly the non-commoditized decision-test
anchors of `CLAUDE.md §2.1/§2.7` — siblings of the route-error and priority-inversion failure modes
already recorded.

---

## 1. The category — what "physically impossible" actually means

A task is **physically impossible in a screen simulator** when its execution requires manipulating or
sensing physical matter the screen cannot host. The useful category is defined not by the *act* but by
decomposing every such act into two parts:

- **The motor/sensory shell** — the hands-on manipulation or tactile perception itself: threading a
  catheter into a vein, feeling a femoral pulse, seating a thermometer, depressing a plunger. A screen
  cannot reproduce this and should not pretend to.
- **The cognitive kernel** — the decisions and observations the act commits the trainee to: *whether* to
  do it, *when*, *in what order*, *with what parameters* (dose, route, volume, rate), and *how to
  interpret* what it yields. This is knowledge and judgment, and it is fully representable.

**Definition.** A physically-impossible task is any task whose *motor/sensory shell* is unhostable on a
screen but whose *cognitive kernel* is the actual training/assessment target. The examples in the brief
are members of this category, not the category itself:

| Task | Motor/sensory shell (lost) | Cognitive kernel (representable) |
|---|---|---|
| IV catheter | aseptic threading of the line | knowing the ordered steps; site/size choice; sterility sequence |
| Femoral pulse | tactile discrimination of the pulse | knowing *to* check it and *when*; interpreting weak/bounding → act |
| Temperature | seating the probe | knowing to measure; reading; recognising fever/hypothermia → act |
| Give medication | the physical injection | dose calculation; route selection; timing; the route-error trap |
| Reconstitute / dilute a drug | drawing up and physically mixing the vial | recipe recall; diluent choice (saline vs D5W); final-concentration derivation; infusion rate; special handling |

The category is open-ended: *any* future task decomposes the same way. The framework's job is to make
that decomposition routine.

---

## 2. The general framework — the substitution rule

> **Substitution rule.** Do not simulate the *doing*; capture the *deciding*. For any impossible physical
> task, represent it as the **smallest declaration that reveals whether the trainee knows what, when, in
> what order, and with what parameters to act — plus how to interpret its result** — recorded verbatim as
> a role-attributed event, with all correctness judged post-hoc by deterministic replay. The declaration
> should mirror the **charting act** the technician already performs for that procedure in real practice.

Four invariants make this rigorous rather than "just a button":

1. **Lossy in the motor dimension, lossless in the cognitive dimension.** The substitute deliberately
   discards the motor shell and must preserve the full cognitive kernel — every decision the real act
   forces (dose, route, order, timing, interpretation), with none pre-made for the trainee.

2. **Claim-scoping (the honesty rule).** *A substitute's score may make claims only about the cognitive
   kernel it captured — never about the motor skill it dropped.* "Ordered shave → disinfect → insert →
   secure → bandage correctly" is defensible evidence of **procedural knowledge**; it is *not* evidence
   the trainee **can place a line**. The evidence record must phrase itself in kernel terms. This is the
   `CLAUDE.md §2.2/§2.3` liability boundary: a readiness record that says "knows the sequence" survives
   challenge; one that implies "can do it" from a drag-and-drop does not.

3. **No free coaching.** The declaration surface presents inputs only, never the expected answer, and
   never a live correct/incorrect signal. VetCrew already enforces this: answer keys (`expectedMl`,
   `expectedRouteId`, expected order, vital targets) are stripped in `stripBody`
   (`packages/engine/src/views.ts:125`; wire schema `packages/shared/src/live-contracts.ts:108`) before
   state crosses the wire, and the reducer accepts wrong submissions unchanged — *"wrong ANSWERS are
   never rejected here"* (`packages/engine/src/reducer.ts:198`). Verdicts live solely in the post-hoc
   evaluator (`packages/engine/src/evaluate-tasks.ts`). Any new substitute inherits this or it corrupts
   the assessment.

4. **The declaration is a real clinical behaviour, not a UI token.** Anchor the substitute on the
   documentation act that accompanies the procedure in practice — the flowsheet cell, or the memorized
   dilution recipe. Charting the wrong route, an out-of-range value, or an omitted required entry are
   genuine, assessable clinical errors. This keeps the substitute tied to competence (procedural
   knowledge, situational awareness, decision-making) instead of collapsing into an arbitrary click.

### The decision framework — classify by kernel, then pick the mechanism

For a new impossible task, name its cognitive kernel, then read the mechanism off this table. (The
right-hand column is VetCrew's *existing* vocabulary — the seven patterns are the instantiation of this
rule, not a coincidence.)

| If the kernel is primarily… | …the substitute is a declaration of… | Existing VetCrew form |
|---|---|---|
| Parameter correctness (dose/volume/rate) | a computed number + selected route | `med_admin`, `fluids_setup` |
| Preparation / reconstitution (recall + calculate) | diluent chosen + volume + derived final concentration + rate | *extends* `med_admin` (gap — see §6) |
| Observation / measurement readout | a read + transcribed value, interpreted | `value_entry` |
| Selection among discrete options | the chosen option(s) | `tube_choice`, `choice_chain` |
| Ordering / sequencing | the ordered steps | `step_order`, checklist `action_before` |
| Recognition + timing | *that* and *when* you acted | `escalate`, checklist `action_performed(withinMs)` |
| Omission / contraindication | that a forbidden act did **not** occur | checklist `action_not_performed` |
| Communication / closed-loop | a spoken callout to the crew | free-form `action` (verbal) |
| **Pure motor skill, no assessable decision** | — *nothing representable* — | **refuse; out of 2D scope** |

Checklist rule kinds are `action_performed(withinMs)`, `action_not_performed`, and `action_before`
(`packages/engine/src/checklist.ts:9`).

**Negative claims need an explicit opportunity window.** An omission/contraindication kernel
(`action_not_performed`) must be bound to a defined **trigger + evaluation interval** — the window in
which the forbidden act *would have been* the wrong thing to do. Absence from the entire event stream is
not sufficient evidence that a trainee *decided* against it; they may simply never have reached the
decision point. (This mirrors the engine's own `action_before` rule, which **vacuous-passes when the
hazard never occurs**, `checklist.ts:95` — the same principle: a non-occurrence only scores against a
realised opportunity.) So a substitute that scores "did not do X" must author *when* the opportunity was
live, not just check the whole log for X's absence.

The last table row is load-bearing (see §5): if decomposition leaves a kernel that is *only* tactile
discrimination or manual dexterity, the framework must **refuse to substitute** and flag the task as
out-of-scope for a 2D sim — not fake it.

---

## 3. Candidate mechanisms and trade-offs

Four mechanisms can carry a substitute. They are not competitors; they are specialisations, and a single
task often pairs two (a structured declaration for the technical kernel + a verbal callout for the CRM
kernel). VetCrew already runs two scenario shapes that use these differently: **deterioration scenarios**
use free-form `action`s + a weighted checklist (`scenarios/base-rung-resp-distress.json`);
**stepped-task scenarios** use `task_submit` body-kind widgets scored by expected-vs-actual
(`scenarios/base-rung-stepped-tasks.json`). A uniform "task surface" description would be wrong — the
mechanisms below span both.

### Mechanism A — Structured declaration (menu / entry / order widget)
The trainee declares the decision through a typed widget: enter a value, compute a dose and pick a route,
order the steps, select the set. Recorded as `task_submit`; judged post-hoc.
- **Trains/assesses:** parameter correctness, selection, sequencing, calculation — the technical axis, at
  high resolution, with a `critical` flag for fatal-class errors (e.g. SC-only drug given IV,
  `evaluate-tasks.ts:154`).
- **Strengths:** highest technical fidelity; verbatim, role-attributed, evidence-seq-traceable;
  tamper-evidence-bindable at scoring time (`server/evidence-attest.ts:33`); already built and tested;
  maps directly onto flowsheet cells.
- **Weaknesses:** says nothing about whether the trainee *communicated* the act; can feel like data entry
  if the kernel is thin; needs authored expected-answers per task.

### Mechanism B — Observation / value-reveal (read-and-interpret)
The "measurement" is represented by a value the trainee must read from the monitor/patient surface,
interpret, and act on. Implemented as `value_entry` today.
- **Trains/assesses:** situational awareness, vitals interpretation, transcription accuracy, and — **only
  if gated** — the *initiative to check*.
- **Critical sub-decision — passive vs gated.** Verified: `MonitorZone` renders *every* vital in the role
  view continuously, formatting `temp` to one decimal (`src/pages/StationPage.tsx:194`, value render at
  `:267`). So a `value_entry` "measure temperature" as built assesses **attention/interpretation**, not
  the initiative to check — the number is already on screen. This forks:
  - **Passive** (monitor-sourced: HR, RR, BP, SpO₂ — the multiparameter monitor shows them anyway) →
    tests interpretation. Faithful to the ICU monitor.
  - **Gated** (tech-sourced: temperature, weight, MM, pulse quality, catheter check — on the real
    flowsheet these are *manual* tech acts, blank until measured) → the value is revealed only after a
    declared "I am checking" action. Preserves the **recognition/initiative** competency and is *more*
    faithful to the flowsheet than passive display.
- **Strengths:** natural, low-friction, flowsheet-native; gating is a cheap lever that recovers a whole
  competency.
- **Weaknesses:** passive mode silently overclaims (looks like it tests "checking" but doesn't); gating
  adds an interaction step and must be authored per row.

### Mechanism C — Injected result the trainee must respond to (trainee-facing)
The physical act's *consequence* arrives as a state change the trainee did not perform — the patient
crashes, a monitor artifact appears, a value shifts. The trainee's substitute action is their
**response**. (Framed strictly from the trainee's side; instructor-console trigger design is out of
scope. VetCrew already does this: submitting the fluids task `t6` auto-fires `t7-abnormality`, crashing
HR to 44 — `scenarios/base-rung-stepped-tasks.json:20`.)
- **Trains/assesses:** recognition under load, prioritisation, closed-loop response — not the act itself;
  drives the escalation-latency metric `timeToNoticeMs` (`evaluate-tasks.ts:31`, `:277`).
- **Strengths:** the only clean fit when the act carries *no trainee decision* (something happened *to*
  the patient, or a senior did a maneuver) and the assessment is the crew's reaction.
- **Weaknesses:** assesses response, not execution; over-used, it turns a live trainer into a scripted
  event chain (`CLAUDE.md §4` warns against dense auto-triggers).

### Mechanism D — Declared verbal action / closed-loop callout
The trainee *states* the act as a callout ("IV access secured, 18-gauge left cephalic"). Recorded as a
free-form `action`.
- **Trains/assesses:** the non-technical axis — closed-loop communication, team situational awareness —
  the moat (`CLAUDE.md §2.1`), and omission/timing via checklist rules over the callout stream.
- **Strengths:** captures the CRM axis nothing else touches; cheap to author; pairs with any mechanism.
- **Weaknesses:** lowest technical-correctness resolution alone (a callout can be fluent and wrong); needs
  pairing with a structured declaration or instructor judgment to score technique.

---

## 4. Recommended default

**Default to Mechanism A (structured declaration mirroring the flowsheet entry) + a paired Mechanism D
verbal callout, judged post-hoc.** Reach for B when the kernel is observation (and decide passive vs
**gated** deliberately — gate tech-sourced values), and C when the act carries no trainee decision and
the assessment is the response.

Why A is the spine:
- **Every** mechanism here writes a role-attributed, verbatim, seq-ordered, tamper-evidence-bindable
  event — Mechanism D's callout is an `ActionEvent`, and §6 groups both `ActionEvent` and
  `TaskSubmitEvent` into the same append-only log. What is distinctive about A is not that it is logged
  but that it logs a **structured submission comparable to an authored expected answer** — so it yields a
  high-resolution technical verdict (per-field expected-vs-actual, with a `critical` flag), which D's
  free-text callout cannot. A is the spine because it carries *scoreable technical decisions*, not because
  it is the only auditable event.
- It judges correctness **post-hoc**, so it never coaches (invariant 3).
- It is already implemented across seven body kinds — the default is *description of what works*, not new
  build.
- Anchored on the flowsheet cell, it is a **real clinical charting act**, defeating the "just a button"
  failure by construction (invariant 4).

Pairing D with A is deliberate: A scores *what* the trainee decided; D scores whether they *closed the
loop* on it. Technical and non-technical are stored on separate axes anyway, so one physical act
naturally yields evidence on both.

**How the pairing is correlated (so "closed the loop" is evidenced, not assumed).** A callout `action`
and its structured `task_submit` are joined over the event log by three keys, all already present on the
events: shared **`actorId`/`role`** (the same person declared and called out), a **bounded time window**
(the callout falls within an authored interval around the submission — reuse the `withinMs` timing
primitive), and, where authored, an explicit **task/action reference** naming which declaration the
callout is about. A "loop closed" verdict is then a join query over the log — *this actor submitted the
med decision at seq N and called it out within the window* — not an inference. Where the join fails
(callout absent, wrong actor, or out of window), the technical decision still scores on A; only the
closed-loop communication credit is withheld. Absent an explicit task reference, the time-window +
actor join is the fallback and should be treated as weaker evidence, exactly as a real debrief would.

---

## 5. Worked examples — including the discriminating test

**IV catheter (easy case).** Kernel = ordered aseptic sequence + site/size choice. → Mechanism A,
`step_order` (shave → disinfect → insert → secure → bandage), optionally a `choice_chain` for site/gauge,
paired with a D callout. Claim-scoped evidence: *"orders catheter placement correctly and selects an
appropriate site"* — **not** *"can place a line."*

**Give medication (the trap case).** Kernel = dose calc + route selection + the fatal route error. →
Mechanism A, `med_admin`: given 20 mg and 100 mg/ml, the trainee computes 0.2 ml and picks SC, with IV
flagged `critical` (`evaluate-tasks.ts:154`). Mirrors the flowsheet medication row (dose + route).
Evidence: *"computes dose and selects route correctly; avoids the SC→IV route error."*

**Drug reconstitution / dilution (the recall-and-calculate case — a `med_admin` gap).** Kernel = recall
the recipe + choose the diluent + derive the final concentration + set the rate + apply special handling.
→ Mechanism A, an *extended* structured declaration: pick diluent (saline / D5W), enter diluent volume,
declare the resulting final concentration, set the infusion rate, and flag special handling — all from
memory, recipe stripped from the view (invariant 3). Example: Nitroprusside → declare D5W, correct volume
to 1 mg/ml, CRI, light-protected; a wrong diluent, wrong final concentration, or omitted light-protection
is a `critical`-class error. This is the one kernel the current `med_admin` widget only partially covers
(dose→volume + route, not the reconstitution chain — see §6). Claim-scoped evidence: *"correctly
reconstitutes drug X: diluent, final concentration, rate, and handling"* — a defensible pharmacological-
knowledge claim, not "can safely draw up and run the infusion."

**Temperature (the passive/gated case).** Kernel = initiative to measure + interpretation. Temp is
tech-sourced, so **gate it**: blank until a declared "checking temperature" action reveals the value,
then `value_entry` for the reading + interpretation. **Gating alone is necessary but not sufficient** —
revealing the value after a declaration only proves the trainee *can* click "check," not that they knew
*to* check unprompted. To actually score initiative, the gate must be bound to a **cue and a timing
rule**: an authored trigger makes the check *due* (a deterioration cue, a shift-protocol interval, a
post-intervention window), and a checklist rule scores whether the declared check landed in time —
`action_performed(withinMs)` against that cue, or `action_before` a competing task. Without that
trigger+timing binding, "gated" degrades back to testing interpretation only. Passive display (current
behaviour) drops the initiative claim entirely. Honestly-scoped evidence — gated *and* cued:
*"recognises the need to measure temperature in time and interprets it"*; passive: *"interprets a
displayed temperature."* Same widget, three different — and honestly scoped — claims.

**Femoral pulse (the discriminating test — no content exists yet).** The case that proves the framework
is real, because its clinical content is *almost entirely tactile*. Decompose:
- **(a) Knowing *to* check the pulse, and *when*** (e.g. before reaching for IV access; on a
  deterioration cue) → **representable.** Mechanism A/D: a declared "check femoral pulse" action, scored
  for presence and timing (`action_performed(withinMs)` / `action_before`) and for prioritisation (did it
  precede the wrong-order act — the `CLAUDE.md §2.7` "priority inversion" failure mode).
- **(c) Interpreting the result → act** (weak/thready vs bounding vs absent → escalate / start
  compressions) → **representable.** Gated value-reveal (Mechanism B): on the declared check, the sim
  reveals a qualitative pulse state to interpret and act on; or Mechanism C: the pulse finding is the
  injected cue the trainee must respond to.
- **(b) The tactile discrimination itself** — actually feeling whether a pulse is present and its quality
  → **NOT representable. Refuse.** The framework flags this kernel as out-of-2D-scope and does not fake
  it. Claim-scoped evidence: *"knows to check the femoral pulse, prioritises it correctly, and acts
  correctly on the finding"* — explicit that it did **not** assess tactile skill. This is exactly a §7 /
  ADR-001 WebXR revisit trigger ("a competency that genuinely cannot be assessed in 2D — motor skill, not
  knowledge").

Femoral pulse demonstrates both halves of the framework in one task: substitute the representable kernel
(to-check, when, interpret-and-act), refuse the unrepresentable one (tactile discrimination), and let the
claim-scoping rule keep the evidence record honest about the difference.

---

## 6. How this maps onto the existing system (grounding, not new build)

- **The seven body kinds are the instantiation of the rule** (§2 decision table). The framework names the
  principle; it invents no new mechanism.
- **The event log is the flowsheet.** Each declaration is an append-only, role-attributed, seq-ordered
  `ActionEvent`/`TaskSubmitEvent` — the digital form of a charted flowsheet cell.
- **Declared vs verified is already the central axis:** the reducer records *what was entered* verbatim
  and never judges (`reducer.ts:198`); verdicts exist only in the post-hoc evaluator with `evidenceSeqs`
  (`evaluate-tasks.ts`). This *is* invariant 3.
- **Claim-scoping needs surfacing, not building:** the machinery (per-dimension results, evidence seqs,
  attestation) exists; what this document adds is the *rule* that scored labels and AAR copy must speak in
  kernel terms ("knows the sequence"), never motor terms ("can place a line").
- **Value-reveal gating is one concrete lever** the current build does not yet pull: `MonitorZone` shows
  all vitals continuously (`StationPage.tsx:194`), so tech-sourced rows are passive today. Gating them is
  a future authoring choice, not a rewrite.
- **Reconstitution/dilution is the one genuine content-model gap.** `med_admin` captures dose→volume +
  route (`evaluate-tasks.ts:154`) but not the diluent-choice → final-concentration → rate →
  special-handling chain the memorized dilution sheet encodes. This is the single place the framework
  points at *new* representation work (an extended `med_admin` or a sibling `dilution` body kind) rather
  than just naming what exists — a rich seam for `CLAUDE.md §2.1/§2.7` decision-test anchors
  (wrong-diluent, wrong-rate, missed light-protection).

---

## 7. Coherence checks (this is the verification method for a conceptual doc)

1. **Extensibility check — femoral pulse.** The framework must handle a task with *no* existing content
   and a mostly-tactile kernel. §5 does this end to end, including the refusal. ✔
2. **Anti-"button" check.** Every mechanism ties its substitute to a named competency and to a real
   clinical documentation act — a flowsheet cell or a memorized dilution recipe; none is a bare click. ✔
3. **Honesty check.** The claim-scoping rule (invariant 2) is applied in every worked example's evidence
   statement. ✔
4. **Discrimination check.** Applied to a *new* artifact (the dilution sheet), the decision rule did not
   trivially absorb it — it correctly surfaced reconstitution/dilution as a kernel the existing widgets
   only partly cover (§6 gap), rather than pretending `med_admin` already handled it. A framework that
   maps everything onto what exists isn't discriminating; this one flags genuine gaps. ✔
5. **Consistency-with-frozen-model check.** No conflict with the event-sourced core, the strip-answers
   projection, post-hoc scoring, the two scenario shapes, or the two colour systems; injection is framed
   trainee-side only. ✔

---

## Requirements coverage (maps back to the original brief)

| Original requirement | Satisfied in |
|---|---|
| Define the general category (not just the four examples) | §1 (motor shell vs cognitive kernel; open-ended) |
| A reusable principle / decision framework for any such task | §2 (substitution rule + invariants + classify-by-kernel table) |
| 2–4 candidate mechanisms with trade-offs | §3 (Mechanisms A–D) |
| Recommend a default | §4 (A + paired D, post-hoc) |
| Tie each substitute back to what it trains/assesses | §2 invariant 2 + every §3 mechanism + every §5 example |
| Scoped to the trainee role-station; consistent with the scenario model | throughout; §3 (two scenario shapes), §6 (event log, checklist, injections) |
