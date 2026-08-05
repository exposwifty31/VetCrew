# Readiness Scoring Doctrine

**Status:** authoritative. This document versions the scoring doctrine that previously
lived only in an installed plugin skill (`vetcrew-readiness-scoring`) that a clean
checkout cannot read — the failure recorded in `CLAUDE.md` §4 on 2026-07-30. What is
written here governs; `CLAUDE.md` §4/§2.2/§6 summarize it and must not drift from it.

## The posture: evidence, not verdicts

VetCrew produces **evidence for a hiring conversation, not a score that decides one**
(CLAUDE.md §2.2). A replayable, role-attributed record that a manager reviews is
defensible; a number from one live rater is not. Any score that could influence a
hiring decision must be traceable to specific timestamped, role-attributed events
(§2.3) — no black-box scoring, ever.

This is not our invention; it is how the field behaves. AVECCTN — the veterinary ECC
credentialing body — uses single-rater binary sign-off for its 42-item skills list but
escalates to **three blinded raters** for its one consequential judgment (randomized,
de-identified case reports, recusal on recognition). Its competency verification rests
on first-hand observation of live, unaided performance — which a replayable,
role-attributed record is the defensible analog of.

## Two axes, stored separately

1. **Technical** — checklist/task evaluation, computed **post-hoc** as a pure query
   over the event log (`packages/engine/src/checklist.ts`). Every item result carries
   `evidenceSeqs`. No mid-run verdict events exist; correctness is never computed
   during a run (founder decision 2026-07-30; see §2.7 and the event taxonomy doc).
2. **Non-technical (crew resource management)** — human-rated on the **ANTS**
   instrument, four domains: task management, team working, situation awareness,
   decision-making. Ratings bind to evidence event seqs and to a frozen log head
   (`log_head_seq` / `log_head_hash`) at rating time — tamper-evident attestation
   (PR #18).

## ANTS is frozen — and was challenged and upheld

In the canine-CPR context — exactly ours — the JVME Jan 2026 reliability study
(Hoehne, Kim & Cary; 7 video recordings, 3 raters) measured overall-score reliability:

| Instrument | ICC (overall) |
|---|---|
| **ANTS** | **0.803 / 0.925** |
| OGRS | 0.726 / 0.888 |
| T-NOTECHS | 0.716 / 0.883 |

An external memo (reviewed 2026-07-30) recommended switching to T-NOTECHS on
structural-fit grounds (five trauma-team domains) while citing these same numbers.
Declined: structural fit does not outrank measured reliability in the target setting,
and the memo recommended the least reliable of the three instruments tested.
**Revisit only if a study measures T-NOTECHS as more reliable in a veterinary crew
setting.**

Per-domain scores are directional only — the same study found several individual
domains below ICC 0.75 in every instrument tested. Only overall scores may drive
anything consequential.

## The rater rules

- **One live rater = formative feedback only.** Never a hiring input.
- **Consequential (hiring) judgments need three raters** — the threshold the CPR
  reliability literature and AVECCTN's own practice independently converge on.
- **At the pilot site there is exactly one qualified rater.** Therefore any
  inter-rater target (e.g. "two raters, ICC ≥ 0.75") is achievable only via
  **recorded sessions scored asynchronously by raters sourced outside the hospital**
  (other ECC-credentialed technicians, remote). A proposal that names an inter-rater
  gate must name where raters two and three come from, or the gate is decoration.

## Withheld until N exists

- Cross-person readiness bands: the manager API returns `cohort_insufficient` and the
  UI never shows a band. No normative distribution exists (§6.2); a verdict without N
  is an opinion with a number attached.
- The **within-person** axis (a technician against their own earlier sessions and
  time-in-training) needs no norms and serves the refresher use case immediately.
  `trainee_time_in_training_days` is captured on every scored session from the first,
  because the axis cannot be backfilled (§4).

## Clinical gate

No scenario scores a real person until it carries `clinically_reviewed: true` with an
identifiable reviewer (DB-enforced: `vc_scenarios_reviewer_required`). The
`VETCREW_ALLOW_UNREVIEWED_SCORES` escape hatch is CI/local-only and must never be set
in production (§2.5, §8) — enforced at boot since 2026-08: `loadEnv` refuses to start a
production server carrying this flag, and the ratings route ignores it in production.
