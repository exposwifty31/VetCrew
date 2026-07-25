# VetCrew "Mountain" — Decision Memo

**Date:** 2026-07-23 · **Updated:** 2026-07-25 (Run C synthesis folded in) · **Evidence base:** deep-research runs A (strategy) + B (content), each 3-vote adversarially verified. Run C (modality) is a **user-supplied synthesis** (not 3-vote adversarially verified) that corroborates the prior design decision — see Q3. Every load-bearing A/B claim below carries a run tag `[A#]/[B#]`, a confidence, and a source; C tags are synthesis-confidence only.

---

## Headline decision

**The mountain survives as the product vision, but NOT as the wedge — and the evidence sharpens both halves.**

- As the **expansion vision** (altitude = competence = time-in-training, made literal): **accept.** B5 makes the axis concrete — the recognized entry→advanced-competence window in vet ECC is multi-year (6,000 ECC hours, ~3 yr FTE), so "readiness relative to time-in-training" is a real, long axis, not an abstraction.
- As the **wedge** (the thing you ship first): **reject the mountain, ship one rung.** The mountain fails wedge-narrowness by construction, and — critically — it does **not** reduce the behaviour-change cost that CLAUDE.md §2.4 already flags as VetCrew's weakest dimension. The research found a severe, cited analog of exactly that failure.
- The **solo-base / team-summit split survives with one correction the evidence forces:** the solo base trains **individual/technical** competence; the **non-technical / team axis — the moat — must live at the team tier and must not be solo-ized.** Aviation doctrine argues directly against solo-delivering team-skills practice.

---

## Wedge test (re-run on evidence)

**Verdict: the mountain FAILS as a wedge. A single base rung, near-zero-friction, PASSES.**

| Test | Result | Evidence |
|---|---|---|
| 1. Acuteness of pain | **Unproven** | The acute pain (attrition/burnout in ER/ICU) was **unanswered** by the research [B9]. What's documented is an *institutional* gap — the entry→competent middle is "almost entirely unstructured" [B, summary] — not a daily complaint someone adopts to relieve. |
| 2. Behaviour-change cost (Gate 0) | **FAIL — the decisive one** | A resident-**requested** competency-progression curriculum hit **zero uptake in 3 months** — no resident completed any assessment, no supervisor did any — because clinical service demand outranks training [A4, high]. Participants concluded a *voluntary* ladder "is not viable"; mandated, leadership-enforced completion was judged a precondition [A, run detail]. The mountain does not lower this cost; someone still has to run a sim. |
| 3. Scope narrowness | **FAIL by construction** | The mountain is the whole progression. A wedge is one rung, one persona, one moment. |
| 4. Time-to-value | **Mixed** | A base rung can pay off fast; but the *longitudinal* payoff is multi-year [B5]. The compounding-data value is a bet, not a wedge. |
| 5. Beachhead | **OK** | Unchanged: the ER/ICU training lead / department manager at the pilot site. |

**Narrowed wedge that passes:** *"An ER/ICU training lead runs one short, single-role technical-competence scenario for one new tech and walks away with a replayable, role-attributed record — with near-zero setup and no scheduling of other people."* One rung. The base. Technical, not team.

**Consequence flagged by A4:** design the first rung so it survives without voluntary compliance — either it rides on something staff already do, or it is leadership-mandated. A "nice-to-have solo trainer" is the exact profile that got zero uptake.

---

## Moat scorecard (re-scored on evidence)

| Mechanism | Score | Reason (evidence) |
|---|---|---|
| Switching cost | 1 | No evidence either way; nothing proprietary locks a hospital in yet. |
| Data moat | **2** (was 3) | The longitudinal competence-vs-time asset is real [B5] but slow to compound and **unproven** — no surviving evidence that learners even climb solo→team [A6], and whether progression data is defensible vs copyable is **unanswered** [A5]. |
| Embedded workflow depth | 1 | No evidence. |
| Network effects | 0 | Single-site; honestly absent. |
| **Trust / compliance** | **3** (was 2 — now the strongest) | The vet ECC credentialing body itself uses **single-rater binary** sign-off for skills but escalates to **three blinded raters** for its one consequential judgment [B4, high] — independently converging on CLAUDE.md §2.2's 3-rater threshold, from inside the domain. Credentialing rests on **first-hand observation of live, unaided performance** [B2, high] — VetCrew's replayable, role-attributed record is a defensible analog of exactly that. |
| Economies of scale | 0–1 | No evidence. |

**Top moat to invest in: Trust/compliance.** The concrete asset is the **auditable, role-attributed, multi-rater-capable evidence record** — because the domain's own credentialing body already behaves this way (B4 is the strongest single corroboration in the run). **Data moat second**, but treat it as slow.

**Weakest point a competitor hits first:** not the ladder. A5 could find **no evidence a competency framework is a defensible asset** — they get copied and re-skinned (the wider run noted ANTS being adapted into derivative instruments). So the progression *structure* is not the moat; the **evidence record + validated veterinary NTS anchor points** (the flagged IP, none of which exist yet) are. This confirms CLAUDE.md §2.6: don't defend the ladder, defend the record and the vet-native NTS instrument.

---

## The single strongest positive result

**B0 (high): the non-technical axis is entirely absent from the vet ECC credential's task inventory — all 42 skills are technical procedures / clinical-sign recognition / dose calculation.** A mechanical keyword grep for communication, teamwork, leadership, handoff, situational, closed-loop, crew, debrief returned **zero matches.** This is hard, documented confirmation of CLAUDE.md §2.1's central thesis: nobody scores veterinary crew non-technical skills, and that whitespace is the product. The moat lives here — but as the *instrument*, not the ladder.

---

## What the evidence changes in CLAUDE.md (proposed — not yet applied)

1. **§2.4 (solo mode as adoption vehicle)** — rewrite around the evidence: the *base rung* is the adoption vehicle, and it must be **technical/individual and near-zero-friction or leadership-mandated**, because voluntary progression training has a documented zero-uptake failure mode [A4]. Add: the non-technical/team axis is **not** solo-ized [A1].
2. **§2 — add a product truth (2.7):** *"The mountain is the expansion vision, not the wedge. Ship one rung. The progression structure is not defensible [A5]; the evidence record and the veterinary NTS instrument are [B0, B4]."*
3. **§2.2 / §2.3 (evidentiary bar, auditability)** — strengthen with B4: the domain's own credentialing body uses 3 blinded raters for its consequential judgment and single-rater binary for formative skills. This is external corroboration, not just our design choice — cite it.
4. **§5 (build order) + §3/§4 (architecture)** — the MVP framing shifts from "one CPR crew scenario" toward **"one base rung: a single-role technical-competence scenario producing a role-attributed record,"** with the full-crew summit as the differentiator that follows. Architecturally this is **Engine Alpha first** (the clock-agnostic procedural FSM = the frozen reducer), with Engine Beta (real-time ticker) at the summit — both over the one event log. Add the split-engine framing to §4 as a refinement of the frozen single-engine-per-session core, and record the Alpha→Beta difficulty-coupling as a §7-style roadmap item, not a frozen constraint. (Interacts with Open Decision #1 — first scenario.)
5. **§4 (frozen) — data model:** B5 supports keeping the **time-in-training field** from the first session (already planned), and B6/B7 note that an entry-level national task inventory already exists (AVMA CVTEA Essential Skills List) — VetCrew should map its base rung onto that inventory rather than invent one.
6. **§6.2 (no normative data)** — partly relieved: altitude gives a **within-person** progression axis that needs no cross-person norms for the refresher use case; the hiring verdict still needs N. No change to the withhold-the-verdict rule.

---

## Q3 — Modality: RESOLVED (design decision 2026-07-23; corroborated by C synthesis 2026-07-25)

**Decision: split-engine, single-backbone.** Two execution modes over one shared telemetry ledger:
- **Engine Alpha — procedural/base:** a deterministic finite-state machine, **clock-agnostic / stepped** (time freezes between inputs). Discrete sequential actions, localized binary validation. This is the base of the mountain.
- **Engine Beta — team/summit:** a **real-time event-loop ticker**; time is an active parameter, clinical params decay per tick, asynchronous concurrent inputs. This is the summit.
- **Shared backbone:** one monolithic state + progress-telemetry schema (append-only event ledger) under both engines. Alpha's per-action error telemetry (e.g. a repeating decimal-shift or line-validation habit) becomes an **initialization payload** for Beta, which raises the volatility of the matching failure mode in the live scenario. *"The base directly controls the physics of the summit"* — without merging two contradictory loops in code.

**Status:** originally a **design decision** (Dan, 2026-07-23) because the first deep-research Run C failed adversarial verification (infrastructure/rate-limit collapse; only aviation-regulation claims reached a verdict). On 2026-07-25 a **user-supplied C synthesis** was folded in. That synthesis was **not** 3-vote adversarially verified — treat C tags as synthesis-confidence, not as A/B-grade confirmed claims. It does **not** replace the design decision; it **corroborates** it and sharpens the pedagogy around it.

### What the C synthesis corroborates

| Tag | Syn. conf. | Load-bearing point | Implication for VetCrew |
|---|---|---|---|
| **C0** | high | Part-task reduces intrinsic load; transfer to whole-task is mixed; Pure Insertion Hypothesis fails. | Base rung may isolate a procedure, but must still be a *small whole technical task*, not a naked drill. |
| **C1** | high | 4C/ID: whole-task of increasing complexity is the curricular backbone; part-task is zoom-in when load blocks performance — not a long serial "technical forever, team much later" ladder. | Compatible with ship-one-rung: base = small technical whole-task; summit = where crew/NTS load enters. |
| **C2** | medium | Procedural work inside time-pressure before motor automation → overload / freeze / skill collapse. | Supports Alpha (clock-agnostic) before Beta (live clock). Do not shove novices into tick-driven scenarios to "build resilience." |
| **C3** | high | Teaching team/comms as a checklist kills psychological fidelity; NTS needs dynamic, charged context. | Reinforces B0: NTS lives in the event-attributed evidence record at the summit — never as a V-check on the solo base. |
| **C4** | medium | Mature platforms unify modalities via **shared patient/world state + middleware** (military LVC/DIS/HLA; medical MoHSES/AMM + DDS + physiology engine): part-task modules publish, scenario surfaces subscribe. | Unifies *state + record*, not "one code loop for everything." Maps to VetCrew's append-only event log / shared session state — not a mandate for DDS/hardware federation in v1. |
| **C5** | medium | Durable progression needs a shared learning record across modalities (xAPI→LRS; SimCapture-style AV+checklist+LMS). | Same idea as the frozen event log. Do **not** adopt xAPI/SimCapture as stack for v1 — the pattern is the corroboration. |
| **C6** | high | MSR's working answer to A4-style abandonment: **mandate** (NITE licensing) + in-situ delivery + academic embedding; pedagogically hardware + SPs in one scenario. | Confirms A4 consequence: base rung must be near-zero-friction **or** leadership-mandated. Mandate is institutional, not a product feature VetCrew ships alone. |
| **C7** | medium | Local vet path: Koret skills lab (part-task + timed CPR + live stable patients); RECOVER TFCPR treats NTS as first-class in resuscitation. | Grounds summit content in RECOVER-aligned crew scenarios already in CLAUDE.md frozen list. |
| **C8** | low | *Recommendation* (not finding): map interventions + closed-loop events into a multidimensional record without replacing CVTEA/AVECCTN skill definitions. | Already aligned with B6 + evidence-not-verdict posture. |

### How to read "unified architecture" vs split-engine (do not smooth)

C4's language about unifying modalities sounds like a single engine. Read carefully: what those architectures unify is the **shared patient/world state and the performance record**. Execution surfaces (part-task module vs full-scenario) remain distinct publishers/subscribers. That is exactly **two execution modes over one backbone** — not a refutation of Alpha/Beta.

### Reconciliation with the frozen core

Engine Alpha = the pure deterministic reducer already frozen in CLAUDE.md §3/§4. Engine Beta = the tick-event scenario engine already frozen. The "single backbone" = the append-only event log already frozen as the source of truth. This refines one frozen engine into **two execution modes over one log**, rather than adding a second architecture. No frozen decision is broken.

### Honesty checks that still stand

1. **First deep-research Run C (automated):** the only claims that reached a verdict were about aviation regulation, and the verifier **refuted 3-0** the claim that FAA device qualification uses "a single backbone spanning all device levels." External regulation splits device *classes*. Justify the backbone from VetCrew's own event-sourcing + C4/C5 *analogs* — **not** as "how aviation certifies simulators."
2. **User C synthesis is not A/B-grade evidence.** It was not adversarially 3-vote verified. Useful for pedagogy and architecture pattern-matching; do not cite C tags as settled research in external pitches.
3. **What C does not license:** freezing Alpha→Beta difficulty coupling; adopting DDS / xAPI / SimCapture / MoHSES hardware federation as the v1 stack; claiming one code path for part-task and scenario loops.

**One element to hold as ambitious, not frozen:** the Alpha-error-telemetry → Beta-volatility coupling (base performance dynamically shapes summit difficulty) is a strong idea but an *unbuilt feature*, not a foundational constraint. Flag it as a roadmap item — the MVP (one base rung) doesn't need it.

## Explicitly NOT decided (honest gaps)

- **The acute pain itself** (attrition/burnout causes) [B9], **daily working-task inventories** from live ER/ICU hospitals [B9], and **nursing/EMS onboarding comparison** [B9] — all unanswered by A/B. If the base rung's content needs grounding, these are the next search.
- **Adversarial re-verification of C** — optional. The modality *decision* no longer depends on it; a 3-vote pass on C0–C5 would raise synthesis tags to confirmed claims, not change Alpha/Beta/backbone.

## Reversal conditions

- If the pilot manager's §6 answer says a raw role-attributed record is *not* what they'd trust, the Trust/compliance moat (now scored 3) is weaker than the evidence suggests.
- If attrition research (unanswered [B9]) shows the acute pain is scheduling/staffing rather than skill, the wedge persona may move.
- If building Engine Alpha reveals the base rung's procedural content genuinely needs a live clock (i.e. the "freeze time between inputs" assumption is wrong for some base skills), the split-engine boundary moves — the Alpha/Beta line is a design hypothesis, not yet tested against a built scenario.
- If a later adversarially verified Run C shows that shared-state architectures *require* a single real-time loop for both procedural and scenario work (contradicting C4-as-read-here), revisit whether Alpha can stay clock-agnostic.
