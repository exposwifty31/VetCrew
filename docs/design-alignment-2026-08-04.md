# Design-to-code alignment audit — 2026-08-04

**Status:** findings of record. Three founder decisions are outstanding (§6) and block the next unit of work.

This audit cross-references the product model settled with the founder on 2026-08-03/04 — recorded in [`CLAUDE.md`](../CLAUDE.md) §1 — against the code that actually exists. It is not a build plan. It is an evidence list, so that the gaps are argued from file references rather than from memory.

Ten things align. Fourteen do not. One of the gaps silently blocks the three-rater requirement that the whole defensibility posture rests on.

---

## 1. What already aligns

| Design requirement | Code that supports it |
|---|---|
| Deterministic replay, append-only log, role attribution | `reduce`/`replay` in `packages/engine/src/reducer.ts`; `appendSessionEventsTx` as sole seq authority in `server/live/event-append.ts`; `role`/`actorId` stamped server-side in `server/live/socket.ts` |
| Assessment needs pre-set events at fixed times | `TriggerCondition` includes `{ kind: "time", atMs }` (`packages/engine/src/scenario.ts`); `base-rung-resp-distress` already fires `decompensation-at-150s` |
| Practice needs live instructor injection | Injection menu plus `authorizeIntent` permitting `injection` for instructor stations only (`server/live/socket.ts:145-175`) |
| Information hiding is real, not a permissions filter | `stripBody` (`packages/engine/src/views.ts:125-182`) removes every `expected*` field, drop factors and the abnormality trigger before anything crosses the wire |
| Crew mode: multiple roles in one session | `vc_role_stations` per-role rows; `taskVisibleToRole` filters by `def.role` (`views.ts:193-195`); the socket binds each trainee to its own role and broadcasts per-role snapshots |
| Vet as a participant role | `roles` is an arbitrary string array — `["technician", "veterinarian"]` is authorable today with no code change |
| Three raters storing three sets of scores | **No unique constraint** on `vc_ants_ratings`; `(session, rater, domain)` rows are free to multiply (`0001_init.sql:73-84`) |
| Within-person progression | Trend read model in `server/routes/manager.ts`, keyed on trainee |
| Seven interaction shapes for content | `TaskBodyDef` in `packages/engine/src/tasks.ts:56-99` |
| Hebrew-first with Latin clinical notation | `src/i18n`; monitor device-face exemption already frozen in CLAUDE.md §4 |

The spine is sound. **Nothing in the settled design requires replacing it.** Every gap below is additive.

---

## 2. Blocking gaps

### 2.1 Three raters are impossible today

The most important finding in the audit. The schema permits multiple raters; the route does not.

`server/routes/sessions.ts:492` requires `session.phase === "debrief"`, and lines 523-527 append `phase_change → scored` inside the same transaction as the rating insert. So the **first** rater's submission moves the session out of `debrief`, and raters two and three receive a 409 `wrong_phase`.

CLAUDE.md §2.2 and §6.3 say nothing consequential rests on a single rater. The code enforces exactly one. The contradiction has been latent because only one rater has ever existed.

**Fix shape:** decouple rating submission from the lifecycle transition. Ratings accumulate while the session sits in `debrief`; the transition to `scored` fires when the rating set is complete — which requires knowing what "complete" means (decision D2, §6).

### 2.2 No session mode

Nothing distinguishes practice from assessment. A search for `mode`, `practice`, `assessment`, `tutorial` across `server/` returns only Drizzle's `bigint({ mode: "number" })`.

Four consequences, all load-bearing:

- `authorizeIntent` cannot withhold pause and inject from an examiner, so "the examiner cannot intervene" (CLAUDE.md §1.1) is unenforceable and unevidenced.
- Practice and assessment sessions are indistinguishable in the log, so the manager trend would mix rehearsal with examination.
- A practice score can drift into an evidence packet.
- The mode cannot be shown to a candidate as proof nobody touched their run.

### 2.3 Time-in-training is a hard gate the founder has removed

`server/routes/sessions.ts:495` returns 422 `no_time_in_training` when `traineeTimeInTrainingDays` is null, and until 2026-08-04 CLAUDE.md §4 froze it as the axis everything is measured against.

Founder decision: there is no time-in-training metric; the 30 shifts are not visible to the system. **As written, no session can be scored at all.** Needs an explicit decision (D1, §6), not a quiet nullable.

---

## 3. Non-blocking gaps

### 3.1 No live-feedback projection for coaching

`roleView` deliberately strips every answer key, so correctness cannot be computed on the client. The engine holds the data; nothing exposes it.

Coaching needs a third projection — practice-mode only, computed server-side, never written to the log. **The no-verdict doctrine survives intact:** the rule governs the log and the trainee's view, not the concept of live feedback. The judgment is still computed over the log, just computed immediately instead of at debrief. The projection simply does not exist yet.

### 3.2 No sequential task reveal

`createTaskRuntime` (`packages/engine/src/tasks.ts:143-156`) marks every task `available` at once, and trigger effects are `VitalEffect` only, so no trigger can unhide a task. The tutorial's guided-discovery phase needs a task-level reveal condition or a new effect kind. **This is the one genuine engine addition the tutorial requires.**

### 3.3 Hidden tasks are shipped to the client

`roleView` (`views.ts:197-214`) includes hidden tasks with `hidden: true` and lets the client filter. Harmless for the current `escalate` task, whose body is empty. Wrong for sequential reveal, and a minor integrity concern in an assessment a candidate could inspect.

### 3.4 No tutorial-completion record

Nothing records that a person finished the familiarisation run, so the gate that makes candidates comparable (CLAUDE.md §1.3) cannot be enforced. No practice-session count is computable either, which is an agreed evidence-packet field.

### 3.5 No branching for practice reruns

`vc_sim_sessions` (`server/db/schema/sessions.ts:14-25`) has no parent pointer. Append-only means "rewind" is a fork: replay to a point, start a run pointing at its parent. Practice reruns currently have nowhere to land.

### 3.6 No mentor attribution

Sessions carry `traineeId` and nothing about who was shadowing. The indirect-evaluation signal in CLAUDE.md §1.6 requires mentor attribution recorded from the first session, since it cannot be reconstructed later. Cheap now, impossible retroactively.

### 3.7 `med_admin` pre-computes both steps of the Israeli formula

The body supplies `doseMg` and `concentrationMgPerMl` directly (`tasks.ts:59-72`), and `t3` hands the trainee 20 mg at 100 mg/ml. The Israeli standard is weight × mg/kg for the total dose, then total ÷ available, where a percentage concentration converts at ×10 (5% = 50 mg/ml). **Both cognitive steps are currently done for the candidate.**

### 3.8 Four interaction shapes missing

- **Prioritisation** across multiple patients. Highest value — it is the triage competency paper cannot reach and the founder named it first. `step_order` is not a substitute: it sequences a known procedure rather than judging which patient deteriorates first.
- **Image identification.** Needs an asset pipeline more than code.
- **Duration-constrained action**, where the correct answer is a length of time. The checklist's `withinMs` measures when something started, not how long it was held.
- **Repeated rhythm.** Essentially CPR alone, and better served by an instrumented manikin — which is the deferred physical-trainer path.

Principle: **let a scenario force each shape into existence.** Do not build interaction types on spec.

### 3.9 The two shipped scenarios are capability-disjoint

`base-rung-stepped-tasks` has 7 tasks and 0 injections; `base-rung-resp-distress` has 6 checklist items, 7 actions and 2 injections but 0 tasks. Recorded in `docs/decisions/scenario-srs-divergence-memo.md`. An assessment scenario needs both halves, so the first one is a merge: the task spine plus a timed deterioration plus a timed interruption. Every mechanism this needs already exists.

### 3.10 Doctrine text lagged the product

Four places, all corrected on 2026-08-04: CLAUDE.md described an external pitch product; treated adoption friction as the primary risk without recording that this work is manager-mandated; froze time-in-training; and recorded the inter-rater resolution as external raters.

---

## 4. Effect on the two existing implementation plans

**Evidence-spine integrity** (`docs/superpowers/plans/2026-08-02-evidence-spine-integrity.md`) stands unchanged and remains first. A hash chain and an authentication guard are indifferent to who the users are. Its Task 1 closes a live authentication bypass and should land regardless of everything here.

**Clinical claim provenance** (`docs/superpowers/plans/2026-08-03-clinical-claim-provenance.md`) stands unchanged in mechanism. Its 36 claim declarations sit on scenarios that will churn when §3.9's merge happens — content rework, not design rework. Content-addressed hashing is exactly what makes that survivable: unchanged claims keep their provenance across the merge.

**The roadmap has shifted.** The appliance phase is gone (one hospital, founder wants direct data access). The motor-trainer phase is dormant. Crew mode has risen, because it now carries vet evaluation as well as team practice, and it needs content plus a two-role scenario rather than new plumbing. And a unit of work has appeared that is in neither plan: making the assessment path support what the design requires.

---

## 5. Proposed sequence

Three gaps — the rater blocker, session mode, and the time-in-training decision — are individually small, mutually related, and each blocks something the design treats as settled. They belong together, and they come before the tutorial.

1. **Bypass lockdown.** Integrity plan Task 1. Independent of everything; closes a live authentication hole.
2. **Make the assessment path work as designed.** Session mode with intents refused at the transport layer; decouple rating submission from the phase transition so three raters can score one session; settle time-in-training; add mentor attribution while sessions are still cheap to change.
3. **The tutorial.** Sequential reveal, the coach projection, immediate feedback, and a completion record that gates assessment. Delivers the fairness mechanism and the coaching machinery together, against content needing no clinical review.
4. **The hash chain.** Integrity plan Tasks 2-8.
5. **The first assessment scenario.** The merge from §3.9.
6. **Clinical provenance**, once content has stopped moving.

Crew mode slots in after 3 and can precede 5.

---

## 6. Decisions — all three answered 2026-08-04

Step 2 of §5 is unblocked. Each answer forces something beyond the obvious change, recorded here because the derived requirements are where the work actually is.

### D1 — Remove time-in-training entirely for candidate assessment. ANSWERED

**This is not a one-line change.** The field is load-bearing in seven places, and two of them fail *harder* once the ratings gate is removed:

| Site | What it does | Effect of removal |
|---|---|---|
| `server/routes/sessions.ts:495` | 422 `no_time_in_training` gate | The change itself |
| `server/routes/manager.ts:138-140`, `228-230` | **Throws** for any scored session with a null value | **500 on both manager endpoints** unless fixed in the same change |
| `packages/shared/src/scoring-surfaces.ts:19,48` | `traineeTimeInTrainingDays` and `timeInTrainingDays` are non-nullable `z.number()` | Response cannot serialize |
| `packages/shared/src/entities.ts:49-52` | Refinement rejecting a `scored` session with a null value | The entity schema itself forbids the new state |
| `packages/engine/src/scoring-surfaces.ts:86-87` | **Sorts the trend series by `timeInTrainingDays`** | The within-person trend loses its ordering basis |
| `src/pages/ManagerEvidencePage.tsx:265,329`; `src/pages/AarPage.tsx:332` | Renders it | Dead UI plus two orphaned i18n keys (`manager.evidence.tit`, `aar.header.timeInTraining`) |

**The derived decision is the trend's replacement sort key.** `createdAtMs` already exists in `trendPointSchema:47`, so the trend survives — but the axis changes meaning, from "progress against accumulated experience" to "progress over calendar time." For this product that is the more honest axis anyway, since the 30 shifts were never visible to the system.

### D2 — All three raters must submit, each covering all four ANTS domains. ANSWERED

Twelve rating rows per session (3 raters × 4 domains), and the `debrief → scored` transition fires when the set is complete.

**The derived requirement: the system has to know which three raters.** "All three have submitted" is uncheckable against `antsRatings.raterId` alone, which is free text stamped from auth — any three people could satisfy a bare count of distinct raters, including the candidate's mentor.

So D2 implies **per-session rater assignment**, following the existing `vc_role_stations` pattern: rows naming the three assigned raters at session creation. That table is also the only place the §1.6 mentor-exclusion rule can actually be enforced rather than merely intended.

### D3 — Mode is declared on the scenario file, assessment-only. ANSWERED

Elbit's model: training scenarios and qualification scenarios are different content, not one scenario in two settings.

**Implementation precedent already exists.** `clinicallyReviewed` is exactly this shape: an authored field, mirrored to a column on `vc_scenarios`, read where needed, and never entering the engine. Mode should follow it — which keeps `ScenarioDef` and `EngineState` untouched, and that matters, because provenance was deliberately kept out of `EngineState` so content metadata could never alter replay.

One wiring detail: `authorizeIntent` receives the `SessionRoom`, and the room holds the *compiled* `ScenarioDef`. So the mode has to be passed into `SessionRoom.hydrate` explicitly, alongside `seed` and `scenario`, rather than read off the compiled scenario.

**Two consequences worth naming.** The separate-scenario-banks boundary becomes free — the bank *is* the mode field, and an assessment scenario simply cannot be opened in practice mode. And the merged first assessment scenario from §3.9 will therefore be assessment-only, so **practice content has to be authored separately rather than reusing it.** More authoring work, and it is the correct cost: it is what stops the exam measuring rehearsal.
