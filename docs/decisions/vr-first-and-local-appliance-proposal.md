# Proposal: VR-first trainee client + local offline appliance

**Status:** proposal for founder decision — **not** an accepted ADR
**Date:** 2026-08-04
**Author:** agent review, grounded in the repository at `9e3799e`
**Affects:** [`ADR-001`](ADR-001-simulator-architecture.md), root `CLAUDE.md` §3/§4/§7, [`doctrines/event-taxonomy.md`](../doctrines/event-taxonomy.md)

This document answers a single question in two halves that arrived bundled together and
should not stay bundled: *should VetCrew pivot to a VR-first trainee client, and should it
move from Clerk/Railway to a local offline appliance?* The short answer is **no to the first
and yes to the second**, and the most valuable thing in this memo is the argument for why
those two proposals have nothing to do with each other.

Everything below is grounded either in the code at `9e3799e` (file paths given) or in
external sources (§16 lists them with confidence levels). Where I could not verify a claim,
it is marked **UNVERIFIED** rather than smoothed over.

---

## 1. Executive recommendation

**Conditional go on the local appliance. No-go on VR-first. Conditional go on VR-optional,
gated behind a cheap on-headset test that has not yet been run.**

Three separate verdicts, because the bundle contains three separable proposals:

| Proposal | Verdict | Reason in one line |
|---|---|---|
| **Replace Clerk with local auth; ship VetCrew as an offline appliance** | **GO** | ADR-001 already deferred this as an open deployment question, the Clerk surface is ~9 non-test files, and it removes a hard internet dependency from a hospital floor. |
| **Add a WebXR trainee client alongside the 2D station** | **CONDITIONAL GO** | ADR-001 already sanctions this path; the desktop spike passed; the gate is one on-headset session that costs almost nothing and has still not happened. |
| **Make VR the *primary* trainee client (VR-first)** | **NO-GO** | It fails the product's own #1 risk test (friction), the transfer evidence does not support it, and the platform substrate (Meta HMS) is being retired under it. |

The distinction between the second and third rows is the whole memo. "Build a VR client" and
"make VR the way trainees train" are different commitments by roughly an order of magnitude,
and the proposal as received conflates them.

### What is actually true about this codebase

The pivot's implicit worry — that a VR move would be a rewrite — is wrong, and the code says
so. The durable assets are renderer-agnostic by construction:

- `packages/engine/src/reducer.ts` — `reduce(state, event)` and `replay(seed, events, scenario)`.
  Pure. No `Date.now`, no `Math.random`, no I/O. Time enters only as `tick` events;
  randomness only through the seeded mulberry32 in `packages/engine/src/prng.ts`.
- `vc_session_events` — append-only, with `(session_id, seq)` unique and a Postgres trigger
  (`server/db/migrations/0004_seq_authority.sql`) that rejects any insert whose `seq` is not
  exactly `max(seq) + 1`.
- `server/evidence-attest.ts` — SHA-256 over the canonical preimage
  `seq|type|role|actorId|payload`, frozen onto each ANTS rating as
  `log_head_seq`/`log_head_hash`.
- `packages/shared/src/live-contracts.ts` — the wire contract. Clients send intents that
  **carry no `seq`**; the server is the sole sequencing authority (`parseClientIntent`
  actively rejects a smuggled `seq`).

A VR client is a **fourth subscriber** to `LIVE_EVENTS.snapshot` that renders `RoleViewWire`
and emits `ClientIntent`. It reduces nothing locally. Nothing in the engine, log, attestation,
or scenario model changes to accommodate it. That is not a happy accident — it is exactly the
seam ADR-001 said to preserve, and it held.

What does *not* survive a VR pivot: the four React pages (`src/pages/StationPage.tsx`,
`InstructorConsolePage.tsx`, `ManagerEvidencePage.tsx`, `AarPage.tsx`), the DOM task surface,
and the Hebrew RTL layout work. The canvas monitor (`src/monitor/renderer.ts`) survives
verbatim — the WebXR spike proved that by driving both a DOM client and a `CanvasTexture` in
a 3D scene with zero monitor-code changes.

---

## 2. Does the VR pivot genuinely reopen ADR-001?

**No. Not one of the four recorded revisit triggers has fired.** ADR-001 lines 138–142 list
them; taking each in turn:

| Trigger | Fired? | Why |
|---|---|---|
| "A pedagogical requirement emerges that genuinely cannot be assessed in 2D (i.e. motor skill, not knowledge)" | **No** | The proposal's stated hypothesis is *behavioural transfer* — that 2D training may not change floor behaviour. That is a claim about training effectiveness, not about a competency that 2D cannot represent. ADR-001 anticipated exactly this substitution and wrote "motor skill, not knowledge" to block it. |
| "The pilot validates that crews *can* be co-located reliably (resolving §6.4) **and** asks for spatial team training" | **No** | §6.4 is still open. The pilot has not been run. Nobody has asked for spatial team training. |
| "A buyer makes VR a purchase condition" | **No** | There is no buyer. The single Reviewer (CLAUDE.md §6) has not been shown the product, and the pitch track is shelved by founder decision. |
| "WebXR is trialled on Quest 3 and proves insufficient for the required fidelity" | **No** | The opposite, partially: the spike **passed on desktop** (`spikes/webxr/README.md`). The on-headset half has not been run, so the trigger cannot have fired — an untried test is not a failed one. |

**Building a WebXR client does not require reopening ADR-001 at all.** That is what the
decision explicitly kept open: "Keep the door to VR open via WebXR, not via Unity" (line 68),
and "If VR is later exercised, add a WebXR/react-three-fiber client against the same event
log" (line 70). Adding that client is *executing* ADR-001, not overturning it.

Two things in the bundled proposal genuinely do touch ADR-001, and they should be handled
separately:

1. **Adopting Unity or Unreal** would overturn it. ADR-001 evaluated and rejected Option B.
   Reopening requires new evidence, and §12 below argues the new evidence points the other way.
2. **Making VR the primary client** is a claim ADR-001 never evaluated, because nobody
   proposed it. It deserves its own hearing, and §3 gives it one — and rejects it.

**The local appliance does not reopen ADR-001 either — it *closes an item ADR-001 left open*.**
The final action item (line 153) reads: "Defer to a future ADR: on-prem LAN vs. Railway
deployment for the pilot (a deployment choice under Option A, not an architecture choice)."
The appliance proposal is the answer to that deferred question. It is in-scope, sanctioned,
and overdue.

---

## 3. Why VR-first fails, specifically

Four independent objections. Any one would be enough to hold; together they are decisive.

**3.1 — It maximises the risk the project has already measured as fatal.**
CLAUDE.md §2.4 rests on research finding [A4]: a *resident-requested* competency curriculum
produced **zero completed assessments in three months** because clinical service demand
outranks structured training. The conclusion drawn — correctly — was that the first rung must
be near-zero-friction or leadership-mandated. VR adds headset hygiene between trainees,
physical clear space on a working hospital floor, device charging and provisioning, MDM
enrollment, and a person who knows how to fix it when it does not launch. A trainee station
that is a URL survives an interrupted shift; a headset does not. Making VR primary means
betting the adoption path on the highest-friction option available, against the one risk the
project has hard evidence about.

**3.2 — The transfer evidence does not support the hypothesis.**
The proposal's premise is that 2D produces insufficient behavioural transfer. A meta-analysis
of 27 RCTs comparing VR to conventional simulation in health-professions education found **no
statistically significant difference** in knowledge, procedural skill, clinical reasoning, or
communication outcomes (§16, source E1). VR's plausible edge is narrower and different:
stress inoculation and attention-under-load — performing while interrupted, alarmed at, and
crowded. That is a real and interesting hypothesis, and it maps onto the summit (crew mode),
not the base rung. It is also, as far as I could find, **not well studied in clinical VR** —
so it is a hypothesis to test cheaply, not a foundation to rebuild on.

**3.3 — The platform substrate is being retired underneath the proposal.**
Meta's Horizon Managed Services (HMS) **stopped accepting new customers on 20 February 2026**,
with full program retirement announced for **January 2030** (§16, source D1). Third-party
device-management vendors (ArborXR, ManageXR) enroll devices *through* HMS. A hospital
standing up managed Quest devices today is provisioning onto a platform with an announced end
date and a closed front door.

> **UNVERIFIED and load-bearing:** whether a brand-new organisation with no prior HMS history
> can enroll *at all* after 20 February 2026. Meta's language describes continuity for
> *existing* customers; it does not clearly state what a new customer can do. If new orgs
> cannot enroll, managed Quest deployment for a new pilot site is not merely risky — it is
> closed. **This must be resolved by asking Meta directly before any hardware is purchased.**

**3.4 — Quest's own offline story contradicts the appliance goal.**
Shared Mode (the multi-user mode intended for shared/loaner devices, which is what a hospital
training headset is) **wipes persistent app data on session restart** (§16, source D2). That
kills PWA offline caching as a strategy: the cached WebXR client does not survive to the next
trainee. Combined with WebXR's secure-context requirement (§6), the offline-first VR client on
a shared hospital headset is materially harder than the offline-first *2D* client, which is
just a browser pointed at a machine on the same LAN.

**What VR-first would have to prove to be reconsidered.** Not "VR is engaging." Specifically:
a competency in the CVTEA skills list that 2D demonstrably cannot assess, *or* a measured
behavioural-transfer gap between trainees trained on the 2D station and floor performance.
Both are downstream of a pilot that has not run.

---

## 4. What *is* strong in the proposal: the local appliance

Stripped of VR, the appliance idea is good and independently justified.

**The problem it solves is real.** Today the server refuses to boot in production without
`CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and `DATABASE_URL` (`server/env.ts` lines 24–31).
That means a live training session on a hospital floor depends on Clerk's availability and on
the site's internet. For a product whose whole thesis is "evidence captured under time
pressure on a working floor," an identity SaaS in the hot path of *starting a session* is a
liability, not a convenience. Hospital IT departments also tend to have opinions about
trainee PII leaving the building, and Clerk means it does.

**The cost of removing it is bounded and small.** Clerk appears in nine non-test source files:

| File | What it does |
|---|---|
| `server/auth.ts` | `verifyToken` (JWT), `getAuth` (middleware), role from `vetcrewRole` claim |
| `server/index.ts` | mounts `clerkMiddleware`, wires `clerkEnabled` |
| `server/env.ts` | requires the two keys in production |
| `server/live/socket.ts` | passes the secret key into `createReadAuthFromToken` |
| `server/routes/manager.ts` | `requireRole("manager", …)` plumbing |
| `src/main.tsx`, `src/App.tsx` | `ClerkProvider`, `hasClerkPublishableKey` branch |
| `src/components/AuthBar.tsx` | sign-in/out UI |
| `src/hooks/useBearerToken.ts` | `getToken()` → bearer |

Plus `.env.example`, `knip.json`, `server/types/globals.d.ts`, i18n strings, and four test files.

**The seam already exists and is already exercised in CI.** `server/auth.ts` has a working
second identity path: `parseTestBearer` accepts `Bearer test:<userId>:<role>` when
`VETCREW_TEST_AUTH=1`, producing the same `AuthSnapshot` shape Clerk produces. Every consumer
downstream — `requireSignedIn`, `requireRole`, the socket join binding — sees only
`AuthSnapshot`. **Local auth is a third implementation of an interface that already has two.**
That is the single most important engineering fact in this section: the abstraction is not
hypothetical, it is load-bearing in CI today.

### Proposed local identity model

Deliberately boring. Identity here is *attribution for an evidence record*, not a security
perimeter against a determined attacker — the perimeter is physical possession of the
appliance.

- **Instructor/manager accounts:** local rows, Argon2id password hashes, in a new
  `vc_local_users` table. Created by an appliance-owner bootstrap command, not self-serve.
- **Sessions:** short-lived signed tokens (Ed25519 or HS256) issued by the appliance,
  keyed by a per-appliance secret generated at first boot. Same `Bearer` header, so
  `readAuthFromToken` gains a branch and nothing downstream changes.
- **Trainee join:** trainees should not have passwords. Keep the existing floor deep-link
  pattern ([#17](https://github.com/exposwifty31/VetCrew/pull/17)) — the instructor
  provisions a station and hands over a one-time join code bound to a `role_stations` row.
  The trainee's identity for attribution comes from the binding the instructor made, which is
  what already happens: `sessionJoinSchema` stamps attribution from the socket binding and
  ignores a client-supplied `actorId` when auth is on.
- **Role claim:** replaces the `vetcrewRole` JWT claim with a column. Same three values.

**What this costs in honesty:** a local password store is worse operationally than Clerk —
no MFA, no breach monitoring, no session-revocation UI, and password reset becomes the
founder's problem. That is an acceptable trade *for an appliance in a locked room used by
three people*, and an unacceptable one for a multi-tenant SaaS. Write that boundary into the
ADR so nobody later ships the local path to a second hospital by accident.

### Appliance shape

- One small x86 box (NUC-class) or the existing Docker image on a hospital-provided VM.
- Full-disk encryption (LUKS). The event log contains trainee performance data; a stolen
  appliance must not be readable.
- Postgres local, on the same box. Nothing about the current schema changes.
- The existing `Dockerfile` already produces exactly the right artefact: a single stateful
  service serving SPA + API + sim engine on one port. It needs no VR-related change and only
  minor env changes.
- **Backup is the new obligation.** Railway made durability someone else's job; the appliance
  makes it the founder's. An append-only evidence log with no offsite copy is one spilled
  coffee away from destroying the entire evidence corpus — which is the product. Minimum:
  scheduled `pg_dump` to an encrypted USB target, plus a documented restore test. This is not
  optional garnish; it is the precondition for the appliance being *safer* than the cloud
  rather than merely more private.

---

## 5. Architecture (text diagram)

Recommended end state. `[existing]` ships today; `[new]` is appliance work; `[optional]` is
the gated WebXR client.

```
                 ┌───────────────────── APPLIANCE (LUKS-encrypted, no WAN required) ─────────────────────┐
                 │                                                                                       │
 Instructor      │   ┌──────────────────────────────────────────────────────────────────────────┐        │
 laptop  ────────┼──▶│  Node + Express + Socket.IO          [existing: server/index.ts]         │        │
 (browser)       │   │                                                                          │        │
                 │   │   auth: AuthSnapshot                 [existing seam: server/auth.ts]     │        │
 Trainee         │   │     ├── Clerk JWT                    [existing → removed in prod]        │        │
 station  ───────┼──▶│     ├── test bearer (CI)             [existing]                          │        │
 (browser)       │   │     └── local token                  [NEW]                               │        │
                 │   │                                                                          │        │
 Quest 3         │   │   SessionRoom (1 per live session)   [existing: live/session-room.ts]    │        │
 WebXR    ┄┄┄┄┄┄┄┼┄┄▶│     ├── tick loop, 1000 ms — OUTSIDE the reducer                         │        │
 [optional]      │   │     ├── replay(seed, events) on hydrate                                  │        │
                 │   │     └── broadcast RoleView / InstructorView                              │        │
                 │   └───────────────┬──────────────────────────────────┬───────────────────────┘        │
                 │                   │ append (sole seq authority)      │ project                        │
                 │                   ▼                                  ▼                                │
                 │   ┌───────────────────────────┐      ┌──────────────────────────────────┐             │
                 │   │ PURE REDUCER  [existing]  │      │  RoleViewWire / InstructorViewWire│            │
                 │   │ (state, event) => state   │      │  [existing: live-contracts.ts]    │            │
                 │   │ no Date.now / Math.random │      └──────────────────────────────────┘             │
                 │   │ seeded mulberry32 PRNG    │                                                       │
                 │   └───────────────────────────┘                                                       │
                 │                   │                                                                   │
                 │                   ▼                                                                   │
                 │   ┌──────────────────────────────────────────────────────────────────────┐            │
                 │   │ Postgres, local          [existing schema, unchanged]                │            │
                 │   │   vc_session_events  — append-only, seq trigger, 6 event types       │            │
                 │   │   vc_sim_sessions    — seed, phase FSM, time-in-training             │            │
                 │   │   vc_ants_ratings    — evidence seqs + log_head_seq/log_head_hash    │            │
                 │   │   vc_local_users     [NEW]                                           │            │
                 │   └──────────────────────────────────────────────────────────────────────┘            │
                 │                   │                                                                   │
                 │                   ▼                                                                   │
                 │   ┌──────────────────────────────────────────────────────────────────────┐            │
                 │   │ pg_dump → encrypted USB  [NEW — durability is now ours]              │            │
                 │   └──────────────────────────────────────────────────────────────────────┘            │
                 └───────────────────────────────────────────────────────────────────────────────────────┘

 Clients are thin. All four (2D station, instructor console, manager desk, WebXR) render
 pushed projections and emit ClientIntent with NO seq. None of them reduces engine state.
```

The property worth naming: **the box the VR client would occupy is already drawn, already
specified, and already has two occupants.** Adding a third does not deform anything else.

---

## 6. VR hardware connectivity (if the optional client is built)

WebXR requires a **secure context** — HTTPS, or `localhost`. A bare LAN IP is not one. This
is the single practical obstacle, and there are three ways past it, in descending order of
sanity:

1. **`adb reverse tcp:3001 tcp:3001` (development).** Maps the appliance port onto the
   headset's own `localhost`, which *is* a secure context. Zero certificates. This is how the
   spike should be verified. Requires a USB cable and developer mode — fine for a spike,
   unusable as a deployment model.
2. **Self-signed certificate trusted on the headset (deployment).** The appliance generates a
   cert for a stable local hostname; the cert is installed on each headset once. Meta's own
   local-development guidance points here. Adds a provisioning step per device and a renewal
   obligation. Workable, unglamorous.
3. **A real certificate for a real domain resolving to a LAN address.** Requires DNS control
   and internet for issuance/renewal, which contradicts the offline goal. Rejected.

Transport is unchanged: Socket.IO over the same LAN, same `LIVE_EVENTS`, same reconnect and
`lastSeq` resume path the 2D client already uses. Note that this connectivity story is
*strictly harder* than the 2D one, and combined with Shared Mode's data wipe (§3.4) it means
the VR client is the **less** offline-capable client, not the more. That inverts the
proposal's implicit assumption.

---

## 7. Instructor Operator Station

No change of direction needed here — the shipped instructor console is already the right
shape, and the appliance makes it more so, since the instructor's laptop is now the only
machine that must be reliable.

What the appliance adds:

- **Appliance status surface:** disk, last backup, connected stations, current session. The
  instructor is now also the operator; give them the operator's information.
- **Station provisioning:** create a `role_stations` row, produce a join code or QR, show
  which stations are bound and connected. `sessionPresenceSchema` already carries the
  presence data this needs.
- **Local account management:** create/disable instructor and manager accounts. Small, ugly,
  necessary — it is the replacement for the Clerk dashboard.

Everything else — pause/resume/inject/end, the injection menu, ANTS rating with evidence
citation — stays exactly as shipped. Hebrew-first RTL applies, with the monitor-face exemption
(CLAUDE.md §4) unchanged.

---

## 8. VR trainee client (the gated, optional one)

Scope it as a **capability probe, not a product**: one scenario, one role, seated, no
locomotion.

- **Stack:** react-three-fiber + `@react-three/xr`, in this repo, sharing
  `src/monitor/renderer.ts` and the `useSession` hook pattern from `src/live/useSession.ts`.
- **Scene:** table, patient (the spike's capsule is honestly sufficient to answer the
  question), the canvas monitor on a plane, a diegetic task surface.
- **Interaction:** controller ray → the same `ClientIntent` union. `task_submit` from a VR
  panel and `task_submit` from the DOM produce byte-identical event bodies. If they do not,
  the VR client has been built wrong.
- **Comfort:** seated, no artificial locomotion, no forced camera motion. This is the
  configuration with the least sickness risk, and it happens to match the clinical posture.
- **Sessions kept short** and paced by the instructor. **UNVERIFIED:** I could not find
  official Meta guidance on maximum comfortable session length; treat any specific number as
  unsourced until confirmed.

**Telemetry — and the taxonomy trap it sets.** VR makes gaze, head pose, and hand pose
available at 60–90 Hz. That is roughly 10⁴ samples per minute per stream, and almost all of it
is noise. Two rules:

1. **Nothing continuous enters `vc_session_events`.** The log is the evidence record and it
   replays forever; flooding it with pose samples degrades every future replay and every
   attestation hash computation for no evidentiary gain.
2. **Discrete, meaningful captures only** — and only as `action` events with new action ids
   registered in the taxonomy. "Trainee looked at the monitor at T+47s" is a fact and can be
   an `action`. "Trainee had poor situational awareness" is a verdict and is forbidden by
   taxonomy rule 3.

If continuous pose is ever wanted for research, it belongs in a **separate side-channel
table** keyed by `(session_id, seq)`, explicitly outside the attested log. Do not let VR
telemetry into the evidence spine.

---

## 9. Scenario and injectable authoring — unchanged

Nothing in the VR or appliance proposals requires a scenario-model change, which is itself a
useful finding. `packages/shared/src/authored-scenario.ts` holds the authored schema with
`clinicallyReviewed`/`clinicalReviewer`; `packages/engine/src/scenario.ts` holds the engine
form with parametric vital curves, triggers, tasks, and the injection menu. Injections remain
an instructor-triggered menu, not a branching tree (CLAUDE.md §4).

A VR client would want *presentation* metadata a scenario does not currently carry —
where the patient lies, where equipment sits. That belongs in a **separate optional
`presentation` block**, ignored by the engine and by the 2D client. It must not touch the
fields that feed scoring, because a scenario version is recorded on every score and changing
its meaning breaks comparability.

One thing worth restating because it constrains any VR demo: the two shipped scenarios are
capability-disjoint (CLAUDE.md, and `scenario-srs-divergence-memo.md`).
`base-rung-stepped-tasks` has 7 tasks and 0 injections; `base-rung-resp-distress` has 2
injections and 0 tasks. A VR spike on the task scenario will show an empty injection panel on
the instructor side. Plan around it rather than discovering it live.

---

## 10. Event taxonomy — additive only, and probably empty

The closed set stays: `tick`, `action`, `injection`, `phase_change`, `task_start`,
`task_submit`. A WebXR client emitting the same `ClientIntent` union needs **zero new event
types** — which is the cleanest possible evidence that the client really is disposable.

If VR-specific captures are later wanted, they enter as `action` events with new action ids,
following the same-commit rule in `doctrines/event-taxonomy.md` (engine events, shared
schemas, reducer, the doctrine table, and `clientIntentSchema` all in one commit). The parity
test at `packages/shared/test/event-taxonomy.test.ts` enforces the engine half automatically.

The local-auth change touches the log in exactly one way and it is worth being precise about:
`actorId` currently holds a Clerk user id and would hold a local user id instead. **Existing
rows must not be rewritten** — the log is append-only and rewriting `actorId` would invalidate
every `log_head_hash` already computed over the preimage `seq|type|role|actorId|payload`. If
the pilot's existing sessions matter, keep a mapping table; if they do not, start the
appliance with a fresh log and say so explicitly.

---

## 11. AAR and replay — unchanged, and that is the point

The AAR is built by replaying the log server-side (`GET /api/sessions/:id/aar`,
`server/routes/sessions.ts`). It is client-agnostic already. A session recorded from a VR
station replays into exactly the same AAR as one recorded from the DOM station, because both
produced the same event bodies.

This matters more than it sounds. §2.2's evidence-not-verdict posture depends on a manager
being able to review a record asynchronously — and CLAUDE.md §6 establishes there is exactly
**one** qualified reviewer at the pilot site, so async review is not a nice-to-have, it is the
only path to anything consequential. A VR-only replay would have made that reviewer's job
require a headset. Keeping the AAR 2D keeps review cheap. **If a VR client is built, the AAR
must remain fully reviewable in 2D.** Recommend writing that into the ADR as a constraint.

---

## 12. Unity vs Unreal vs WebXR

**Recommendation: WebXR. Not close.**

| | WebXR (r3f) | Unity | Unreal |
|---|---|---|---|
| Language | TypeScript — same as everything | C# | C++/Blueprint |
| Transfer from existing stack | Total | None | None |
| Licensing risk | None | Seat-based; Industry tier for non-game use | Seat-based for non-game; royalty on public distribution |
| Monitor renderer reuse | **Verbatim** (spike-proven) | Reimplement | Reimplement |
| Deployment to headset | URL | Store/MDM/sideload | Store/MDM/sideload |
| Fidelity ceiling | Lower | High | Highest |

On licensing, with confidence levels attached because the details move:

- **Unity cancelled the Runtime Fee on 12 September 2024**, reverting to seat-based
  subscriptions, and doubled the Personal free threshold to $200,000 (high confidence, §16).
  The removal of the Runtime Fee genuinely de-risks Unity relative to 2023 — but it does not
  make Unity *free* for this use. Non-game/simulation work falls under **Unity Industry**,
  whose revenue/funding threshold is **$1M** rather than the $25M sometimes assumed
  (**medium confidence — verify with Unity before relying on it**). A successful VetCrew
  crosses $1M long before it crosses $25M.
- **Unreal** is free for internal and custom (work-for-hire) projects, with the 5% royalty
  attaching above $1M lifetime gross to products distributed to the general public. Epic also
  introduced a per-seat licence for non-game industries (**medium confidence on the current
  figure and its applicability — verify against the live EULA**). The royalty addendum's
  treatment of specific storefronts has exceptions; do not reason about it from memory.

The licensing picture is *survivable* for both engines. That is not the reason to reject them.
The reason is §1: the renderer is the disposable layer, and paying a new language, a new
toolchain, a new build pipeline, and weaker agent ergonomics — for a solo, agent-driven build
— to replace the layer that is *designed to be thrown away* inverts the architecture. ADR-001
argued this in 2026-07; nothing found since weakens it.

---

## 13. Risk register

| # | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| R1 | VR raises adoption friction; repeats the [A4] zero-uptake outcome | **High** | High if VR-first | Keep 2D primary. VR optional and additive. |
| R2 | New orgs cannot enroll in HMS post-2026-02-20; managed Quest deployment closed | **High** | **Unknown — UNVERIFIED** | Ask Meta directly before buying hardware. Blocks §14-B. |
| R3 | HMS retires January 2030; managed deployment has an end date | High | Certain | Do not build deployment on HMS. Another reason for browser-delivered WebXR. |
| R4 | Shared Mode wipes app data; offline PWA caching on shared headsets fails | Medium | High | Do not rely on offline caching in VR. Appliance serves over LAN each session. |
| R5 | WebXR secure-context on LAN needs per-device cert provisioning | Medium | Certain | `adb reverse` for spikes; trusted self-signed cert for deployment. |
| R6 | Local auth is weaker than Clerk (no MFA, no revocation UI, manual reset) | Medium | Certain | Accept for single-site appliance; write the boundary into the ADR; physical security is the perimeter. |
| R7 | **Appliance data loss destroys the entire evidence corpus** | **High** | Medium | Encrypted `pg_dump` to USB on a schedule + a *tested* restore. Non-negotiable precondition. |
| R8 | Appliance theft exposes trainee performance data | Medium | Low | LUKS full-disk encryption; locked room. |
| R9 | VR telemetry floods the event log and degrades replay/attestation | Medium | High if unguarded | Taxonomy rule: no continuous streams in `vc_session_events`; side-channel table only. |
| R10 | `actorId` migration invalidates existing `log_head_hash` values | Medium | Certain if rows are rewritten | Never rewrite. Mapping table, or fresh log with a recorded decision. |
| R11 | VR sickness in trainees | Low–Medium | Low in seated/no-locomotion config | Seated, no artificial locomotion, short sessions, opt-out always available. |
| R12 | VR work consumes the runway that product work needs | **High** | High | Time-box the spike; the gate in §14 is pass/fail, not "promising". |
| R13 | Competitor (iSimulate/3B) ships multi-role asymmetry first | Medium | Unknown | Unchanged by this decision; watch quarterly per §6.5. |
| R14 | Founder's own stop-condition breached — worktree infra already flagged forward-investment-without-measured-pain | Medium | High | This proposal is the same pattern. Note it explicitly; require a stated trigger before VR work continues past the spike. |

R14 deserves emphasis. CLAUDE.md records, in the founder's own words, a stop condition on
worktree infrastructure: no further investment "unless observed collision pain at ≥3
concurrent agents is recorded with a concrete example." VR-first is the same shape of
proposal — a forward investment against an unmeasured problem, arriving while the pitch track
is shelved and the stated next unit of work is product work. Consistency argues for applying
the same discipline.

---

## 14. Spike plan (sequenced and gated)

Deliberately expressed as gates rather than calendar weeks; the useful constraint is
"stop at the gate", not "stop on Friday". Two spikes, independent, runnable in either order.

### Spike A — Local auth (recommended: do this one regardless)

1. Add `vc_local_users` (id, tenant_id, email, argon2 hash, role, created_at, disabled_at).
2. Add a third branch to `readAuthFromToken`: local signed token → `AuthSnapshot`. No
   downstream consumer changes.
3. Bootstrap CLI: create the first instructor account.
4. Login UI replacing `AuthBar.tsx`; `useBearerToken.ts` returns the local token.
5. Relax `server/env.ts` so production boots with local auth and no Clerk keys.
6. Run the existing e2e suite against local auth with `VETCREW_TEST_AUTH=0`.

**Gate:** the full station → instructor → AAR → manager path passes e2e with no Clerk keys
present and no network egress. Pass ⇒ write the ADR and ship. Fail ⇒ the abstraction was
thinner than it looks, and the finding is worth more than the spike cost.

### Spike B — WebXR on-headset (the ADR-001 outstanding item)

1. `adb reverse` the appliance port onto a Quest 3.
2. Load `spikes/webxr/` on-headset. Measure frame pacing; read the monitor at working
   distance.
3. Confirm the Layer A / Layer B colour separation survives the headset's display and
   passthrough — channel hue must still read as identity, severity must still read from the
   frame/LED/flash, not from hue shift.
4. Wire one `task_submit` from a VR panel to the live server; verify the event body is
   byte-identical to the DOM client's.
5. Record the result in `spikes/webxr/README.md` and close ADR-001's outstanding item either way.

**Gate:** monitor legible at working distance, frame pacing acceptable, event body identical.
Pass ⇒ ADR-001's condition is fully discharged and VR-optional is genuinely available when a
trigger fires. Fail ⇒ ADR-001 trigger 4 has fired and the ADR *does* reopen — this is the
one path by which the VR question legitimately returns.

**Explicitly not in either spike:** asset pipelines, avatars, spatial audio, hand tracking,
multi-user VR, MDM enrollment, hardware purchase. Every one of those is downstream of a
trigger that has not fired.

---

## 15. The first three founder decisions

Everything else waits on these.

**Decision 1 — Is VR primary or optional?**
This memo recommends **optional**, and recommends recording it in an ADR so it does not
recur. If the answer is "primary," then §3's four objections need answering point by point,
and R2 (whether a new org can even enroll a managed headset) has to be resolved first,
because it may make the question moot.

**Decision 2 — Does the pilot site run offline?**
If yes, Spike A becomes the immediate next unit of work and the appliance ADR gets written.
If the site has reliable internet and no data-residency objection, Clerk is doing real work
and removing it is optional cleanup rather than a requirement. **This is a question to ask the
hospital, not to answer from the desk** — and it pairs naturally with the §6 question the
manager has still not been asked.

**Decision 3 — What breaks the tie between VR work and product work?**
The pitch track is shelved and CLAUDE.md says the next unit of work is product work. A VR
spike is small; a VR *program* is not. Name the trigger now — a stated pedagogical
requirement, a buyer condition, or a measured transfer gap — so that "the spike went well"
cannot silently become "we are now a VR company."

---

## 16. Sources, confidence, and gaps

**Verified, high confidence:**

- **E1** — Meta-analysis of 27 RCTs, VR vs. conventional simulation in health-professions
  education: no statistically significant difference in knowledge, procedural skill, clinical
  reasoning, or communication outcomes.
- **U1** — Unity cancelled the Runtime Fee on 12 September 2024, effective immediately;
  reverted to seat-based subscription; Unity Personal free threshold doubled to $200,000;
  Pro/Enterprise price increases effective 1 January 2025.
- **D1** — Meta Horizon Managed Services stopped accepting new customers on 20 February 2026;
  program retirement announced for January 2030.
- **D2** — Quest Shared Mode does not persist app data across session restarts.
- **W1** — WebXR requires a secure context; `localhost` qualifies, a bare LAN IP does not.
  `adb reverse` and trusted self-signed certificates are the two documented local paths.

**Medium confidence — verify before relying:**

- **U2** — Unity Industry tier applies to non-game/simulation use at a **$1M** revenue-or-funding
  threshold (not $25M). Verify with Unity licensing directly before any decision turns on it.
- **X1** — Epic's per-seat licence for non-game industries (introduced around UE 5.4) and its
  current price. Verify against the live EULA; the royalty addendum also carries
  storefront-specific exceptions that should not be reasoned about from memory.

**Unresolved gaps — these are the ones that could change a conclusion:**

- **G1 (blocking for any managed-VR path)** — Can a brand-new organisation with no prior HMS
  history enroll after 20 February 2026? Meta's published language addresses continuity for
  *existing* customers and does not clearly answer this. **Ask Meta directly.**
- **G2** — No official Meta guidance found on maximum comfortable VR session length. Any
  specific number in a plan should be treated as unsourced.
- **G3** — VR for stress inoculation and attention-under-load in *clinical* settings appears
  under-studied. This is the most interesting VR hypothesis for VetCrew's summit and the one
  with the least evidence either way.

---

## 17. What this proposal asks for

1. **Accept** the local appliance direction; write it up as ADR-002, closing ADR-001's
   deferred deployment question.
2. **Reject** VR-first; record that none of ADR-001's four triggers has fired, so the ADR
   stands.
3. **Run Spike B** to discharge ADR-001's outstanding on-headset condition — cheap, and it
   either closes the question or legitimately reopens it.
4. **Run Spike A** if Decision 2 says the site runs offline.
5. **Resolve G1** before any headset is purchased.
