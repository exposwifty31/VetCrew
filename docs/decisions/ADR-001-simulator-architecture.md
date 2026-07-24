# ADR-001: Simulator client architecture — web stack vs. Unity/VR-native

**Status:** **Accepted** (2026-07-24, Dan) — spike condition **met** (desktop); on-headset check outstanding
**Date:** 2026-07-24
**Deciders:** Dan (sole)

> **Decision recorded:** Option A adopted — web stack, VR kept open via WebXR rather than Unity.
> **Condition:** run a short WebXR spike (monitor + simple patient, rendered on a Quest 3 in-browser)
> to verify the VR door is genuinely open before it is relied on as the answer. If the spike fails,
> reopen this ADR — do not silently drift toward Unity.
>
> **✅ SPIKE RESULT — PASS (desktop-verified, 2026-07-24).** Built at `spikes/webxr/`. A single
> framework-agnostic `MonitorRenderer` (plain canvas, imports nothing) simultaneously drives a 2D DOM
> client and two diegetic 3D screens via `CanvasTexture` — **zero monitor-code changes between them.**
> Sweep rendering, correct uMEC12 channel colours, and — critically — **Layer A/Layer B separation
> survives contact with a real renderer**: under a triggered crash HR reads 208 and SpO₂ reads 79
> while both keep their channel hue, severity carried only by the LED strip, full-screen frame, and
> value flash. Production build clean; no console errors.
> **Outstanding:** on-headset verification (frame pacing + legibility) needs Dan's Quest 3;
> `immersive-vr` correctly reports unsupported on desktop. See `spikes/webxr/README.md`.
> This confirms the renderer-is-disposable thesis. **Unity remains deferred.**
>
> **CLAUDE.md updated 2026-07-24** — §3 records this ADR, §7 marks 3D/VR a decided question with
> revisit triggers, §8 restates the seam as a discipline rather than an abstraction.
**Supersedes/affects:** CLAUDE.md §3 (stack), §4 (frozen), §7 (out of v1), §8 (no 3D abstraction)

---

## Context

The product spec has expanded from an event-sourced web trainer to a full networked simulator: replicated Mindray uMEC12 Vet + SunTech Vet20 devices, a SmartFlow-style task surface, four-tier progression, multiplayer role stations with task-locking, triage board, team debrief — and a stated Phase B of VR with 3D assets, avatars, and spatial audio. The proposed stack in that spec is **Unity + Mirror/Photon + Redis + LAN (CAT6/switch) + RTX-class workstations + Quest 3**.

This directly contradicts frozen decisions. It also changes what kind of company this is: a web product you send a link to, versus an installed, hardware-provisioned simulator.

**Hard constraints:**
- **Solo builder**, AI-agent-driven. Existing transferable conventions are TypeScript/Vite/React/Drizzle/Clerk/i18n-RTL (from VetTrack).
- **Liability requirement (CLAUDE.md §2.3):** any score influencing a hiring decision must be traceable to timestamped, role-attributed events in a durable append-only log.
- **Adoption is the #1 risk, evidence-backed.** [A4] a *resident-requested* progression curriculum reached **zero uptake** in 3 months because clinical service demand outranks training. [§6.4] it is **unvalidated** whether the pilot site can release a full crew simultaneously.
- **Hebrew-first RTL** throughout.

---

## The decisive analysis: how much of the spec actually requires 3D?

Classifying every capability the spec asks for:

| Capability | Needs 3D/VR? |
|---|---|
| Mindray monitor: waveforms, sweep rendering, channel colours, LED strip, alarm states | **No** — 2D canvas |
| SunTech Vet20: MAP emphasis, cuff-inflation animation, history table | **No** |
| SmartFlow task panel, 4 colour codes, lifecycle, locking | **No** |
| mg→ml calculation, syringe selection, draw-to-graduation | **No** — the skill is arithmetic + reading graduations |
| Blood tube selection (EDTA/Serum/Citrate/Heparin) | **No** — drag |
| Catheter + bandaging | **No** — the spec itself defines the desktop phase as drag-and-drop step ordering |
| Fluids: line vs. burette, drops/min | **No** — numeric |
| Multiplayer task-locking, auto-release, race prevention | **No** — server logic, transport-agnostic |
| Triage board, vet order entry, instructor console, mirror view | **No** |
| Debrief: timeline replay, event flags, scored report | **No** |
| Watching the animal breathe / clinical signs | **No** — looping video or animation is arguably *better* than a mediocre 3D model |
| Free-camera 3D patient, physically grabbing a syringe, hand-placing a jugular catheter, avatars, spatial voice | **Yes** |

**~90% of the specified training content is 2D.** The 3D-only remainder is real, but it is the last slice, and it has no validated pedagogical requirement yet — while the 2D core is where every A–G competency and all four tiers live.

---

## Decision

**Build on the current TypeScript web stack. Do not adopt Unity now. Keep the door to VR open via WebXR, not via Unity.**

Concretely: React/Vite client, Node authoritative server, pure deterministic reducer, **Postgres append-only event log**, Socket.IO transport. Monitor waveforms on canvas. If VR is later exercised, add a WebXR/react-three-fiber client **against the same event log** — Quest 3 runs WebXR natively in-browser, so VR does not require abandoning the web stack.

---

## Options Considered

### Option A: Current web stack (TS/React/Node/Postgres/Socket.IO) — **recommended**

| Dimension | Assessment |
|---|---|
| Complexity | Low–Med — one language, one mental model |
| Cost | Low — no hardware, no per-seat install |
| Scalability | Fine — a pilot runs 1–3 concurrent sessions |
| Team familiarity | **High** — transfers wholesale from VetTrack |

**Pros:** Zero install — adoption is a URL, which directly attacks the #1 evidenced risk. Durable auditable event log satisfies the liability requirement natively. Hebrew/RTL/i18n and a11y already solved conventions. Strong AI-agent ergonomics for a solo build. Deployable to Railway *or* on-prem on the hospital LAN — same code.
**Cons:** No free-camera 3D patient. No true motor-skill training. VR later requires a second renderer (WebXR) — real work, though against an unchanged core.

### Option B: Unity + Mirror/Photon + Redis + LAN, VR-ready now

| Dimension | Assessment |
|---|---|
| Complexity | **High** — new engine, new language (C#), new netcode, new deploy model |
| Cost | **High** — RTX workstations per station, switch + CAT6, headsets, install/maintenance |
| Scalability | Good for co-located crews; poor for casual/solo use |
| Team familiarity | **Low** — no transfer from VetTrack; weakest AI-agent ergonomics |

**Pros:** Genuine 3D and a real path to hand-tracked motor skills and spatial team presence. Matches the Elbit/OneSim reference model most literally.
**Cons:** Pays the full 3D cost now for an option exercised later. **Redis as the record is disqualifying as specified** (see below). Maximum adoption friction against a product whose main risk is friction. Discards the frozen event-sourced spine and the entire transferable toolchain.

### Option C: Hybrid — web core now, Unity client later against the same event log

Keeps Option A's core; if 3D is ever exercised, a Unity client subscribes to the same authoritative event stream. **This is already the concession written into CLAUDE.md §3** ("if 3D happens, Colyseus can sit in front of the same event-sourced core later"). Strictly better than committing to Unity now, and it is what Option A becomes if VR is chosen and WebXR proves insufficient.

---

## Trade-off Analysis

**1. The renderer is not the asset — the reducer and the log are.**
The spec's core argument for Unity now is "build 3D assets so you don't rewrite later." But the thing that must never be rewritten is the **simulation logic and the event record**, not the pixels. A pure `(state, event) => state` reducer over an append-only log is renderer-agnostic by construction: React today, WebXR or Unity tomorrow, both replaying the identical log. Committing to Unity now inverts this — it pays for the disposable layer to protect the durable one.

**2. Redis as the system of record is disqualifying as specified.**
The spec places Redis (in-memory) as the data layer. But the certification report is intended as **evidence in a hiring conversation** (§2.2/§2.3). Evidence cannot sit on a volatile substrate. Redis is fine as a lock/presence cache; the authoritative log must be durable and append-only. This is a correctness objection, not a preference — and it holds regardless of which client wins.

**3. Friction is the measured risk, and Option B maximises it.**
[A4] is the most important verified finding in the whole research: a training programme people *asked for* got zero completions because clinical demand outranked it. Option B adds per-station installs, GPU hardware, dedicated switching, headset hygiene between trainees, and mandatory co-location — on top of §6.4's unvalidated assumption that a crew can even be released simultaneously. Option A's adoption cost is opening a link.

**4. VR does not actually require Unity.**
Quest 3 runs WebXR natively in its browser, and react-three-fiber/WebXR is a mature path from a React codebase. So "VR-ready" and "web stack" are not opposed. This substantially weakens the only strong argument for Option B.

**5. Solo-build reality.**
CLAUDE.md §3 chose TypeScript end-to-end explicitly for "one mental model; strong AI-agent ergonomics." Unity/C#/Mirror/OpenXR is a different discipline with no transfer from VetTrack and materially weaker agent ergonomics — for a solo, agent-driven build, that is a schedule risk measured in months.

---

## Consequences

**Easier:**
- Ship the base rung (Tiers 1–4, SmartFlow surface, monitor, debrief) on known tooling.
- Liability/audit spine is satisfied by default, not retrofitted.
- Deploy anywhere: cloud or on-prem LAN, same artefact.
- Hebrew RTL, a11y, i18n, auth all inherit existing solved conventions.

**Harder:**
- No free-camera 3D patient in v1; clinical signs are video/animation, not a model.
- True motor-skill training (hand-placing a catheter, physically drawing a syringe) is **out of scope** until a VR client exists.
- If VR is later chosen, a second renderer must be built (against an unchanged core).

**Revisit when any of these becomes true:**
- A pedagogical requirement emerges that genuinely cannot be assessed in 2D (i.e. motor skill, not knowledge).
- The pilot validates that crews *can* be co-located reliably (resolving §6.4) **and** asks for spatial team training.
- A buyer makes VR a purchase condition.
- WebXR is trialled on Quest 3 and proves insufficient for the required fidelity.

---

## Action Items

- [ ] **Dan:** accept/reject this ADR. It is the gate on Phase 3.
- [ ] If accepted: amend CLAUDE.md §3/§7 to record that Unity/VR was formally evaluated and deferred, with the revisit triggers above — so this is a decided question, not a recurring one.
- [ ] Re-scope the design briefs to 2D-deliverable surfaces (already done for monitor + base rung).
- [ ] Record separately: Redis-as-record is rejected; durable Postgres append-only log stands, with Redis permissible as a lock/presence cache only.
- [ ] Keep the seam without adding abstraction (per §8): sim logic stays in the pure reducer; **no simulation state or rules inside React components.** That discipline alone preserves the Unity/WebXR option at zero present cost.
- [ ] Defer to a future ADR: on-prem LAN vs. Railway deployment for the pilot (a deployment choice under Option A, not an architecture choice).
