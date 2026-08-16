# Evidence spine integrity — design

**Date:** 2026-08-02
**Status:** design approved by founder, section by section; awaiting spec review before an implementation plan is written
**Scope owner:** Dan (solo)

---

## 1. Why this work, and why first

An architecture review of a proposed VR-first pivot concluded that VetCrew stays web-first and event-sourced, that motor skills are addressed by instrumented physical trainers feeding the same append-only log, and that hiring output stays an evidence packet rather than a verdict. Two independent research passes converged on that architecture. That decision is not yet written into the repository: **ADR-002 is outstanding**, and must record that ADR-001's first revisit trigger genuinely fired on the motor-skill argument and that the revisit resolved against headset VR on measured tracking precision and on the AVMA CVTEA live-animal requirement. Without it, CLAUDE.md §7 ("do not re-open without hitting one of those triggers") gets re-litigated from memory. ADR-002 is tracked separately from this spec and is not a dependency of it.

Every downstream path in that roadmap — crew mode, an instrumented trainer, a hiring evidence packet, an offline appliance — depends on the event log being trustworthy. This is the first unit of work because it is small, it unblocks all four, and one of its three items is a live authentication bypass.

**Doctrine this serves.** CLAUDE.md §2.3 (any score influencing a hiring decision must be traceable to timestamped, role-attributed events), §2.5 (clinical claims that drive a score need sign-off), and §4 (the log is authoritative, all state is derived).

### In scope

1. A per-event hash chain on `vc_session_events`, replacing the whole-log snapshot digest as the integrity mechanism.
2. Enforcement that the two bypass flags cannot run in production.
3. Wording changes in docs and the manager evidence desk so the mechanism is described accurately.

### Out of scope, deliberately

- **Signing the chain head and external anchoring.** These need a key-management story that belongs with the appliance ADR (Phase 4). The chain is the precondition for that work, not a substitute for it.
- **A standalone verifier CLI and the exportable evidence packet format.** Phase 2. Building the tool before the format exists would be guessing.
- **Per-claim clinical review schema.** A different subsystem (scenario authoring), scoped out of this spec by founder decision so this one keeps a single purpose.
- **Constraining `action.payload`.** See §2.4; it would be good hygiene but it is an event-taxonomy change.

---

## 2. Data model and hash definition

### 2.1 Columns

Migration `0007_event_hash_chain.sql` adds to `vc_session_events`:

| Column | Type | Constraint |
|---|---|---|
| `prev_hash` | `text` | `^[a-f0-9]{64}$` when not null |
| `event_hash` | `text` | `^[a-f0-9]{64}$` when not null |

Both are **nullable in the schema and mandatory in practice**, enforced by the trigger in §3.2 rather than by `NOT NULL`.

This is a deliberate choice and the reasoning should survive into the future. All existing event data is disposable, so the simplest reading would be a truncating migration with `NOT NULL` columns. That is rejected: `runMigrations` executes automatically at boot against whatever `DATABASE_URL` points at, and the append-only trigger in `0001_init.sql` (lines 62–71) blocks `DELETE`, so a truncating migration would have to drop that guard, delete, and recreate it — a destructive auto-running migration aimed at a future database, for no benefit. Nullable columns plus a trigger that rejects `NULL` on insert give an identical guarantee for every new row at no extra cost, since the trigger is being written regardless.

It also matches the precedent already set in `0006_evidence_attestation.sql`:

> `NULL/NULL = historical unattested row (never pretend it was attested).`

A null-hash region is reported by the verifier as **unchained** — never as verified, and never as tampered.

### 2.2 Genesis

At `seq = 1` there is no predecessor, so `prev_hash` is derived from session identity rather than being a fixed constant. This prevents a valid chain being lifted wholesale out of one session and replayed into another.

```
genesis = sha256(canonical([
  "vetcrew.chain-genesis.v1",
  tenant_id,
  session_id,
  scenario_id,
  scenario_version,
  seed
]))
```

All five inputs are already on the session row that `appendSessionEventsTx` locks with `.for("update")` at `server/live/event-append.ts` line 40, so this adds no query.

### 2.3 Per-event preimage

The existing `eventLogPreimage` in `server/evidence-attest.ts` joins fields with `|` and `\n`, which is injection-prone if a role or actor id ever contains a delimiter. The chain instead hashes a canonical JSON array:

```
event_hash = sha256(canonical([
  "vetcrew.event.v1",
  prev_hash,
  session_id,
  seq,
  type,
  role,        // null when the event is not a human act
  actor_id,    // null when the event is not a human act
  recorded_at, // ISO-8601 UTC, millisecond precision
  payload
]))
```

Delimiter-safe by construction, version-tagged so the scheme can evolve, and one encoder covers both the array and the nested payload.

**`recorded_at` moves from database default to application-set.** It is currently `defaultNow()` in `server/db/schema/events.ts`. Including it in the preimage requires the application to know it at compute time, and binding it means timestamps cannot be shifted without breaking the chain. Determinism is unaffected — the reducer never reads wall clock, and time enters only through `tick` events. There is exactly one writer (`appendSessionEventsTx`), and on an appliance the application and the database are the same machine, so nothing is lost by moving the clock read into the application.

**Timestamp precision is a round-trip hazard and must be pinned.** The canonical form is `Date.prototype.toISOString()` — always UTC, always exactly three fractional digits. Postgres `timestamptz` stores microsecond precision, so a value written at millisecond precision reads back as the same instant with zero microseconds and re-serialises identically. Verification must re-derive the string from the database value using the same `toISOString()` call rather than reading a driver-formatted string. Any code path that writes a sub-millisecond timestamp would silently break every subsequent verification, which is precisely the failure class §2.4 exists to prevent; §5.1 covers it.

### 2.4 Canonical encoding

The encoder must produce byte-identical output for a value constructed in memory and for the same value after a round trip through Postgres `jsonb`. This is the single most likely source of a silent failure: `jsonb` sorts object keys, drops duplicates, and normalises whitespace, so today's `JSON.stringify(row.payload)` in `eventLogPreimage` is stable only because it is *always* called on database-read rows. A chain computed at insert time does not have that luxury.

Implementation is RFC 8785 (JSON Canonicalization Scheme) semantics: object keys sorted by UTF-16 code unit, no insignificant whitespace, numbers formatted per ECMA-262 `Number::toString`, strings escaped per JSON.

**Deviation from the design as presented.** During section review this was described as requiring a small RFC 8785 dependency, on the grounds that `actionBodySchema` declares `payload: z.unknown().optional()` so arbitrary JSON can legitimately enter the log. On implementation inspection a dependency is not warranted: `JSON.stringify` already implements the two genuinely hard parts to specification — ECMA-262 number formatting and JSON string escaping — so a compliant encoder for JSON-safe values is a short recursive function that sorts object keys and delegates primitives to `JSON.stringify`. It **must throw** rather than silently coerce on values JSON cannot round-trip: `undefined`, functions, symbols, `NaN`, `Infinity`, and `BigInt`. Given the repository's deliberately lean dependency list, a well-tested local function is preferable to a dependency. Tests in §5.1 carry the burden of proving it.

The encoder lives in `server/`, alongside `evidence-attest.ts`, which is where hashing already lives. It is deliberately not placed in `packages/shared`, which is imported by the React client — `node:crypto` in shared would be a bundling hazard. `scripts/check-boundaries.ts` enforces only engine purity and web/server separation, so `server/` is unconstrained here. If Phase 2's evidence export needs the encoder elsewhere, move it then.

---

## 3. Write path, enforcement, verification

### 3.1 `appendSessionEventsTx`

Four edits to `server/live/event-append.ts`, a function that already has the right shape because it is the sole sequencing authority and already serialises per session.

1. The head query at lines 48–53 selects `{ seq, eventHash }` instead of `{ seq }`.
2. The mapping loop at line 56 becomes a fold that threads the chain. `prev` starts at the head's `event_hash`, or the §2.2 genesis when the log is empty. Each event sets `prev_hash = prev`, computes `event_hash`, and becomes the next `prev`. **The batch case is the part that is easy to get wrong:** this function accepts multiple bodies in one call, so the chain must link *within* the batch, not only to the previous batch.
3. The insert at line 63 carries `prev_hash`, `event_hash`, and an application-set `recorded_at`.
4. Nothing else moves. The session row lock at line 44 already serialises appends per session, so the same guarantee that makes the `max(seq)` read safe makes the head-hash read safe.

### 3.2 Trigger: linkage only

A `before insert` trigger on `vc_session_events`, modelled on `vc_enforce_seq_contiguity` in `0004_seq_authority.sql`, which established the pattern of the application assigning a value and the database enforcing its invariant.

The trigger:

- rejects a null `prev_hash` or `event_hash`;
- looks up the current head for the session and requires `new.prev_hash` to equal its `event_hash`;
- rejects with an explicit "cannot extend an unchained log" when a head exists but its `event_hash` is null, rather than failing confusingly on a null comparison.

Format is left to a `CHECK` constraint so each mechanism has one job.

This works for batched appends because `BEFORE INSERT ... FOR EACH ROW` fires per row and sees earlier rows from the same transaction, so the second event in a batch finds the first as its head. That is the same property `vc_enforce_seq_contiguity` already relies on.

**Two limits, stated rather than buried.** At `seq = 1` there is no head, so the trigger can only require that `prev_hash` is present and well formed — validating the genesis derivation would require the canonical encoder in plpgsql, which is exactly what this approach exists to avoid. And the trigger never recomputes content hashes, so it catches splicing, reordering, and mid-log insertion, but not a row whose `event_hash` does not match its own content. Content correctness is the verifier's job (§3.3).

**Residual risk, unchanged by this work.** An actor with direct database access can still rewrite an entire tail into a self-consistent fake chain. Closing that requires a signed head and external anchoring, which is Phase 4.

### 3.3 Verifier

One pure function over the ordered rows plus the session identity, returning a discriminated result:

| Result | Meaning |
|---|---|
| `ok` | with `headSeq` and `headHash` |
| `unchained` | with the first seq whose hashes are null |
| `broken` | with the seq and the reason: content mismatch, link mismatch, or bad genesis |

It recomputes every event hash, checks each link, and checks the genesis derivation — covering exactly the gaps the trigger cannot.

### 3.4 Attestation

`server/evidence-attest.ts` gets simpler and stronger.

- `hashEventLog` currently rehashes the entire log on every attestation. With a chain the head hash **is** the last row's `event_hash`, so that whole-log pass disappears.
- `attestEvidenceSeqs` keeps its evidence-seq existence check, gains a verifier call, and **refuses to attest when the chain does not verify**. Attesting a broken chain would be worse than declining to attest. This turns a silent integrity problem into a hard failure on the rating path, which is intended.
- `log_head_seq` and `log_head_hash` on `vc_ants_ratings` keep their names. What changes is that the value is a chain head rather than a snapshot digest.

No algorithm-version column is added. The scheme version is already embedded in every preimage as `vetcrew.event.v1`, and the artifact that genuinely needs to declare it to an outside verifier is the exportable evidence packet, which is Phase 2.

### 3.5 Determinism is structurally untouched

The chain lives in columns, not in `payload`. Hydration in `server/live/room-registry.ts` selects only `payload` and parses it with `engineEventSchema`, so `replay()` in `packages/engine/src/reducer.ts` never sees a hash. The engine package keeps its zero runtime dependencies. §5.4 keeps it that way.

---

## 4. Bypass lockdown

There are exactly two bypass flags. Both are already documented as forbidden in production in three places — `.env.example` lines 19–24, `README.md` line 45, and `docs/doctrines/readiness-scoring.md` lines 82–83 ("must never be set in production") — and enforced in none. This section converts existing doctrine into a guard.

### 4.1 The hole, concretely

`parseTestBearer` is checked **before** Clerk in both `readAuth` (`server/auth.ts` line 98) and `readAuthFromToken` (line 114), and `isTestAuthEnabled()` at line 17 is a bare `process.env.VETCREW_TEST_AUTH === "1"` with no environment guard. `loadEnv` validates that Clerk keys are present in production but never checks that test auth is absent. A production or appliance deployment with Clerk fully configured, plus `VETCREW_TEST_AUTH=1` set by accident or by anyone with environment access, accepts `Authorization: Bearer test:anyone:manager` as an authenticated manager.

`VETCREW_ALLOW_UNREVIEWED_SCORES` is the same class of hole against a different boundary: read inline at `server/routes/sessions.ts` lines 466–472, it bypasses the §2.5 clinical-review gate, so an unreviewed scenario could score a real person.

The third bypass, `allowDevBypass` at `server/index.ts` line 77, is **already** correctly gated on `NODE_ENV === "development"` and needs no change.

### 4.2 Fixes

**Boot gate.** `loadEnv` in `server/env.ts` gains both flags in the zod schema and throws in production when either is set, extending the `missing` block at lines 24–31. The server refuses to start rather than starting compromised, which is the right direction of failure for a box sitting in a hospital.

**Use-site gates.** Two one-line checks, so the property is local to the module that owns it rather than dependent on boot ordering: `isTestAuthEnabled()` returns false in production, and the clinical-review escape hatch does the same. This matters because unit tests import `parseTestBearer` directly without ever calling `loadEnv`, and a future entry point could too.

**Health endpoint.** `/api/health` at `server/index.ts` lines 45–59 reports `auth: "clerk" | "dev-bypass"`. Add `"test"` so a misconfigured non-production box is visible at a glance. This discloses nothing that `dev-bypass` does not already, and production can no longer boot in that state.

**Docs.** The three locations above change from "never set this" to "cannot be set — enforced at boot."

### 4.3 CI is unaffected — verified, not assumed

E2E runs `pnpm dev:server`, which does not set `NODE_ENV`, so zod defaults it to `development` and direct `process.env.NODE_ENV` reads see `undefined`. Both are non-production. Vitest sets it to `test`. Every existing test that sets either flag continues to work untouched, including `server/test/auth-roles.test.ts`, `socket-authz.test.ts`, `sessions-auth.test.ts`, `manager.test.ts`, `scenarios-ratings-gate.test.ts`, and `integration.test.ts`.

### 4.4 One honest limitation

Both checks key on `NODE_ENV` explicitly equalling `"production"`, so they can only ever fail permissive, never restrictive. The protection depends on the deployment actually setting it — which `Dockerfile` line 14 does, `README.md` line 37 requires, and the codebase already trusts for a security decision at `server/index.ts` line 39 ("Clerk keys are required outside development"). This is consistent with an existing dependency rather than a new one.

For Phase 4: an appliance should not lean on `NODE_ENV` as a proxy for deployment profile, and the appliance ADR should introduce an explicit one. Building that now would be speculative.

---

## 5. Testing

All server tests live in `server/test/` and run under `pnpm test:integration` (`vitest.integration.config.ts`, `include: ["server/test/**/*.test.ts"]`, `fileParallelism: false`). This is the existing convention — `auth-roles.test.ts` needs no database and lives there already — so no new suite is introduced. `pnpm test` covers only `packages/engine` and `packages/shared`.

### 5.1 Round-trip coverage — the priority

The chain's only real failure mode is a serialization mismatch that stays silent until someone tries to verify an evidence packet. This must be an integration test: the whole point is what Postgres does to `jsonb`, so an in-memory unit test would prove nothing.

For each of the six event types (`tick`, `action`, `injection`, `phase_change`, `task_start`, `task_submit`), each of the seven `TaskSubmission` variants (`value_entry`, `choice_chain`, `med_admin`, `tube_choice`, `step_order`, `fluids_setup`, `escalate`), and an `action` carrying a non-trivial `payload`: append through `appendSessionEventsTx`, read the row back, re-canonicalize, and assert the recomputed hash equals the stored one.

Payload cases must deliberately include what breaks canonicalizers:

- Hebrew strings — realistic for this product and a genuine unicode-escaping test
- `0.1`, `0`, negative numbers, and a large exponent such as `1e21`
- nested objects with keys that sort differently by insertion order than by code unit
- an empty object and an empty array

Encoder unit tests additionally assert that `undefined`, `NaN`, `Infinity`, and `BigInt` **throw** rather than coerce.

### 5.2 Chain and trigger tests

Integration, since they exercise database behaviour.

- Sequential appends link correctly.
- A batched append links within the batch.
- `seq = 1` carries the derived genesis, and two different sessions produce different genesis values.
- Tamper tests, which must bypass `appendSessionEventsTx` and insert directly via SQL to mean anything, and must use a **correct seq** so they clear the contiguity trigger from `0004` and actually exercise the new linkage trigger. Rejection cases: wrong `prev_hash`, null hashes, extending an unchained log.
- The `CHECK` constraint rejects a malformed hash.

### 5.3 Verifier tests

Pure function over row fixtures: verifies a good chain; detects a mutated payload at the correct seq; detects a broken link; detects a bad genesis; reports the unchained case rather than conflating it with either success or tampering.

### 5.4 Attestation and determinism

Extends `server/test/evidence-attest.test.ts`: the returned head hash is the last row's `event_hash` rather than a whole-log rehash; attestation refuses when verification fails; existing evidence-seq existence behaviour is unchanged.

One determinism regression test asserts that an engine event parsed back out of a chained row is identical to what was appended, keeping §3.5 true.

### 5.5 Bypass lockdown tests

A new `server/test/env.test.ts` plus additions to `server/test/auth-roles.test.ts`: `loadEnv` throws in production with either flag set; `loadEnv` succeeds in production with neither set and the required variables present; `parseTestBearer` returns null in production even when the flag is on; and existing development and test behaviour is explicitly asserted unchanged, since that assertion is what protects CI.

### 5.6 Not being added

- **No write-time read-back verification on the append path.** It would double database round trips on the 1 Hz tick path to guard a risk §5.1 already closes. Add it the day a mismatch appears in the wild.
- **No performance benchmark.** One SHA-256 per event against one to three concurrent sessions is not measurable.
- **No standalone verifier CLI.** Phase 2, with the evidence packet format.

---

## 6. Acceptance criteria

1. Every row appended through `appendSessionEventsTx` carries a `prev_hash` and `event_hash` that verify.
2. A direct SQL insert with a correct seq but a wrong `prev_hash` is rejected by the database.
3. A mutated payload is detected by the verifier, at the correct seq, with a content-mismatch reason.
4. `attestEvidenceSeqs` returns the chain head and refuses to attest an unverifiable chain.
5. `replay()` output is unchanged; the engine package still has zero runtime dependencies.
6. The server refuses to boot in production with either bypass flag set.
7. `parseTestBearer` returns null in production regardless of the flag.
8. `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm guard:deps`, and `pnpm guard:dead` all pass unchanged.
9. Docs and the manager evidence desk describe the mechanism as a chain head.

## 7. Follow-ups this spec deliberately creates

| Follow-up | Phase | Why deferred |
|---|---|---|
| Signed chain head and external anchoring | 4, appliance ADR | Needs a key-management story |
| Exportable evidence packet declaring the hash scheme | 2 | Format does not exist yet |
| Explicit deployment-profile concept instead of `NODE_ENV` | 4, appliance ADR | Speculative until an appliance exists |
| Per-claim clinical review schema | 1 remainder | Different subsystem; scoped out to keep this spec single-purpose |
| Constraining `action.payload` to a real schema | Event taxonomy | Would remove the need for a general encoder, but is a taxonomy change |
