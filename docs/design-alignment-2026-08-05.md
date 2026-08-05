# Design-to-code alignment — 2026-08-05

**Status:** findings of record. The four blockers in §2 and the three open decisions in §7 are **resolved and implemented** (Units A and B, 2026-08-05) — §7 records what shipped and what was deliberately left. §2/§3 are kept as written, as the reasoning behind those choices.

This cross-references the product model in [`CLAUDE.md`](../CLAUDE.md) §1 against the code that exists, with file:line evidence. It is not a build plan. Every claim below was verified by reading the cited code, not inferred.

Read this **before** starting the assessment-path spec ([`docs/superpowers/specs/2026-08-04-assessment-path-design.md`](superpowers/specs/2026-08-04-assessment-path-design.md)). Four of the findings make that spec non-functional or dishonest as written, and two of them are false claims inside the spec itself.

---

## 1. What already aligns

The spine is sound. Every gap below is **additive** — nothing in the settled design requires replacing the reducer, the log, or the view projections.

| Design requirement | Code that supports it |
|---|---|
| Deterministic replay, append-only log, role attribution | `reduce`/`replay` in `packages/engine/src/reducer.ts`; `appendSessionEventsTx` as sole seq authority in `server/live/event-append.ts`; `role`/`actorId` stamped server-side in `server/live/socket.ts` |
| Assessment needs pre-set events at fixed times | `TriggerCondition` includes `{ kind: "time", atMs }`; `base-rung-resp-distress` already fires `decompensation-at-150s` |
| Practice needs live instructor injection | Injection menu plus `authorizeIntent` permitting `injection` for instructor stations only (`server/live/socket.ts:145-175`) |
| Information hiding is real, not a permissions filter | `stripBody` in `packages/engine/src/views.ts` removes every `expected*` field before anything crosses the wire |
| Crew mode: multiple roles in one session | `vc_role_stations` per-role rows; `taskVisibleToRole` filters by `def.role`; the socket binds each trainee to its own role and broadcasts per-role snapshots |
| Vet as a participant role | `roles` is an arbitrary string array — `["technician", "veterinarian"]` is authorable today with no code change |
| Three raters storing three sets of scores | **No unique constraint** on `vc_ants_ratings` — rows are free to multiply (`0001_init.sql:73-84`) |
| Seven interaction shapes for content | `TaskBodyDef` in `packages/engine/src/tasks.ts:56-99` |
| Hebrew-first with Latin clinical notation | `src/i18n`; monitor device-face exemption frozen in CLAUDE.md §4 |

---

## 2. Blockers — unresolved

Found by a product-strategist review on 2026-08-05 and each verified against the code afterwards.

### 2.1 The three raters can see each other's scores while rating

`GET /:id/aar` selects **every** ANTS row on the session with no rater filter (`server/routes/sessions.ts:396-399`, emitted at `:426`), and `src/pages/AarPage.tsx:588-606` renders rater id, domain and score — on the same page that holds the rating form.

The entire justification for three raters is inter-rater agreement. If rater 2 opens the AAR and sees rater 1 gave a 2 on decision-making before entering her own, that is not three independent judgments; it is one judgment and two anchorings. **The evidence packet would nonetheless claim three, and that claim would be false.** This is the thing a rejected candidate would attack.

Latent because only one rater has ever existed. The assessment-path spec is exactly the change that makes it live, and does not mention it.

**Fix:** in assessment mode the AAR returns only the requesting user's own rating rows until the session is `scored`; after that, all of them. One conditional on the select. Belongs in the spec's acceptance criteria beside "the examiner could not intervene" — it is the same class of defensibility claim.

### 2.2 The FSM widening reopens the leak it was meant to close

The spec's §3.4 claims *"a practice score physically cannot appear in an evidence packet because practice sessions never acquire one."* **That is false**, and the spec's own §3.5 is what makes it false.

`server/routes/manager.ts:25` is `const EVIDENCE_PHASES = ["scored", "archived"]`, used at `:110`. The evidence desk keys on **archived**, not scored. That is safe today only because `archived` is reachable solely through `scored`. The moment `debrief: ["scored", "archived"]` lands (spec §3.5), `archived` stops implying scored — and every archived practice session appears on the desk, carrying an "overall ANTS" computed from whatever partial formative ratings §3.3 permits anyone to attach.

Worse: §3.3 allows partial domain coverage, so the desk would display an overall score derived from a single domain. CLAUDE.md §4 says per-domain scores are directional only and overall scores drive anything consequential.

**Fix:** snapshot `mode` onto `vc_sim_sessions` at creation (see §2.7) and filter the desk on `mode = 'assessment' AND phase IN ('scored','archived')`. Add the negative test: an archived practice session carrying ratings does not appear.

### 2.3 The four-domain completion rule cannot be satisfied by any content or UI that exists

D2 and spec §3.1 require all four ANTS domains from each rater. But:

- `base-rung-resp-distress` declares `scoringDimensions: ["task_management","situation_awareness","decision_making"]`; `base-rung-stepped-tasks` declares two. **Neither includes `team_working`.**
- `src/pages/AarPage.tsx:293` submits `scenario.scoringDimensions.map(...)` — the only rating UI in the product cannot emit a domain the scenario does not declare.
- Nothing in the spec's schema change requires an assessment scenario to declare four domains.

Consequence: author the merged assessment scenario as the union of the two shipped ones (three domains, the obvious merge) and **every rating submission 422s forever**. The session is stuck in `debrief` with no exit but archive-unscored — for a real candidate.

The deeper problem: candidate assessment is **one solo session**. `team_working` in a session with no crew has no events to cite. The rule requires three raters to each score, with evidence, a domain the session structurally cannot generate evidence for — and CLAUDE.md §2.4 says explicitly not to solo-ize the non-technical axis.

**Fix, and it changes a settled decision:** redefine D2 as *"every assigned rater has rated every domain the scenario declares,"* plus a schema refinement that an assessment scenario must declare at least three domains, named deliberately. **D2 as Dan stated it (all four) is wrong for a solo session and needs his confirmation to change.**

### 2.4 Assigned raters get 403 before the assignment check runs

`assertSessionAccess` (`server/routes/sessions.ts:204-235`) passes `manager`/`instructor` blanket; everyone else must own a `role_stations` row on that session. **An assigned rater is neither.** The vet and the senior technician get 403 on `POST /:id/ratings` and on `GET /:id/aar` — they cannot even read the session they are rating.

The workaround is granting all raters the `instructor` Clerk role, which also lets them create and run sessions. That is not a permission model.

**Fix:** `assertSessionAccess` admits `vc_session_raters` membership (read + rate, nothing else). Also decide what Clerk role the Reviewer holds — nothing specifies it.

---

## 3. High-severity findings

### 3.1 "Identical conditions" is a hard product rule and the seed is random per session

`server/routes/sessions.ts:305`: `seed: input.seed ?? randomInt(1, 2 ** 31)`. The reducer draws PRNG jitter per vital per tick. **Two candidates running the same assessment scenario see different vitals traces** — different noise on the numbers they read and call out, at different moments.

The whole point of the locked platform is cohort comparability. The spec locks the examiner's hands and leaves the physiology unpinned.

**Fix:** assessment scenarios carry a fixed seed in the file; the create route ignores any client-supplied seed when mode is assessment. Two lines, and it is the same claim ("everyone faced the same run") as the two the spec already enforces.

### 3.2 The archive-unscored allowance is a burial mechanism as specified

Spec §3.5 justifies allowing `debrief → archived` on an assessment with: *"the log records that the session was archived unscored, by whom, at what time."* **It does not.** `PhaseChangeEvent` has no actor field, and `server/live/event-append.ts:73-75` writes `actor_id = null` for every event type except `action`/`task_start`/`task_submit`. The archive event records a phase and a timestamp and nothing else.

So the load-bearing half of the argument for allowing it is not true today. In a hiring tool used on colleagues, an unattributed, unexplained, uncounted exit from a run that was going badly is the affordance you cannot have.

**Before accepting it:** (a) populate `actor_id` on `phase_change` from the authenticated caller; (b) require a reason on an assessment archived from `debrief`, stored on the event payload; (c) surface, per candidate on the manager desk, the count of assessment sessions started and never scored. **(c) is the one that actually deters** — a buried session that is invisible is a burial; one that shows as "2 assessments started, 1 scored" is a fact the manager sees.

### 3.3 Mode is mutable after the fact, and everything defensible rests on it

`server/scenarios.ts:59` upserts with `onConflictDoUpdate` on `(tenant, slug, version)`, overwriting `definition`; `server/index.ts:71` re-syncs from disk on **every boot**. So editing a scenario file without bumping the version silently rewrites the mode — and the checklist, and the tasks — of every past session that used it. The spec has the room read mode from the live scenario row, and its defence to a candidate is "this scenario is assessment mode."

That declaration is a mutable file plus a restart. The hash chain that would make this tamper-evident is a later roadmap step.

**Fix:** snapshot `mode` onto `vc_sim_sessions` at creation and have `RoomRegistry`/`authorizeIntent` read the session's mode, not the scenario's. This does **not** violate D3 — mode is still *declared* on the scenario, never chosen per session; the resolved value is frozen exactly as `scenario_version` already is. One column, and it simultaneously unblocks §2.2's filter.

### 3.4 Three-raters-at-creation is rigid where it buys nothing

The invariant that matters — *scored requires three distinct assigned raters with complete sets* — is enforced at scoring time and is untouched by when the roster is set. Creation-time immutability adds only: the session cannot be opened until three names exist, and the roster can never change.

With no seat labels (the spec's own count-only decision), "three" does not prove the right three. So the gate enforces the least meaningful half at maximum operational cost. In a department with 10 senior technicians, vets on rotation and one Reviewer: a rater goes on leave, or the candidate objects, or someone never submits — and the session is permanently unscorable, its only exit being archive-unscored (§3.2), with the candidate re-sitting an assessment they already took.

**Fix:** roster set at creation but amendable while phase < `debrief`, every change appended as an event. Scoring-time invariant unchanged. **This changes a decision Dan approved and needs his confirmation.**

### 3.5 The Reviewer will never log in, and D2 requires her to

CLAUDE.md §1.6: she is 65, completely non-technical, will never log into anything. D2 requires her to be an authenticated `rater_user_id` submitting per-domain scores with evidence citations through a Hebrew RTL web form with an event-timeline picker.

Only two outcomes. Either the three-rater model does not run at all, or someone enters her scores under their own account — in which case the record says a different person rated, and **the evidence packet's most important claim is a falsehood introduced by the system's own design.**

Nothing in the spec addresses this. It is the single largest threat to the model the assessment-path unit exists to enforce, and it is a data-model decision that is cheap now and **impossible to retrofit onto packets already produced.**

**Fix:** add `submitted_by_user_id` alongside `rater_id` on `vc_ants_ratings`, defaulting to the same value. A proxied entry is then honest, visible in the packet, and countable. **Decide before the unique constraint and the 403 rule are cast in a migration.**

---

## 4. Other findings, lower severity

- **No amendment path for a submitted rating.** The spec's §2.4 accepts that a mis-click is permanent short of `psql` on production — an unlogged, unattributed edit to a hiring record, which is strictly worse for auditability than the amendment it avoids. Append-only does not mean values are immutable; it means corrections are *appended*. Suggested: `revision int not null default 0`, unique on `(session_id, rater_id, domain, revision)`, latest wins for completion counting, packet shows the history.
- **Nothing tells raters 2 and 3 that they owe a rating.** Three people rating asynchronously over days, with no queue, no notification, no "awaiting 2 of 3" indicator. Given §3.4's immutable roster, a forgotten rating is unrecoverable. Cheap fix: `ratersSubmitted / ratersAssigned` on the sessions list.
- **The e2e coverage loss is avoidable.** The spec's §6.3 claims scenarios reach the e2e database only via `syncScenarios` from files. `server/scripts/seed-demo.ts` is an in-repo counterexample — it writes sessions and events straight into the database via Drizzle. A Playwright setup project could insert an assessment-mode scenario the same way, with no file in `scenarios/`. The scored path *is* the hiring path; leaving it the one path with zero browser coverage is the wrong place to be thin.
- **No surface creates an assessment session.** `src/App.tsx:205-235` is two hardcoded buttons with fixed scenario slugs. No scenario picker, no trainee field, no mentor field, no rater picker, and no user directory from which to obtain three Clerk subject ids. After the spec lands, an assessment session can only be created with curl. That may be acceptable staging, but it is not in the spec's out-of-scope list, and **the roster look-up problem blocks the first real assessment as hard as anything else here.**
- **The within-person trend may have nothing to plot.** It serves population 2 (voluntary practice). After the fork, practice sessions never reach `scored`, and the trend query reads `EVIDENCE_PHASES`. So either the trend goes empty for everyone it was built for, or it is populated by the §2.2 leak. Decide what it plots — probably practice sessions filtered by mode — before doing the §4.4 axis rework.
- **Nothing records that the familiarisation run happened.** The tutorial exists to neutralise a confound measured at d = 0.67. Its entitlement gate is deferred, which is fine, but if any real assessment happens first the confound is live and unrecorded forever. Cheap: nullable `familiarisation_session_id` on the session now, populated by hand if necessary.

---

## 5. The three founder decisions, and what each forces

**D1 — remove time-in-training entirely for candidate assessment.** Not a one-line change. 62 references across 23 files. `server/routes/manager.ts` **throws** on null for any scored session (`:138-140`, `:228-230`); `evidenceSessionSchema:19` and `trendPointSchema:48` declare it non-nullable so the response cannot serialize; `packages/shared/src/entities.ts:51-52` refuses a `scored` session without it; **`0002_integrity.sql` carries a check constraint** forbidding `phase = 'scored'` without it, so this is a migration. Keep the column (Zod strips unknown keys, saving ~20 test call sites) and remove every read. Derived: `packages/engine/src/scoring-surfaces.ts:85-89` sorts the trend *by* this field; `createdAtMs` is already the tie-break and becomes the sole key.

**D2 — all three raters, all four domains, before `scored`.** Forces per-session rater assignment, because a distinct-count over the free-text `raterId` would admit any three people including the mentor. **Contested by §2.3** — "all four" is unsatisfiable against existing content and structurally wrong for a solo session.

**D3 — mode declared on the scenario file, assessment-only.** Follows the `clinicallyReviewed` precedent: authored field, mirrored column, never entering `EngineState`, so content metadata cannot alter replay. **Amended by §3.3** — the resolved value should also be snapshotted onto the session, which does not violate D3 and closes the mutability hole.

---

## 6. Sequence

1. **Bypass lockdown.** `VETCREW_TEST_AUTH=1` in production accepts `Bearer test:anyone:manager`, because `parseTestBearer` is checked before Clerk in both readers and `isTestAuthEnabled()` has no `NODE_ENV` guard. Independent of everything else; ship immediately.
2. **The assessment path** — but restructured. Split it: **Unit A** is everything true regardless of mode (the multi-rater 409, the client-`scored` hole, the FSM widening plus §2.2's desk filter, time-in-training removal and its check constraint, actor attribution on `phase_change`), which ships now and depends on no open decision. **Unit B** is mode, roster and submission rules, landing with or immediately before the merged assessment scenario so every rule meets real content in the same change.
3. **The tutorial** — sequential reveal, the coach projection, immediate feedback, a completion record that gates assessment. `createTaskRuntime` marks every task `available` at once and trigger effects target vitals only, so **sequential reveal is the one genuine engine addition** the tutorial requires.
4. **Event-log hash chain** — replacing the whole-log snapshot digest with a per-event chain.
5. **The first assessment scenario** — the merge from the header's content constraint.
6. **Claim-level clinical review** — per-claim provenance replacing the file-level `clinicallyReviewed` boolean, with a printed Hebrew review sheet for the Reviewer.

Crew mode slots in after 3 and can precede 5; it needs content plus a two-role scenario rather than new plumbing, and it carries vet evaluation as well as team practice.

---

## 7. Open decisions — ANSWERED 2026-08-05, and implemented

All three went the way the findings above argued. Each was the only option that lets a real solo assessment run at all; the alternatives were self-defeating (422-forever, stranded candidate, false packet claim).

1. **D2 becomes "every domain the scenario declares."** ✅ Plus a schema refinement: an assessment scenario must declare **at least three** domains, named deliberately — because completion is now measured against the declared set, which makes that set load-bearing.
2. **The rater roster is amendable while phase < `debrief`.** ✅ Set at creation, replaceable until anyone has seen the run; the scoring-time invariant (three distinct assigned raters with complete sets) is unchanged. This is also what removes the need for archive-unscored on an assessment — a stuck session is fixed by swapping a rater, not by burying the candidate's run.
3. **Proxied entry is recorded, not hidden.** ✅ `submitted_by_user_id` sits alongside `rater_id`, defaulting to it. Only a **manager** may submit under another rater's name — otherwise the field would be a forgery affordance rather than an honesty one.

### What shipped with them

Unit A (already merged separately): time-in-training removal + the client-`scored` refusal.

Unit B, in one change: scenario `mode` (authored, mirrored to a column, **snapshotted onto the session** per §3.3) · mode enforced at both the socket and REST transports (§1.1) · assessment pins its seed (§3.1) · FSM widened with the desk's mode filter (§2.2) · `vc_session_raters` + `assertSessionAccess` admitting raters (§2.4) · the D2 completion rule replacing first-submission-wins · AAR rater blinding until scored (§2.1) · assessment cannot be archived from debrief (§3.2, closed by construction rather than by attribution).

### Added in review (CodeRabbit, 2026-08-05)

Four of the review's findings were real defects in the first cut and are fixed:

- **The blinding filter keyed on the wrong identity.** It compared `submitted_by_user_id` to the caller, which hid a proxied rating from the rater whose judgment it is and showed it to whoever transcribed it. Now a row is "yours" if you are its `rater_id` *or* its submitter.
- **The mode check was a TOCTOU race.** Phase was read before `appendSessionEventsTx` took its `FOR UPDATE` lock, so a concurrent append could move an assessment to `debrief` and a stale check would then wave through the `archived` the rule exists to refuse. The policy now runs *inside* the locked append (`clientOriginated: true`), which also covers the socket path against two server instances.
- **The migration deleted superseded ratings.** Scores, evidence seqs and log-head attestations are the whole defensibility story; a migration must not destroy them. They move to `vc_ants_ratings_archive`, and the runtime upsert archives the prior row before overwriting — so amendment history exists after all.
- **Roster amendments left no trace**, while this document, `CLAUDE.md` and `mode-policy.ts` all called the swap the auditable alternative to archiving unscored. Amendments are now retained in place (`removed_at`, `removed_by_user_id`, `assigned_by_user_id`); the live roster is `removed_at IS NULL` and `GET /:id/raters` returns the history.

Also fixed: the client could no longer proxy at all (`submitRatings` dropped `raterId` for every authenticated call), `ratersSubmitted` was renamed `ratersComplete` because it counts raters who covered *every* declared domain, and the bypass flags now share one `isBypassEnabled` helper keyed on `BYPASS_FLAGS` so a future flag gets the runtime guard automatically rather than by hand.

### Still open, deliberately deferred

- **Freeze the whole authored scenario revision, not just `mode`.** `syncScenarios` rewrites `scenarios.definition` for an existing version on every boot, and replay/checklist/task scoring all read the live row — so a file edit without a version bump can still change the score of a completed assessment. Real, and **pre-existing**: this PR froze `mode` because that is what its own rules depend on. The fix is a definition snapshot or content hash on the session plus rerouting every replay and scoring path through it, which is its own change and sits naturally beside the event-log hash chain already next-but-one on the roadmap.
- **Actor attribution on `phase_change`** (§3.2 a/b) and the manager desk's started-vs-scored count (§3.2 c). Not needed to close the burial hole — assessment simply cannot archive from debrief — but still the right thing for the log.
- **Rater notification / "awaiting 2 of 3"** (§4). The ratings response returns `ratersComplete` / `ratersAssigned`, so the data exists; nothing surfaces it yet.
- **A UI that creates an assessment session** (§4) — still curl-only, including the roster picker and the user directory it needs.
- **Familiarisation-run record** (§4), and the within-person trend, which after the fork plots nothing for the practice population it was built for until a mode-specific history query exists.
