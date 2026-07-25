---
name: vetcrew-cto-strategy
description: >-
  End-to-end VetCrew strategy review — wedge, moat, evidence maturity, go/no-go
  for ICU-floor deploy. User-invoked only.
disable-model-invocation: true
---

# VetCrew CTO Strategy Review

Strategic catalysis over the live codebase: is the baseline mature enough for a fast-paced veterinary ICU floor, and what single **wedge** + single **moat** move the product hardest?

Product truths, stack, and frozen v1 decisions live in [`CLAUDE.md`](../../../CLAUDE.md) — load that before step 1; do not restate it.

## Steps

### 1. Map the domain

Locate the files that touch:

- the core simulation **reducer**
- Socket.IO room / session state
- UI/UX paths that affect render latency or operational resilience on **desktop/web** (clean, minimalist, high-stress ICU surface — not mobile/iPad)

**Done when:** every path above is named with a concrete file path (or an explicit "missing" for a gap).

### 2. Synthesize against the floor

Read the mapped code against RECOVER-class ER protocol pressure, competitor friction (clunky setup, UI clutter, long time-to-first-action), and the stack already in play (Vite, Socket.IO, Web Audio where relevant). Ask: would a stressed tech clear the first screen in under ten seconds?

**Done when:** you can state, in one sentence each, (a) the strongest structural integrity claim the code earns and (b) the weakest link under live ICU load.

### 3. Draft one wedge and one moat

- **Wedge** — zero-friction frontend entry for floor staff. Exactly one proposal. Spec must be buildable from the current React/Vite client + Socket.IO payloads.
- **Moat** — backend defense rooted in the deterministic reducer + append-only Postgres event log (Drizzle). Exactly one proposal. Prefer hardening event sourcing, ANTS time-travel playback, or state recovery over greenfield inventiveness.

**Done when:** each proposal has a TypeScript implementation sketch tied to real modules from step 1 — not abstract architecture prose.

### 4. Emit the review

Write the full response using the structure in [`output-template.md`](output-template.md). Fill every section; invent nothing the codebase cannot support — mark absences as absences.

**Done when:** the output matches the template section-for-section, every code block is concrete TypeScript, and the **go/no-go** names one core risk plus three file-specific next actions.

## Hard rails (in-skill reference)

| Rail | Meaning |
|---|---|
| Evidence, not verdict | Capture tamper-proof, role-attributed proof. Managers hire from evidence; the system does not auto-judge readiness. |
| ICU surface | Desktop/web, minimalist, functional. Cognitive load on the floor is the enemy of the wedge. |
| One each | Exactly one wedge, exactly one moat. Depth over a menu of options. |
| Code or it didn't happen | Specs name files, types, payloads, schemas. Hand-waving fails the step. |
