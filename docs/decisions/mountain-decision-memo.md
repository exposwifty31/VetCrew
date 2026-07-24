# VetCrew "Mountain" — Decision Memo

**Date:** 2026-07-23 · **Evidence base:** deep-research runs A (strategy) + B (content), each 3-vote adversarially verified. Run C (modality) is **under-verified — held for re-run**, so the one-engine-vs-two question is *not* answered here. Every load-bearing claim below carries a run tag `[A#]/[B#]`, a confidence, and a source; refuted claims are shown where they matter.

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

## Q3 — Modality: RESOLVED by design decision (Dan, 2026-07-23), not by research

**Decision: split-engine, single-backbone.** Two execution engines over one shared telemetry ledger:
- **Engine Alpha — procedural/base:** a deterministic finite-state machine, **clock-agnostic / stepped** (time freezes between inputs). Discrete sequential actions, localized binary validation. This is the base of the mountain.
- **Engine Beta — team/summit:** a **real-time event-loop ticker**; time is an active parameter, clinical params decay per tick, asynchronous concurrent inputs. This is the summit.
- **Shared backbone:** one monolithic state + progress-telemetry schema (append-only event ledger) under both engines. Alpha's per-action error telemetry (e.g. a repeating decimal-shift or line-validation habit) becomes an **initialization payload** for Beta, which raises the volatility of the matching failure mode in the live scenario. *"The base directly controls the physics of the summit"* — without merging two contradictory loops in code.

**Status: this is a design decision, not a verified research finding — recorded as such.** It is not cited as evidence anywhere above.

**Reconciliation with the frozen core — it fits cleanly, and largely *is* the frozen core, sharpened:**
- Engine Alpha = the pure deterministic reducer already frozen in CLAUDE.md §3/§4. Engine Beta = the tick-event scenario engine already frozen. The "single backbone" = the append-only event log already frozen as the source of truth. So this refines one frozen engine into **two execution modes over one log**, rather than adding a second architecture. No frozen decision is broken.

**One honesty check you must see (do not smooth):** the *only* Run-C claims that reached a verdict were about aviation regulation, and the verifier **refuted 3-0** the specific claim that FAA device qualification uses "a single backbone spanning all device levels." So external regulation does **not** cleanly support "one unified backbone" — it splits device *classes*. This does **not** sink the decision: VetCrew's single event log is a domestic frozen choice that stands on its own and does not depend on how aviation happens to certify simulators. But the split-engine model should be justified from VetCrew's own event-sourcing, **not** claimed as "how aviation does it."

**One element to hold as ambitious, not frozen:** the Alpha-error-telemetry → Beta-volatility coupling (base performance dynamically shapes summit difficulty) is a strong idea but an *unbuilt feature*, not a foundational constraint. Flag it as a roadmap item so it doesn't get frozen prematurely — the MVP (one base rung) doesn't need it.

## Explicitly NOT decided (honest gaps)

- **The acute pain itself** (attrition/burnout causes) [B9], **daily working-task inventories** from live ER/ICU hospitals [B9], and **nursing/EMS onboarding comparison** [B9] — all unanswered by the research. If the base rung's content needs grounding, these are the next search. (Run C's re-run remains available after 20:30 if you later want the modality decision backed by verified evidence rather than design judgment.)

## Reversal conditions

- If the pilot manager's §6 answer says a raw role-attributed record is *not* what they'd trust, the Trust/compliance moat (now scored 3) is weaker than the evidence suggests.
- If attrition research (unanswered [B9]) shows the acute pain is scheduling/staffing rather than skill, the wedge persona may move.
- If building Engine Alpha reveals the base rung's procedural content genuinely needs a live clock (i.e. the "freeze time between inputs" assumption is wrong for some base skills), the split-engine boundary moves — the Alpha/Beta line is a design hypothesis, not yet tested against a built scenario.
