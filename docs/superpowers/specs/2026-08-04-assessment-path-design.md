# Assessment path — design

**Date:** 2026-08-04
**Status:** ⚠️ **DO NOT IMPLEMENT AS WRITTEN.** Design approved section by section, then a product-strategist review on 2026-08-05 found four defects that make it non-functional or dishonest — **two of them false claims inside this document**, corrected inline below and marked. Read [`docs/design-alignment-2026-08-05.md`](../../design-alignment-2026-08-05.md) §2 first. That review also recommends splitting this unit in two (its §6); three founder decisions are open (its §7).
**Scope owner:** Dan (solo)

---

## 1. Why this work

VetCrew is an internal tool for one veterinary hospital in Israel, commissioned by the department manager to replace an outdated written exam. The settled product model has **two platforms over one engine**: *practice*, where an instructor pauses, adapts, and coaches; and *assessment*, which is locked, identical for every candidate, and observed rather than run.

Three things in the code make that model unenforceable today.

**The three-rater requirement is impossible.** [`server/routes/sessions.ts:492`](../../../server/routes/sessions.ts) requires `phase === "debrief"`, and lines 523-527 append `phase_change → scored` inside the same transaction as the rating insert. The **first** rater's submission moves the session out of `debrief`, so raters two and three receive a 409. Nothing consequential is supposed to rest on a single rater, and the code enforces exactly one. This has been latent because only one rater has ever existed.

**Nothing distinguishes practice from assessment.** There is no session mode anywhere, so [`authorizeIntent`](../../../server/live/socket.ts) cannot withhold pause and inject from an examiner, practice and assessment runs are indistinguishable in the log, and a practice score could reach an evidence packet.

**Time-in-training is a hard gate the founder has removed.** The ratings route returns 422 when it is null, and — found while writing this spec — [`0002_integrity.sql`](../../../server/db/migrations/0002_integrity.sql) carries a check constraint `vc_sim_sessions_scored_needs_time_in_training` forbidding `phase = 'scored'` without it. So this is a migration, not only code deletion. As things stand, **no session can be scored at all** once the field stops being populated.

### The three founder decisions this implements

Recorded here because they are not written down anywhere else in the repository.

**D1 — Time-in-training is removed entirely for candidate assessment.** A candidate takes one session, so they have no longitudinal axis; the 30 shadowing shifts are not visible to the system.

**D2 — A rating set is complete when all three assigned raters have each submitted all four ANTS domains.** Twelve rows, and only then does the session become `scored`.

**D3 — Mode is declared on the scenario file, not on the session.** Training and qualification scenarios are different content, following the Elbit trainer model. A scenario cannot be run in the other mode.

### In scope

1. Required `mode` on authored scenarios, mirrored to `vc_scenarios`, never entering `EngineState`.
2. Mode-aware `authorizeIntent`: assessment refuses instructor `injection` and `phase_change → paused`; **every** mode refuses client `phase_change → scored`.
3. `vc_session_raters`, with assessment sessions requiring exactly three assigned raters at creation.
4. Lifecycle fork: assessment reaches `scored` only on a complete set; practice and tutorial never reach it.
5. Atomic assessment submission — four domains, once per assigned rater — with a supporting unique constraint.
6. Nullable `mentor_id` on sessions.
7. Removal of every time-in-training read and gate, including the `0002` check constraint.
8. Retargeting the e2e happy path as a practice flow.

### Out of scope, deliberately

- **Tutorial behaviour.** The `tutorial` mode value is reserved so content can declare it; sequential reveal, the coach projection, and the completion entitlement are a later unit.
- **Session forking** for practice reruns.
- **The merged assessment scenario.** No assessment content exists in the repository after this work, by design — see §6.3 for the cost.
- **The evidence packet**, and the practice-session count surface it will carry. The count becomes *computable* here; nothing displays it.
- **Mentor-exclusion enforcement.** Procedural, per §2.3.
- **Seat labels on raters** (vet / Reviewer / senior technician). Count only.

### Approach

Enforce the two boundaries that are claims you would have to defend to a candidate — *the examiner could not intervene*, and *this was scored by three people* — and keep everything else descriptive. No hard gate is built where a hospital process is the real control.

---

## 2. Data model and enforcement

### 2.1 Scenario mode

`authoredScenarioSchema` gains a required field beside `clinicallyReviewed`:

```
mode: "assessment" | "practice" | "tutorial"
```

**Required, with no default.** A default silently makes every new scenario one thing, and the whole point of D3 is that the bank you land in is a deliberate choice.

It mirrors to a non-null `mode` column on `vc_scenarios`, exactly as `clinicallyReviewed` already does. **`compileScenario` must not copy it into `ScenarioDef`.** That is D3's real constraint: mode must never reach `EngineState`, for the same reason clinical-review metadata never does — content metadata that can alter replay is a determinism hazard. This deserves an explicit test, not just a convention.

Both shipped scenarios (`base-rung-resp-distress`, `base-rung-stepped-tasks`) become `practice`. Neither is a real assessment.

**Migration backfill.** The column is non-null and existing rows have no value, so the migration must backfill `'practice'` and update the stored `definition` JSON in the same step the files gain the field. Without that, the migration fails on any database with data in it.

### 2.2 Rater assignment

New table `vc_session_raters`, shaped like `vc_role_stations`:

| Column | Notes |
|---|---|
| `id` | uuid primary key |
| `tenant_id` | FK, and a tenant-composite FK to sessions matching the `0002` pattern |
| `session_id` | FK |
| `rater_user_id` | text — the auth subject, same shape as `role_stations.assigned_user_id` |
| `created_at` | timestamptz |

Unique on `(session_id, rater_user_id)`, so one person cannot fill two of the three seats. **No seat label column** — that is the count-only decision.

**Assignment happens at session creation and is conditional on mode.** An assessment session must be created with exactly three distinct rater user ids; practice and tutorial must carry none. "Exactly three" is not expressible as a database constraint, so the route validates it and the rows are inserted in the same transaction as the session and its role stations.

The consequence is that **an assessment session cannot be created before the roster is known.** That is deliberate: it forces the scheduling to be real rather than deferred.

### 2.3 Mentor attribution

Nullable `mentor_id text` on `vc_sim_sessions`, matching how `trainee_id` already works. Optional on create in every mode, and nullable even for assessments — practice is the mentor's choice, so a candidate may genuinely have no mentor on record, and inventing one would be worse than a null.

**Mentor exclusion from the rater list is procedural, not enforced.** The API does not compare `mentor_id` against `raterUserIds`. This follows from the count-only decision: with no seat labels and no reliable mentor identity at creation time, the hospital process is the control. What the schema does give you is **detectability** — an overlap is visible in the record afterwards, which is the honest register for a system that produces evidence rather than verdicts.

### 2.4 ANTS uniqueness, and what it costs

Add a unique constraint on `vc_ants_ratings (session_id, rater_id, domain)`. It prevents a double-submission from creating eight rows for one rater, and it collapses the completion check to counting distinct `rater_id` — four is then the only quantity a rater can have.

**The cost is that a rating cannot be amended.** A rater who mis-clicks has no correction path short of direct database access. I am proposing that deliberately rather than by omission: it matches the append-only posture everywhere else, and doing amendment properly means latest-wins ordering plus a story about what the evidence packet shows when a score changed. Recorded as a known v1 limitation, to be revisited the first time it actually happens rather than guessed at now.

### 2.5 What assessment mode withholds

The mode reaches `authorizeIntent` through the room. [`RoomRegistry.getOrCreate`](../../../server/live/room-registry.ts) already loads the scenario row and parses its definition, so it passes `mode` into `SessionRoom.hydrate` alongside `seed` and `scenario`. The compiled `ScenarioDef` stays mode-free per §2.1, so this is the only path.

When `room.mode === "assessment"` and the binding is an instructor station:

| Intent | Result |
|---|---|
| `injection` | Refused outright — not menu-validated, refused |
| `phase_change` to `paused` | Refused |
| `phase_change` to `briefing` / `running` / `debrief` | **Allowed**, subject to the existing reducer FSM |
| trainee intents | Unchanged — already refused for instructors |

Two refusals, both provable. The examiner must still be able to open and close the session, because a locked scenario runs *from start to finish* with the examiner present at both ends. Since pause becomes unreachable, resume is unreachable too, so `→ running` stays permitted for its other use: starting from `briefing`.

Use a distinct ack code for these — `mode_bound`, parallel to the existing `role_bound` — so a client can tell "you are the wrong role" from "this is an assessment."

### 2.6 A hole this closes

`authorizeIntent` currently permits an instructor to send **any** `phase_change`, and `canTransition(debrief, scored)` is structurally legal. So today an instructor can mark a session `scored` with zero ratings, and the manager evidence desk lists scored sessions. The `traineeTimeInTrainingDays` throw in [`manager.ts:138`](../../../server/routes/manager.ts) accidentally masks it — and D1 removes that throw, which would expose it.

So a third rule, applying in **every** mode: **`phase_change → scored` is refused from any client.** `scored` is server-derived only, appended by the ratings route when the set is complete. Nobody can assert it.

This is scope the design did not set out to cover, and it has to be in it: leaving it would mean D1 ships a regression.

### 2.7 Refusals are not logged

A refused intent emits `session:reject` and appends nothing, exactly as existing role-bound refusals do. The argument to a candidate is therefore from **absence plus declaration**: this scenario is assessment mode, in which injection is refused at the transport layer, and the log contains zero injection events.

Logging refused attempts would mean recording something that never touched the simulation, and it would amount to surveilling the examiner. Deliberately not done.

---

## 3. The scoring path

### 3.1 Assessment submission

One submission per assigned rater, while the session is in `debrief`:

- The body must cover **all four** ANTS domains, exactly once each. Partial submissions are rejected rather than accumulated, so "this rater has rated" is unambiguous.
- The submitter must be one of the session's assigned raters. Otherwise "all three have submitted" means nothing — a fourth person could satisfy a count.
- Existing evidence attestation is unchanged.
- **No `phase_change` is appended for a single rater.**

New failure responses: **403** when a non-assigned user submits to an assessment session, **422** when the submission does not cover all four domains, **409** on a second submission from the same rater (the unique constraint is the backstop).

### 3.2 Completion, and why the lock already handles it

Three raters submitting independently is a race: two could each see eight rows and neither transitions, or both see twelve and both append `scored`. The route already takes `FOR UPDATE` on the session row at [`sessions.ts:487`](../../../server/routes/sessions.ts) before reading state, so counting inside that lock serialises it for free.

After inserting this rater's four rows, still holding the lock: count distinct `rater_id` among the session's assigned raters. At three, append `phase_change → scored` through `appendSessionEventsTx` — the same sole-seq-authority path the route already uses. Below three, commit and return with the session still in `debrief`.

A database trigger would also work, and I would avoid it for the same reason the evidence-integrity design avoids plpgsql: business logic in two languages that must agree is how these things silently diverge.

**Each rater attests the head as they saw it.** Attestation freezes `log_head_seq`/`log_head_hash` at that rater's submission time, so raters one and three can hold different values if anything was appended in between. That is correct rather than a defect — each rater attests the log as it stood when they rated it, and a divergence is itself visible in the packet. Same reasoning as recording rater disagreement rather than averaging it away.

### 3.3 Practice and tutorial ratings

Deliberately looser. Session in `debrief`, no assignment check — anyone with session access may rate — and **partial domain coverage is allowed**, since a vet leading a crew practice run might be worth rating on decision-making alone. They are formative annotations, they never drive a transition, and requiring a full four-domain set for a Tuesday-afternoon observation would just mean nobody records anything.

The unique constraint still applies, so a second submission for the same domain is a client error rather than a silent overwrite.

### 3.4 The lifecycle fork

This changes a rule frozen in `CLAUDE.md §4`, which specifies one lifecycle for all sessions. It needs recording as an amendment, not slipped in.

| Mode | Path to terminal | Who may rate | Complete set required |
|---|---|---|---|
| `assessment` | `debrief → scored → archived` after 3 × 4 | Assigned three only | Yes |
| `practice` | `debrief → archived` | Anyone with session access | No |
| `tutorial` | `debrief → archived` | Anyone with session access | No |

`canTransition(debrief, scored)` **stays mode-blind**, because it is engine code and giving it the mode would put mode in `EngineState`. The engine's FSM describes shape; the server enforces policy. That split is what keeps D3 intact.

### 3.5 The fork strands practice sessions unless the FSM widens

Found while writing this spec, and missed by the section review. [`packages/engine/src/fsm.ts:14`](../../../packages/engine/src/fsm.ts) declares `debrief: ["scored"]` — the **only** transition out of `debrief` is to `scored`. Since practice and tutorial sessions never reach `scored` under the fork, they would have no terminal state at all and would accumulate in `debrief` forever.

The fix is one line: `debrief: ["scored", "archived"]`. It is **mode-blind**, so D3 holds — the engine gains a structurally legal shape and says nothing about who may use it.

**One consequence to accept deliberately.** This also makes `debrief → archived` legal for an *assessment* session, so an examiner could archive one before it is scored. That is a real operational need — a candidate falls ill, a fire alarm, an aborted run — and the alternative is an aborted assessment with nowhere to go. It is also, in principle, a way to bury a session that went badly.

~~I recommend allowing it rather than refusing it, because the archive is itself an event: the log records that the session was archived unscored, by whom, at what time, and the evidence packet can say so.~~

> **❌ CORRECTED 2026-08-05 — this justification was false.** The log does **not** record "by whom." `PhaseChangeEvent` has no actor field, and `server/live/event-append.ts:73-75` writes `actor_id = null` for every event type except `action`/`task_start`/`task_submit`. The archive event records a phase and a timestamp and nothing else, so the load-bearing half of the argument does not exist.
>
> In a hiring tool used on colleagues, an unattributed, unexplained, uncounted exit from a run that was going badly is the affordance you cannot have. **Before accepting the allowance:** populate `actor_id` on `phase_change` from the authenticated caller; require a reason on an assessment archived from `debrief`, stored on the event payload; and surface, per candidate on the manager desk, the count of assessment sessions started and never scored. The last one is what actually deters — a buried session that is invisible is a burial; one that shows as "2 assessments started, 1 scored" is a fact the manager sees. See `docs/design-alignment-2026-08-05.md` §3.2.

~~`scored` therefore becomes a reliable marker that a session was a real assessment — the manager evidence desk can filter on phase without consulting mode, and a practice score physically cannot appear in an evidence packet because practice sessions never acquire one.~~

> **❌ CORRECTED 2026-08-05 — false, and §3.5 above is what makes it false.** `server/routes/manager.ts:25` is `const EVIDENCE_PHASES = ["scored", "archived"]`, used at `:110`. The evidence desk keys on **archived**, not scored. That is safe today only because `archived` is reachable solely through `scored`. The moment §3.5's `debrief: ["scored", "archived"]` lands, `archived` stops implying scored — and every archived practice session appears on the manager's desk, carrying an "overall ANTS" computed from whatever partial formative ratings §3.3 lets anyone attach.
>
> So the third problem §1 says this spec fixes is re-opened through a door the same spec opens. **Fix:** snapshot `mode` onto `vc_sim_sessions` at creation and filter the desk on `mode = 'assessment' AND phase IN ('scored','archived')`, with a negative test that an archived practice session carrying ratings does not appear. See `docs/design-alignment-2026-08-05.md` §2.2.

---

## 4. Removing time-in-training

**62 references across 23 files.** Most are call sites that keep working untouched; the load-bearing reads are few and two of them fail *harder* once the ratings gate is removed.

### 4.1 The database

Drop the check constraint `vc_sim_sessions_scored_needs_time_in_training` from `0002_integrity.sql`, in this spec's migration. Without it, D1 is unimplementable — the database refuses `phase = 'scored'` with a null value regardless of what the route does.

**Keep the column**, nullable. Dropping it is a destructive migration on a column referenced by roughly twenty test, e2e, and seed call sites. Because Zod strips unknown keys on non-strict objects, leaving `traineeTimeInTrainingDays` out of `createSessionSchema` means every one of those call sites keeps parsing cleanly and needs no edit. The column becomes dead weight a later migration can drop once nothing has referenced it for a while.

### 4.2 The gate and the write path

Delete the 422 branch at `sessions.ts:495` and its response case. Remove the field from `createSessionSchema` and from the insert — the column is nullable with no default, so omitting it yields null.

### 4.3 The reads, which are where the breakage is

| Site | Change |
|---|---|
| `server/routes/manager.ts:99, 197` | Stop selecting it |
| `server/routes/manager.ts:138-140, 228-230` | **Throws** on null for any scored session — delete |
| `server/routes/manager.ts:155, 234, 254` | Stop emitting it |
| `server/routes/sessions.ts:406` | Drop from the AAR payload |
| `packages/shared/src/scoring-surfaces.ts:19` | `evidenceSessionSchema.traineeTimeInTrainingDays` is non-nullable — the manager response cannot serialize without it |
| `packages/shared/src/scoring-surfaces.ts:48` | `trendPointSchema.timeInTrainingDays`, same problem for the trend |
| `packages/shared/src/entities.ts:51-52` | Refinement rejecting a `scored` session with a null value — delete |
| `packages/engine/src/scoring-surfaces.ts:85-89` | The trend sort — see below |
| `src/api.ts:34, 86` | Type declarations |
| `src/pages/ManagerEvidencePage.tsx:265, 329` | Chart mapping and display |
| `src/pages/AarPage.tsx:332` | Display |
| `src/i18n/{he,en}.json` | Delete `manager.evidence.tit` and `aar.header.timeInTraining` |

**Write-side call sites keep working and should still be cleaned.** `src/App.tsx:210, 229` and `server/scripts/seed-demo.ts:92` pass the field into session creation. Zod strips it once the field leaves `createSessionSchema`, so they cause no failure — but they are production and seed code, not tests, and leaving them sends a dead field forever. Clean these three; leave the ~20 test and e2e call sites alone, which is the point of keeping the column.

### 4.4 The trend axis

This is the only real design decision in the removal. `packages/engine/src/scoring-surfaces.ts` sorts the within-person trend **by** time-in-training, so removing it leaves the series with no ordering.

The fix is cleaner than it looks: lines 85-89 already tie-break on `createdAtMs`. Deleting the primary comparator leaves `createdAtMs` as the sole sort key, and the field is already on `trendPoint`.

For the chart itself I would go further than swapping to dates: **make the x-axis session index** — first session, second, third — derived from `createdAtMs` order. It avoids date formatting and Hebrew locale handling entirely, and for a within-person trend "your third run" reads better than a date. `ManagerEvidencePage.tsx:265` currently maps `days: point.timeInTrainingDays` into the chart, so it becomes an index.

### 4.5 Tests that break

`server/test/manager.test.ts` asserts the trend series by time-in-training values; it becomes an assertion that the series is ordered by creation. `packages/engine/test/scoring-surfaces.test.ts` and `packages/shared/test/scoring-surfaces.test.ts` use the field in fixtures. Update rather than delete — the trend still has an axis, it is just a different one.

---

## 5. Testing

Weighted toward the two claims that would have to survive a challenge.

**The examiner could not intervene.** In assessment mode an instructor's `injection` is refused and `phase_change → paused` is refused, while `→ running` and `→ debrief` stay permitted so the session can be opened and closed. Plus the mirror case: practice mode still permits both, because hardening assessment while silently breaking practice would be easy to miss.

**`phase_change → scored` is refused from any client, in every mode.** Its own test — it is the §2.6 hole and nothing else would catch a regression.

**Mode never reaches the engine.** `compileScenario` output contains no mode, and `replay()` is byte-identical with and without it.

**Completion, including the race.** One rater submits and the session stays in `debrief`; two, still `debrief`; three, and it becomes `scored` with exactly one `phase_change` appended. A non-assigned submitter gets 403; a submission missing a domain gets 422; a resubmission hits the constraint. Then the one that justifies the whole locking argument: **three concurrent submissions produce exactly one transition.** That needs a real database and is worth the effort, because the row lock is the entire safety story.

**Creation validation.** Assessment with two or four raters is rejected; assessment with duplicate ids is rejected; practice with a non-empty rater list is rejected.

**The practice path.** Partial domain coverage accepted, no assignment required, and a practice session never reaching `scored` however many ratings it carries — but reaching `archived` directly from `debrief`, per §3.5. A practice session with no terminal state is the failure this widening exists to prevent, so assert it explicitly.

**One test proves an assumption rather than a behaviour:** an old call site passing `traineeTimeInTrainingDays` still parses cleanly. The argument for not touching twenty call sites rests entirely on Zod stripping unknown keys, and that should be asserted somewhere rather than believed.

**And a mentor who is also an assigned rater is accepted**, with the overlap visible. That test documents §2.3 as deliberate rather than an oversight someone will later "fix."

---

## 6. The e2e consequence

### 6.1 What breaks

Both shipped scenarios become `practice`, and practice sessions can never be scored. `e2e/helpers/session.ts` builds scored sessions via `createScoredRespDistressSession`, and `e2e/manager-evidence.spec.ts` asserts the desk lists them.

Worth noting: `scoreSession` in that helper submits **three** domains, not four — it omits `team_working`. Under practice rules that is fine, which is why the helper keeps working; under assessment rules it would be a 422.

### 6.2 Strategy

The e2e happy path becomes a **practice** flow: create, run, debrief, submit formative ratings, assert they landed and the session did not transition. Assessment completion — including the concurrency case — is covered by integration tests that insert an assessment-mode scenario row directly via Drizzle rather than going through `syncScenarios`.

### 6.3 The cost, stated plainly

`manager-evidence.spec.ts` is specifically about the desk listing **scored** sessions, and after this change no scored session can exist end-to-end. Scenarios reach the e2e database only through `syncScenarios` from files on disk, so there is no way to have one without shipping an assessment scenario file.

So that spec loses its assertion until real assessment content exists. The alternative is shipping a minimal assessment scenario now purely to satisfy a test — which would need provenance declarations under the clinical-review work, would look like real content to anyone browsing `scenarios/`, and would still be there in a year.

I recommend accepting the loss: the transition is thoroughly covered at integration level including the race, and e2e's job is the browser path rather than the state machine. But it is a real coverage gap and should be reinstated when the merged assessment scenario is authored.

---

## 7. Migration numbering

This unit owns `server/db/migrations/0007_*.sql`: mode column and backfill, `vc_session_raters`, `mentor_id`, the ANTS unique constraint, and dropping the `0002` time-in-training check.

If the evidence-spine integrity work lands separately and claims `0007` for its hash chain, whichever executes second renumbers. That is a filename and test-fixture change, not a design change.

---

## 8. Acceptance criteria

1. An assessment session accepts three full ANTS submissions, and only the third moves the log to `scored`.
2. An instructor on an assessment session cannot pause or inject, and can still start and end it. Refusals leave no log residue.
3. A client `phase_change → scored` is refused in every mode.
4. Practice sessions can be rated without entering `scored`, and e2e proves it.
5. A practice session can reach `archived` directly from `debrief`, so the fork leaves no session without a terminal state.
6. An assessment session cannot be created without exactly three distinct raters; practice cannot be created with any.
7. No code path required for scoring or manager views reads time-in-training, and the `0002` check constraint is gone.
8. `compileScenario` output and `replay()` are unchanged by mode.
9. `mentor_id` persists on create; overlap with the rater list is visible and not blocked.
10. `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm i18n:check`, `pnpm guard:deps`, `pnpm guard:dead` all pass.

## 9. Follow-ups this creates

| Follow-up | Why deferred |
|---|---|
| Merged assessment scenario, and restoring the `manager-evidence` e2e assertion | Content work; needs clinical review |
| Tutorial behaviour — sequential reveal, coach projection, completion gate | Its own unit; `tutorial` mode is reserved here |
| Practice-session count in the evidence packet | Computable after this; the packet does not exist |
| Rating amendment | §2.4 — revisit when it actually bites |
| Session forking for practice reruns | Not needed until practice rewind ships |
| `CLAUDE.md §4` lifecycle amendment | The fork in §3.4 and the FSM widening in §3.5 both change a frozen rule and must be recorded there |
| Recording the settled product model in `CLAUDE.md` | This tree's `CLAUDE.md` still describes an external pitch product; §1's premises are not written down anywhere in the repository |
