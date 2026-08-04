# Assessment path — design

**Date:** 2026-08-04
**Status:** design approved by founder, section by section; awaiting founder review of this written spec before an implementation plan is written
**Scope owner:** Dan (solo)
**Depends on:** founder decisions D1–D3 recorded in [`docs/design-alignment-2026-08-04.md`](../../design-alignment-2026-08-04.md) §6 and [`CLAUDE.md`](../../../CLAUDE.md) §1.1 / §1.6
**Does not depend on:** evidence-spine integrity (hash chain) or clinical-claim provenance — those plans stand; this unit only claims migration number `0007` (see §7)

---

## 1. Why this work

The product model is settled: VetCrew is an internal hospital tool with two platforms (practice and assessment) over one event-sourced engine. Three load-bearing gaps make that model unenforceable in code today ([`docs/design-alignment-2026-08-04.md`](../../design-alignment-2026-08-04.md) §2):

1. **Three raters are impossible.** `server/routes/sessions.ts` transitions `debrief → scored` on the first ANTS submission, so raters two and three get `409 wrong_phase`.
2. **No session mode.** Nothing distinguishes practice from assessment, so an examiner’s pause/inject cannot be refused at the transport layer.
3. **Time-in-training is a hard gate the founder removed.** The ratings route returns `422 no_time_in_training` when the column is null; the DB check `vc_sim_sessions_scored_needs_time_in_training` (`0002_integrity.sql`) forbids `phase = scored` without it; manager routes throw on null.

This unit closes those three gaps, adds the derived requirements they force (rater assignment, mentor column, client `scored` refusal), and forks the lifecycle so practice/tutorial never enter `scored`.

**Doctrine this serves.** CLAUDE.md §1.1 (mode as withheld capability), §1.6 (complete rating set before `scored`), §2.2/§2.3 (evidence not verdict; auditability), and the verdicts-vs-capture rule (no judgment in the log — lifecycle transitions and refusals are not verdicts about trainee performance).

### In scope

1. Required `mode` on authored scenarios (`"assessment" | "practice" | "tutorial"`), mirrored to `vc_scenarios`, never entering `EngineState`.
2. Mode-aware `authorizeIntent`: assessment refuses instructor `injection` and `phase_change → paused`; all modes refuse client `phase_change → scored`.
3. `vc_session_raters` and assessment create requiring exactly three rater user IDs.
4. Lifecycle fork: assessment `debrief → scored` only when the assigned rating set is complete; practice/tutorial never `scored`.
5. Atomic assessment rating submission (exactly four ANTS domains, once per assigned rater); unique `(session_id, rater_id, domain)`.
6. Nullable `mentor_id` on sessions.
7. Remove all time-in-training **reads and gates**; leave the column; drop the scored-needs-TiT check; replace trend sort with `createdAtMs` / session index.
8. Retarget the existing e2e happy path as a **practice** flow (rate without `scored`); cover assessment completion with integration tests until a real assessment scenario exists.

### Out of scope, deliberately

- **Tutorial UX** — sequential reveal, coach projection, answer-visible tasks, completion entitlement. Mode value `"tutorial"` is reserved so content can declare it; behaviour beyond mode storage is a later unit.
- **Session fork / parent pointer** for practice rewinds.
- **Merged assessment scenario content** (capability-disjoint merge from the audit §3.9).
- **Evidence packet UI** and practice-session count surface (count becomes computable once mode exists; the packet itself is later).
- **Mentor-exclusion enforcement** in the database — procedural only (see §3.4).
- **Hash chain / provenance** — separate plans; this unit only takes migration `0007` so those plans renumber when executed.
- **Seat labels on raters** (vet / Reviewer / senior tech) — count-only assignment.

### Approach

**Approach 3 (approved):** enforce two hard boundaries (examiner cannot intervene on assessment; assessment needs three complete raters) and keep everything else descriptive. No new product surface beyond what those boundaries require.

---

## 2. Data model

### 2.1 Scenario mode

Required field on the authored scenario JSON, validated by `authoredScenarioSchema`:

```ts
mode: z.enum(["assessment", "practice", "tutorial"])
```

Mirrored to a non-null `text` column on `vc_scenarios` (same shape as `clinically_reviewed`): written at scenario upsert / seed, read where authorization and create-path branching need it. **Never copied into `ScenarioDef` / `EngineState`.** Replay stays indifferent to mode; a future change to mode metadata cannot alter historical engine state.

Migration backfill: existing `vc_scenarios` rows get `mode = 'practice'` (and their `definition` JSON is updated to include `"mode":"practice"` at the same time the shipped files gain the field). Both currently shipped scenarios (`base-rung-stepped-tasks`, `base-rung-resp-distress`) are `"practice"`. There is no assessment content in-repo until the merge unit authors one.

**Create-path consequence.** Opening a session for a scenario inherits that scenario’s mode. There is no session-level mode override. Practice content cannot be the assessment bank reused under a different flag — that is the Elbit separate-banks boundary (D3).

### 2.2 Session raters

New table `vc_session_raters` (migration `0007`):

| Column | Type | Constraint |
|---|---|---|
| `id` | `uuid` | PK |
| `tenant_id` | `uuid` | FK tenants, not null |
| `session_id` | `uuid` | FK sim_sessions, not null |
| `rater_user_id` | `text` | not null (Clerk / test-auth subject) |
| `created_at` | `timestamptz` | not null, default now |

Unique `(session_id, rater_user_id)`. No seat / role label column.

**Assessment create** requires a body field with **exactly three** distinct `raterUserIds`. The three rows are inserted in the same transaction as the session (and role stations). Fewer or more than three → `400`. Duplicate IDs in the request → `400`.

**Practice and tutorial create** reject a non-empty rater list (`400`) and insert zero rater rows. Rating authorization for those modes does not consult this table (§4.3).

### 2.3 Mentor attribution

Nullable `mentor_id text` on `vc_sim_sessions`. Optional on create for every mode. Not validated against rater lists. Surfaced later in evidence/manager reads; for this unit it is write + persist + return on session entity so it cannot be forgotten.

### 2.4 ANTS uniqueness

Add unique constraint on `vc_ants_ratings (session_id, rater_id, domain)`. Today the schema permits multiples; assessment’s “submit once, no amendment” rule needs the database to refuse a second insert for the same domain. Practice formative ratings use the same constraint — a second submission for the same domain is a client error, not a silent overwrite.

### 2.5 Time-in-training column

**Keep** `trainee_time_in_training_days` nullable on the table (no truncating migration; historical rows and create payloads that still send it are harmless).

**Drop** check constraint `vc_sim_sessions_scored_needs_time_in_training` in the same migration.

**Remove every read that treats the value as load-bearing** (see §5). Create may continue to accept an optional number for one release so existing clients/tests do not break mid-migration; the value is stored and never consulted for gates, sorting, or API contracts that previously required it.

---

## 3. Mode at the transport layer

### 3.1 Where mode lives at runtime

`RoomRegistry.getOrCreate` already loads the scenario row. It passes `mode` (from the column, matching the authored JSON) into `SessionRoom.hydrate` as a field on the room, parallel to `seed` and `scenario`. `authorizeIntent` reads `room.mode`. Mode does not appear on engine snapshots; session/scenario HTTP responses expose `mode` so the instructor console can hide inject/pause chrome on assessment without guessing.

### 3.2 Assessment refusals

When `room.mode === "assessment"` and the binder is an instructor station:

| Intent | Result |
|---|---|
| `injection` | refuse with ack code `mode_bound` (message names assessment) |
| `phase_change` with `phase: "paused"` | refuse with ack code `mode_bound` |
| `phase_change` to `briefing` / `running` / `debrief` (start and end path) | allow, subject to existing FSM rules in the reducer |
| trainee intents | unchanged (instructor still cannot send them; those stay `role_bound`) |

Practice and tutorial: today’s instructor flexibility unchanged (pause, inject, end).

### 3.3 Client `scored` is never legal

In **all** modes, any client `phase_change` with `phase: "scored"` is refused in `authorizeIntent` before it reaches the reducer, with ack code `validation` and a fixed message that `scored` is server-only. The only writer of `scored` is the ratings route’s `appendSessionEventsTx` call after the completion check (§4).

This closes the hole D1 would otherwise widen: removing the TiT gate without server-only `scored` would leave a client able to append `scored` through a live instructor socket on a practice or assessment room.

Refused intents are **not** written to the event log (same as today’s role-bound refusals).

### 3.4 Mentor exclusion

Procedural. Operators are instructed not to put the shadowing mentor in the three `raterUserIds`. The API does **not** compare `mentor_id` to the rater list. Enforcing it would require reliable mentor identity at create time for every assessment; the hospital process is the control. The assignment table still makes “which three” auditable after the fact.

---

## 4. Scoring path and lifecycle fork

### 4.1 Assessment submission shape

One HTTP submission per assigned rater while `phase === "debrief"`:

- Body contains **exactly the four** ANTS domains, each with evidence seqs (existing attestation rules unchanged).
- Caller’s auth subject must equal one of the session’s `vc_session_raters.rater_user_id` rows; otherwise `403`.
- Rater must not already have any rating rows for this session; otherwise `409` (unique constraint is the backstop).
- Insert four rows; freeze `log_head_seq` / `log_head_hash` at **this rater’s** submit time (existing attestation helper), so late raters attest the head they actually saw.
- **Do not** append `phase_change → scored` in the same breath as a single rater.

### 4.2 Completion check → `scored`

Still inside the existing `FOR UPDATE` on the session row:

1. After insert, count distinct `rater_id` values in `vc_ants_ratings` for this session that appear in `vc_session_raters` and have all four domains present.
2. When that count equals three, append `{ type: "phase_change", phase: "scored" }` via `appendSessionEventsTx` and return success including `sessionPhase: "scored"`.
3. When the count is less than three, commit the four rows and return success with `sessionPhase: "debrief"`.

Partial domain payloads on assessment are `400` — assessment does not accumulate domain-by-domain.

### 4.3 Practice and tutorial ratings

- Any user who already has session access (same gate as today’s ratings route authz) may submit.
- Partial domain sets allowed (one or more domains per request), still unique per `(session, rater, domain)`.
- **Never** append `scored`. Session remains in `debrief` (or whatever phase the instructor left it in; ratings still require `debrief` as today).
- Ratings are formative annotations for debrief/AAR, not a hiring evidence set.

### 4.4 Lifecycle summary

| Mode | Terminal hiring phase | Who rates | Complete set |
|---|---|---|---|
| `assessment` | `scored` after 3×4 | Assigned three only | Required |
| `practice` | stays `debrief` (then `archived` by existing ops if any) | Session-access users | N/A |
| `tutorial` | same as practice | Session-access users | N/A |

Archived remains an explicit later transition; this unit does not invent a new archive path.

---

## 5. Time-in-training removal

### 5.1 Delete or rewrite these sites in one change

| Site | Change |
|---|---|
| `server/routes/sessions.ts` ratings gate (~495) | Delete `no_time_in_training` branch |
| `0002` check `vc_sim_sessions_scored_needs_time_in_training` | Drop in `0007` |
| `server/routes/manager.ts` throws on null TiT | Stop reading / requiring the field |
| `packages/shared` session + scoring-surface schemas | Drop non-null TiT fields and the entity refinement that forbids `scored` + null TiT |
| `packages/engine` trend sort (`scoring-surfaces.ts` ~86–89) | Sort by `createdAtMs` ascending; tie-break stable by session id if needed |
| Manager / AAR UI + i18n | Remove TiT display and keys (`manager.evidence.tit`, `aar.header.timeInTraining`) |
| Chart axis | Show **session index** (1..n in sorted order) as the within-person x-axis label; underlying order is `createdAtMs` |

### 5.2 What stays

The column. Optional create input for compatibility. Seed/demo data may still populate it; nothing reads it for product behaviour.

---

## 6. Tests and e2e strategy

### 6.1 Strategy B (approved)

The Playwright (or existing) e2e happy path that today rates a session into `scored` becomes a **practice** flow: create practice scenario session → run → debrief → submit formative ratings → assert phase remains `debrief` (and ratings visible).

Assessment completion (third rater flips to `scored`; examiner inject refused; create requires three raters) is covered by **server integration tests** that insert an assessment-mode scenario via Drizzle / seed helpers. A full assessment e2e waits on real merged assessment content.

### 6.2 Required automated coverage (minimum)

- Authored schema rejects missing/invalid `mode`.
- Assessment create: ≠3 raters → 400; practice create with raters → 400.
- Assessment instructor: inject and pause refused; start/end allowed.
- All modes: client `phase_change → scored` refused.
- Assessment: rater 1 and 2 leave phase `debrief`; rater 3 with full 4 domains → `scored`.
- Assessment: non-assigned user → 403; second submit → 409.
- Practice: ratings do not transition to `scored`.
- TiT null: assessment can still reach `scored`; manager endpoints do not 500.
- Trend order follows `createdAtMs` / session index, not TiT.

---

## 7. Migration numbering

This unit owns **`server/db/migrations/0007_*.sql`** (mode column, session_raters, mentor_id, ants unique, drop TiT scored check).

The evidence-spine integrity plan currently names `0007_event_hash_chain.sql` and `0008_event_chain_trigger.sql`. When that plan is executed **after** this unit, those files renumber to `0008` / `0009` (or whatever the next free pair is). The integrity **design** is unchanged; only filenames and plan task headings move. Provenance plan has no migration conflict today.

Do not land integrity’s `0007` on `master` before this unit’s migration without reconciling numbers in the same change.

---

## 8. Files expected to move (implementation preview, not a plan)

This section orients the future writing-plans pass; it is not task-sized.

- `packages/shared/src/authored-scenario.ts` — `mode`
- Scenario JSON fixtures + seed paths — `"practice"`
- `server/db/schema/scenarios.ts`, `sessions.ts`, new raters schema; migration `0007`
- `server/live/session-room.ts`, `room-registry.ts`, `socket.ts` (`authorizeIntent`)
- `server/routes/sessions.ts` — create + ratings
- `server/routes/manager.ts`, shared scoring schemas, engine trend, manager/AAR UI + i18n
- Tests listed in §6; e2e retarget

Engine reducer and event taxonomy: **untouched**, except that client-originated `scored` never reaches them.

---

## 9. Success criteria

1. An assessment session can receive three full ANTS submissions; only the third moves the log to `scored`.
2. An examiner connected as instructor on an assessment session cannot pause or inject; refused intents leave no log residue.
3. Practice sessions can be rated without entering `scored`, and e2e proves that path.
4. No code path required for scoring or manager views reads time-in-training.
5. Mode is visible in scenario data and enforceable in `authorizeIntent` without entering `EngineState`.
6. Mentor id can be stored on create; excluding the mentor from the three raters is procedural, not API-enforced.

---

## 10. Explicit non-goals restated

Tutorial coaching/reveal, scenario merge, hash chain, provenance, evidence packet, seat-labelled raters, leaderboards, personalized hiring scenarios, VR/appliance — all remain outside this unit.