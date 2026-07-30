# Event Taxonomy — the canonical vocabulary of the log

**Status:** authoritative registry. The event log is the system of record (CLAUDE.md
§4); this document is the system of record for what may *enter* it. Worktrees isolate
files, not vocabulary — two parallel agents inventing two names for the same concept
merge cleanly in git and are broken at the doctrine level. This registry exists so
that cannot happen silently.

**Enforcement:** `packages/shared/test/event-taxonomy.test.ts` parses the engine
event-type list below and fails if it disagrees with the runtime schema
(`engineEventBodySchema` in `packages/shared/src/event-bodies.ts`). The test runs
under `pnpm test` — drift breaks CI without any workflow change.

## Governance rules

1. **Append-only.** An event type or action name, once shipped, is never renamed,
   deleted, or repurposed — the log must replay forever (§4: "never update event
   data"). Deprecation = stop *emitting*, keep *reducing*.
2. **Same-commit rule.** No new event type or action ships without updating this
   document in the same commit. The parity test enforces this for event types;
   review enforces it for actions.
3. **No verdict events, ever** (founder decision 2026-07-30). A *verdict* is a
   judgment ("this was correct", "this was a closed loop") — judgments live only in
   post-run analysis over the log, never in it. A *raw capture* is a fact ("at
   T+47s role X did/said Y") — capture events are permitted and are the substrate
   post-run analysis runs on. The log can only replay what was recorded: a run
   without capture is unrecoverable, so this distinction is doctrine, not style.
4. **Naming:** `snake_case`, verb-first for actions (`oxygen_on`,
   `iv_access_attempt`), noun for event types. Hebrew never appears in identifiers —
   it lives in `label`/`labelHe` fields.
5. **Role attribution is non-negotiable:** any event representing a human act
   carries `role` and `actorId`.

## Engine event types

The complete, closed set. Adding a member means: extend
`packages/engine/src/events.ts`, `packages/shared/src/event-bodies.ts`, the reducer,
this list, and (if client-originated) `clientIntentSchema` in
`packages/shared/src/live-contracts.ts` — one commit.

- `tick` — time advancing; the ONLY way time enters the reducer. Server-emitted.
- `action` — a role-attributed trainee act, named by a scenario-declared action id.
- `injection` — instructor fired a scenario injection menu item. Instructor-only.
- `phase_change` — session FSM transition (draft → briefing → running ⇄ paused →
  debrief → scored → archived). Instructor/server-only.
- `task_start` — trainee opened a stepped task.
- `task_submit` — trainee submitted a task; the submission is recorded **verbatim,
  uninterpreted** — correctness is computed only post-hoc (SRS §5, rule 3 above).

## Action vocabulary (scenario-scoped)

Actions are declared per scenario under `actions[]`
(`scenarioActionSchema`: `id`/`label`/`labelHe`), and schema validation already
rejects a checklist item referencing an undeclared action
(`packages/shared/src/authored-scenario.ts`). The union across shipped scenarios:

| Action id | Meaning | Declared in |
|---|---|---|
| `airway_pulses_check` | Airway/pulses assessed | base-rung-resp-distress |
| `oxygen_on` | Oxygen started | base-rung-resp-distress |
| `iv_access_attempt` | IV access attempted | base-rung-resp-distress |
| `give_drug_sc` | Medication given via SC (correct) route | base-rung-resp-distress |
| `give_drug_iv_wrong_route` | SC-only drug given IV (route error — floor-failure anchor) | base-rung-resp-distress |
| `vitals_callout` | Vitals change called out (communication capture hook) | base-rung-resp-distress |
| `check_chart` | Chart consulted | base-rung-resp-distress |

Reuse an existing id when the meaning matches; never overload one with a second
meaning. New scenario-specific actions extend the scenario's `actions[]` and this
table.

## Reserved / deferred

- Crew-mode raw communication capture (TeamSTEPPS vocabulary: SBAR, call-out,
  check-back) is **deferred until a second live role exists** — in the solo base
  rung there is no counterparty whose half of the loop could be captured. When crew
  mode lands, those captures enter as `action` events with new action ids (raw
  facts), never as verdict events (rule 3).
