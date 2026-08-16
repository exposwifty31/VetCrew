# Clinical claim provenance — design

**Date:** 2026-08-03
**Status:** design approved by founder, section by section; awaiting spec review before an implementation plan is written
**Scope owner:** Dan (solo)

---

## 1. Why this work

CLAUDE.md §2.5 makes clinical accuracy a liability boundary, and §8 requires that "clinical claims that drive a score need sign-off before they score anyone" with "the reviewer and the scenario version recorded alongside the claim." Today the system records a reviewer alongside the **file**.

`base-rung-resp-distress.json` carries one `clinicallyReviewed` boolean and one `clinicalReviewer` string above **22 separate clinical claims**: three vitals asserting baselines and deterioration trajectories, three triggers asserting treatment response, seven actions whose labels assert drug facts, six checklist items asserting correct practice and its relative weight, and two injections. `base-rung-stepped-tasks.json` carries 14, including seven task bodies whose answer keys are the sharpest claims in the codebase — `criticalRouteIds` literally encodes "this route is fatal-class for this drug."

Three concrete defects follow.

**No granularity.** A reviewer setting the flag signs 22 claims at once and the record shows only a name. Nothing says which she examined.

**No source.** Nothing records that CPR sequencing rests on RECOVER 2024 rather than on memory, and nothing expires when the guidance is revised.

**Review survives content change.** `syncScenarios` upserts on `(tenantId, slug, version)` and sets `clinicallyReviewed` from the file, so editing `0.1.0` in place updates the definition and leaves the review flag standing. Nothing detects it.

The defect that matters most for the product's stated purpose is the last one combined with the first. When a candidate loses three points on `checklist:no-route-error`, the defensible artifact is the clinical basis for *that item* — reviewer, date, source, and the claim exactly as it stood during their session. A file-level boolean cannot produce that sentence.

### Founder constraint governing the whole design

Build the architecture for granular, claim-level resolution — source citations, expiry, versioning — but do **not** block the workflow at the UI or gate level until the Reviewer is actually on board.

The failure mode of that instruction is a schema of empty fields that nothing forces anyone to fill, which is the tech debt it was meant to prevent. The resolution running through this document is a split by lifecycle and author:

- **Claim identity, source provenance, and content versioning** are authorable by Dan today with zero dependency on the Reviewer. These are **mandatory now**.
- **Review sign-off, reviewer identity, date, and expiry** require her. These stay **nullable and ungated**.

The half under our control gets exercised from day one.

### In scope

1. A claim model: seven claim types, derived references, and a content hash over load-bearing fields.
2. Mandatory source provenance per claim, with a registry of sources and their lifecycle.
3. An append-only review registry, file-first, with six derived per-claim statuses.
4. A gate indirection that preserves today's behaviour and makes the future switch a small diff.

### Out of scope, deliberately

- **Any UI.** No reviewer dashboard, no manager-desk widget, no AAR badge. Visibility is a report script and the pull-request diff.
- **Any review API or CRUD.** Sign-offs arrive as a committed file.
- **The evidence packet that consumes this.** Phase 2. It is the real payoff and it is not this spec.
- **Flipping the ratings gate to claim-level.** Deliberately deferred to the day the Reviewer engages; §5.1 makes it a small diff.

---

## 2. The claim model

### 2.1 Seven claim types

`presentation`, `vital`, `trigger`, `action`, `checklist`, `task`, `injection`. Everything else in a scenario — `scoringDimensions`, `roles`, the task chip `code`, the `hidden` flag, `title` — is pedagogical or presentational and asserts nothing clinical.

| Scenario | presentation | vital | trigger | action | checklist | task | injection | total |
|---|---|---|---|---|---|---|---|---|
| `base-rung-resp-distress` | 1 | 3 | 3 | 7 | 6 | 0 | 2 | **22** |
| `base-rung-stepped-tasks` | 1 | 5 | 1 | 0 | 0 | 7 | 0 | **14** |

`action` is a claim type despite most instances being trivial, because an allowed-action list is an active clinical assertion about which routes are valid or contraindicated: `give_drug_iv_wrong_route` asserts the drug is SC-only, in a label a trainee reads.

### 2.2 References are derived, never authored

A claim reference is `<type>:<id>` — `vital:spo2`, `trigger:oxygen-recovers`, `checklist:no-route-error`, `task:t3`, `action:give_drug_iv_wrong_route`, `injection:monitor_artifact`. Every id already exists and is already uniqueness-checked by `authoredScenarioSchema`. Nothing new to maintain, and a renamed id fails to resolve rather than silently inheriting a sign-off.

`presentation:scenario` is the one pseudo-element with no array entry — `scenario` is a literal, not a substitution. Its content is named explicitly rather than derived: `species` and `presentingComplaint`, and nothing else. Not `title`, which is a filename for humans.

### 2.3 The hash is a denylist

The claim hash covers the **entire element** except four explicitly named exclusions — three presentational or pedagogical, plus the id:

| Excluded | Why |
|---|---|
| any key ending in `He` | Translations. A Hebrew typo fix or a terminology localization must not invalidate a clinical sign-off. |
| `code` | Task chip colour. Task-surface presentation. |
| `hidden` | Pedagogical design (SRS T7 escalation), not a clinical claim. |
| `id` | It is the reference, not the content. Renaming it fails to resolve the sign-off, which is the correct signal. |

An allowlist would mean a clinical field added to the schema next year silently escapes every hash and no review notices. A denylist fails safe: new fields are load-bearing by default, and exempting one becomes a deliberate, reviewable act.

Consequences worth stating because they were decided rather than inherited:

- **`label` (English) is hashed.** It is the sentence the reviewer read when she signed.
- **`role` is hashed** on checklist items and tasks. Who performs a step is governed by scope-of-practice, so silently moving a critical safety check to a different role must invalidate the review.
- **`weight` is hashed.** Relative importance is a clinical judgment.
- **The whole `body` of a task is hashed** minus Hebrew fields — including `expectedMl`, `expectedRouteId`, and `criticalRouteIds`.

### 2.4 The granularity floor is the element, not the field

`trigger:oxygen-recovers` carries three effects — SpO₂ to 96, RR to 36, HR to 120 — and they are **one** claim, because "what does oxygen do to this patient" is one thing a clinician reasons about. Splitting per effect would make the reviewer sign three times for one physiological response.

### 2.5 Machine-checkable claims are validation, not review

Several assertions are arithmetic rather than judgment and belong in schema validation, never on a scarce reviewer's desk:

- `expectedMl` must equal `doseMg / concentrationMgPerMl`, compared with a relative tolerance of `1e-9` so authored decimals such as `0.1` do not fail on binary float representation.
- `expectedRouteId` must never appear in `criticalRouteIds`.
- `expectedMin` must not exceed `expectedMax`.
- `expectedOptionId` must exist among that step's `options`; `expectedOptionIds` and `expectedOrder` must all resolve; `expectedSetId` must resolve to one of `sets`.

**Correction, found while verifying against the shipped scenario.** An earlier draft listed a fluids arithmetic check — "the expected rate must follow from `orderedMlPerHr × dropsPerMl / 60`." There is nothing to check: `fluids_setup` stores no expected drops-per-minute, because the answer is derived at evaluation time from `expectedSetId` and the ordered rate. The checkable invariant is resolution of `expectedSetId`, which is what the list above now says. All checks above pass on both shipped scenarios today, verified before this spec was written.

Catching an authoring slip in CI rather than in her inbox matters when the reviewer is one person who does not work here.

---

## 3. Source provenance

### 3.1 Three provenance kinds, as a discriminated union

Omission is not expressible. You may only choose a kind, and two of the three demand you write something.

| Kind | Fields | Meaning |
|---|---|---|
| `cited` | `sourceId`, optional `locator` | Published guidance, resolved against the registry. |
| `floor_observation` | `observer`, `observedAt`, `note` | Observed at the pilot site. |
| `internal` | `rationale`, minimum 20 characters | No external basis. This is the countable debt. |

`floor_observation` is a first-class category rather than a failure to cite. CLAUDE.md §2.7 records that the route-error and priority-inversion anchors came from observed floor failures and calls them "IP, not content"; §8 requires they be signed off like any other clinical claim. A schema with no home for them would push the most distinctive content in the product into the unsourced bucket.

The 20-character floor on `internal.rationale` exists so `"n/a"` and `"none"` fail validation. That friction is the point.

### 3.2 Provenance lives in a root-level map, keyed by claim reference

```
claimSources: {
  "vital:spo2": {
    kind: "cited",
    sourceId: "recover-2024",
    locator: "Monitoring, Table 3"
  },
  "checklist:no-route-error": {
    kind: "floor_observation",
    observer: "Dan (ER floor, pilot site)",
    observedAt: "2026-07-12",
    note: "SC-only drug given IV during a busy shift; the route error is the anchor this item exists to test."
  },
  "action:check_chart": {
    kind: "internal",
    rationale: "Generic verb with no clinical assertion beyond 'a chart exists and can be consulted'."
  }
}
```

**Deviation from Section 2 as presented during review, and the reason.** The design was described as sources living inline on each element. Writing it up, that turns out to be wrong for two elements: `vitalParamsSchema` and `triggerDefSchema` are consumed by `compileScenario` into the engine's `ScenarioDef`, which lands inside `EngineState`. Provenance metadata reaching engine state would mean a citation change could alter replay output — a determinism violation, and exactly the class of bug the engine's purity rules exist to prevent. Stripping at compile is possible but adds a failure mode nobody would remember.

A root-level map avoids the problem entirely and turns out to be better on its own merits: it keeps every engine-bound schema untouched, it gives one place to read all provenance, and it makes the mandatory rule a **set equality** between extracted claim references and map keys — which catches orphaned entries as well as missing ones. Per-element optional fields could only ever catch the missing half. Sources still version with content because they live in the same file.

### 3.3 The source registry

A committed data file, synced to the database at boot exactly like scenarios. Each entry:

| Field | Purpose |
|---|---|
| `id` | The stable token claims cite. |
| `title`, `publisher`, `edition`, `url`, `retrievedAt` | Human-facing metadata. Mutable without invalidating anything. |
| `status` | `current`, `superseded`, or `withdrawn`. |
| `supersededBy` | The replacing source id, when superseded. |

Separating the token from the metadata is what lets a dead URL be fixed without invalidating clinical provenance, while changing a claim's basis from `recover-2020` to `recover-2024` moves the token, moves the hash, and correctly forces a re-look.

`supersededBy` is what makes expiry derive rather than get hand-maintained: the day RECOVER 2028 is added and 2024 is marked superseded, every dependent sign-off flags itself with nobody remembering anything.

**A claim citing a `withdrawn` source is a hard load-time error, not a warning.** Withdrawn means the guidance was retracted; a scenario built on it should refuse to load, let alone score anyone.

### 3.4 Where the schemas live

The source union and the `claimSources` map are plain Zod and belong in `packages/shared` beside `authoredScenarioSchema`, so client and server validate identically.

**Claim extraction also lives in `packages/shared`,** which corrects an earlier draft that placed it server-side. The mandatory-provenance rule is a set equality between extracted claim references and `claimSources` keys, and that check belongs inside `authoredScenarioSchema.superRefine` where every other structural rule already lives — which means extraction has to be importable from there. It is pure, needs no crypto, and is a few dozen lines.

Hashing and status derivation stay server-only: hashing needs `node:crypto`, which must not enter a package the React bundle imports.

---

## 4. The review registry

### 4.1 Sign-offs bind to content, not to a version

The claim hash covers the scenario **slug**, the claim reference, and the canonicalized load-bearing fields — deliberately **not** the scenario version.

So bumping `base-rung-resp-distress` from `0.1.0` to `0.2.0` to fix a Hebrew label or add an injection re-reviews nothing: every unchanged claim keeps its sign-off, and only what actually moved returns to the reviewer. This inverts today's behaviour, where a version bump either drags a stale blanket approval forward or discards a perfectly good review.

The slug is inside the hash on purpose. "Oxygen takes SpO₂ to 96" is a claim about *this* patient in *this* presentation, so an identical-looking claim in a different scenario earns its own look.

### 4.2 Reviewer and attestor are different people, and the schema says so

The Reviewer has no login, may never have one, and does not work on this project. A sign-off therefore records her as **data** — name, clinical credential, the date she signed, and `attestationRef` pointing at the artifact she actually signed — while separately recording the authenticated user who transcribed it.

The record's honest claim is *"Dan recorded, on the 5th, that Reviewer X approved claim Y on the 4th, per this countersigned memo."* That is weaker than "X approved Y," and it is the true statement. When she eventually has a login the two fields converge and nothing else changes.

### 4.3 File-first, append-only

Sign-offs arrive as a committed data file. No UI, no API, no onboarding — which is what keeps the workflow unblocked. She signs something out-of-band, the artifact is referenced, and the transcription lands in a pull request where the diff is legible and git records authorship.

**Correction: no database tables, and no forbid-mutation trigger.** An earlier draft had both registries synced to Postgres like scenarios, with the event log's append-only trigger applied to reviews. Those two requirements contradict each other — a boot-time sync has to upsert rows that already exist, which an append-only trigger would reject, so the server would fail to start on its second boot. Resolving it in favour of the trigger would mean abandoning sync; resolving it in favour of sync would mean an append-only guarantee that only holds until the next deploy.

Neither is necessary. Scenarios are in Postgres because sessions carry a foreign key to them; sources and reviews have no such need, nothing queries them outside the gate, and the gate runs in-process. Both registries load at boot from their files and are held in memory, passed to the session router as options. **Append-only-ness comes from git**, which is stronger than a database trigger for this purpose: it records who made each change, when, and in what pull request, and a deleted approval shows up as a red line in a diff rather than as an absence nobody notices.

The append-only *discipline* is unchanged. A changed mind is a new entry appended to the file; the last entry for a given reference and hash wins. A rejection is exactly as durable as an approval and cannot be quietly dropped without the diff showing it.

Sign-off fields: `scenarioSlug`, `claimRef`, `claimHash`, `decision` (`approved` or `rejected`), optional `note`, `reviewerName`, `reviewerCredential`, `reviewedAt`, `attestationRef`, optional `validUntil`, and `recordedByUserId`.

### 4.4 Six derived statuses

| Status | Condition |
|---|---|
| `unreviewed` | No sign-off has ever existed for this reference, at any hash |
| `approved` | Latest sign-off *at the current hash* approves, cited source current, not past `validUntil` |
| `rejected` | Latest sign-off at the current hash rejects |
| `stale_content` | Sign-offs exist for this reference, but none at the current hash |
| `stale_source` | Approved at the current hash, but the cited source is now superseded |
| `expired` | Approved at the current hash, but past the reviewer's own time-box |

**Precedence, evaluated in order**, so a claim never reports two things at once: `rejected`, then `stale_content`, then `expired`, then `stale_source`, then `approved`, then `unreviewed`. Rejection outranks everything — a claim a reviewer refused is not rehabilitated by its source staying current. `stale_content` outranks the expiry checks because a changed claim has no meaningful sign-off to expire.

`stale_content` is the status that closes the defect from §1. Because sign-offs are keyed by reference **and** hash, an edited claim stops matching its approval while remaining distinguishable from one never examined. "This was reviewed, then it changed" is a materially different and more alarming statement than "this was never reviewed," and today the system can make neither.

`validUntil` is optional and reviewer-set. The mechanism that will actually fire in practice is `stale_source`, because guidelines are revised on their own schedule.

---

## 5. Gates and surfacing

### 5.1 Today's gate does not move

The ratings route keeps refusing on `clinicallyReviewed`. One indirection changes: it stops reading the boolean directly and reads a `scoreable` field from `scenarioReviewStatus()`. Today that function derives `scoreable` from the boolean; the day the Reviewer engages, its body derives it from claim statuses instead. The call site never changes and no migration is involved.

### 5.2 The granular layer can only tighten, never loosen

Two conditions block immediately, and neither needs the Reviewer to exist:

- A claim citing a **withdrawn** source fails at scenario load, so it never reaches the gate.
- A **rejected** claim makes a scenario unscoreable regardless of the boolean. A rejection can only exist because someone reviewed something and said no; letting a blanket `true` override a specific `no` would be indefensible.

Today's effective rule becomes "the boolean is true **and** no claim is rejected" — strictly stronger than today, at no cost, with no possibility of accidentally letting something through.

### 5.3 Nothing changes in the UI

No manager-desk widget, no AAR badge, no dashboard. Visibility today is a provenance report script in the house style of `check-i18n-parity.ts` and `check-boundaries.ts`, printing per-scenario counts by kind — "22 claims: 4 cited, 2 floor observation, 16 internal" — run in CI for visibility but **not** as a gate. Gating on zero internal claims would block the workflow this design exists to keep unblocked; the schema union already does the real enforcement by making silence impossible.

---

## 6. Testing

Weighted toward where this design can silently rot.

- **Golden hash test.** Pin the exact hash of a known claim from a shipped scenario. This is the equivalent of the engine's determinism test: if anyone changes the canonicalization, the denylist, or the field set, it fires immediately rather than quietly invalidating every sign-off in the registry.
- **Denylist proof.** An object carrying an unexpected extra key must hash differently from the same object without it — the concrete assertion that new schema fields are load-bearing by default.
- **Hash boundary tests.** Changing `labelHe` must not move the hash; changing `label`, `weight`, `rule`, or `role` must.
- **Claim inventory golden test.** Exactly 22 and 14 claims extracted from the two shipped scenarios, broken down by type.
- **Engine isolation test.** `compileScenario` output and `EngineState` must contain no provenance field, and `replay()` must produce identical state before and after provenance is added to a scenario file. This is what guarantees a citation change can never alter a simulation.
- **Validation tests.** Source cannot be omitted (set-equality against extracted refs); an orphaned `claimSources` key fails; a short rationale fails; an unresolvable `sourceId` fails; a withdrawn source fails at load; and the §2.5 arithmetic checks.
- **Status derivation** across all six states, with `stale_content` given its own test proving an edited claim is distinguishable from one never reviewed.
- **Gate tests.** A rejected claim blocks even when the boolean is `true`; the boolean still blocks on its own; `allowUnreviewedScores()` still works outside production.
- **Last-entry-wins resolution.** Two entries for the same reference and hash resolve to the later one, so an appended reversal supersedes an earlier decision without the earlier one being deleted.
- **Registry loading.** A malformed sources or reviews file fails boot loudly, matching how `loadScenarioFiles` already treats an invalid scenario.

---

## 7. Rollout

Three commits, no behaviour change:

1. Create the source registry with the handful of sources actually cited.
2. Declare provenance for all 36 claims across both scenarios. Most will be `internal` with a rationale — both scenarios are unreviewed internal-testing content — and a few can cite RECOVER properly. Roughly an hour of honest work.
3. Create an empty review registry.

**No grandfather clause.** Exempting the existing 36 is precisely the move that turns this into a graveyard of empty fields, and 36 is small enough that the argument for exempting them is weak.

Nothing becomes more or less scoreable. The debt count goes from unknown to printed.

---

## 8. Dependencies

Both dependencies are on the evidence-integrity work, which is sequenced first, so both will exist.

**The canonical JSON encoder** (`server/canonical-json.ts`, that spec's Task 2). Reuse it rather than growing a second canonicalizer — two encoders that must agree is the failure mode that spec spends its entire length avoiding.

**`allowUnreviewedScores()`** (that spec's Task 1), which replaces the inline `process.env.VETCREW_ALLOW_UNREVIEWED_SCORES` read in the ratings route and refuses the escape hatch in production. §5 assumes the gate reads that helper rather than the environment directly.

No database migration is needed — see the correction in §4.3. Both registries are in-memory, loaded at boot from committed files.

---

## 9. Acceptance criteria

1. Every claim in every scenario has a declared provenance kind; a missing or orphaned entry fails validation.
2. A scenario citing a withdrawn source refuses to load.
3. Changing `labelHe` does not move a claim hash; changing `label`, `weight`, `rule`, or `role` does.
4. A claim edited after sign-off reports `stale_content`, distinguishable from `unreviewed`.
5. A superseded source moves every dependent claim to `stale_source` with no file edit.
6. A rejected claim makes a scenario unscoreable even with `clinicallyReviewed: true`.
7. `replay()` output and `EngineState` are unchanged by the presence of provenance data.
8. An appended reversal supersedes an earlier decision for the same reference and hash, without the earlier entry being removed.
9. The provenance report prints per-scenario counts by kind.
10. `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm i18n:check`, `pnpm guard:deps`, and `pnpm guard:dead` all pass.

---

## 10. Follow-ups this design deliberately creates

| Follow-up | When | Why deferred |
|---|---|---|
| Evidence packet citing per-claim provenance for each scored item | Phase 2 | The packet format does not exist yet; this is the real payoff |
| Flip the gate to claim-level in `scenarioReviewStatus()` | When the Reviewer engages | §5.1 makes it a small diff |
| A review UI and API | When a second reviewer exists | File-first will not survive contact with a scenario library in the dozens; a deliberate ceiling, not an oversight |
| AAR display of claim status beside checklist verdicts | With the evidence packet | UI work with no consumer yet |
