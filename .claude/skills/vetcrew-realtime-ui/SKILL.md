---
name: vetcrew-realtime-ui
description: UI engineering patterns for VetCrew's three distinct real-time surfaces — the role station (trainee view), the instructor console (live scenario control), and the AAR replay viewer (post-session review). Consult this before building or reviewing any VetCrew frontend screen, before deciding what a role station should or shouldn't show, before laying out instructor controls, or before designing the AAR timeline/scrubber. Use even without the word "UI" — e.g. "what should the tech's screen look like during a session," "how does the instructor pause things," "build the debrief screen."
---

# VetCrew Real-Time UI Patterns

VetCrew has three UI surfaces that look nothing alike because they serve different moments and different stakes. Don't reuse one layout metaphor across all three — that's the single most likely design mistake here. Ground specific calls in the `ui-engineer` skill's reference material (interaction laws, state modeling, performance) rather than opinion; this skill applies those principles to VetCrew's specific surfaces.

## Surface 1: Role station — information hiding is a feature

A trainee should only see what their role would realistically know in the room. This is the opposite instinct from most dashboards (VetTrack included), where showing more information is usually better. Here, showing a tech everything the instructor sees defeats the point of the exercise — the training value comes partly from having to communicate to get information other roles hold. Design each role's view as a genuinely partial view of session state, not a full view with some panels hidden.

- Render only from server-pushed session state (see `vetcrew-sim-architecture`) — never let the client infer or interpolate values the engine hasn't sent it.
- On reconnect, show an explicit "reconnecting" state rather than the last-known values. A trainee acting on stale vitals during a live exercise is a correctness bug, not a loading-spinner nicety.
- Numeric vitals that update frequently (HR, resp rate) need to feel alive without causing layout thrash — animate the value change, don't re-lay-out the surrounding card on every tick.

## Surface 2: Instructor console — the highest-stakes UI in the product

A fumbled instructor click doesn't just annoy one user — it breaks the exercise for the entire crew mid-session. This justifies more design rigor here than almost anywhere else in the product.

- **Apply Fitts's law explicitly**: injection triggers must be large targets, spaced apart, and visually distinct from each other — not a dense list of small buttons an instructor has to hit precisely while also watching the room.
- **Confirm destructive actions only.** Ending a session or discarding progress deserves a confirmation step; firing a pre-planned injection does not — that action needs to be fast, because the instructor is making a live pedagogical judgment call under the same time pressure the trainees are under. Gating every action behind a confirm dialog is the wrong trade-off here, even though it'd be the safe default elsewhere in VetCrew's design system.
- Give constant, unambiguous feedback on session state (running/paused, which injections have already fired) — an instructor should never have to guess whether their last click registered.
- Treat this screen as a control panel, not a form. Persistent, glanceable status; primary actions always visible; no scrolling to find the pause button.

## Surface 3: AAR replay viewer — a different interaction budget entirely

This is reviewed after the pressure is off, so it can (and should) trade speed for depth.

- Timeline scrubber synchronized with a per-role, per-metric event log — let a reviewer jump to any point and see what every role saw at that moment, which is exactly the event-sourced replay `vetcrew-sim-architecture` is designed to support.
- Filter by role and by event type (actions vs injections vs vitals changes) so a reviewer can isolate "what did the primary tech do" from "what was happening to the patient."
- Surface scoring dimensions (see `vetcrew-readiness-scoring`) alongside the timeline, not as a separate disconnected report — the reviewer should be able to see *why* a non-technical-skill score landed where it did, tied to specific moments in the replay.

## State modeling

Model session/scenario state on the frontend as an explicit finite-state machine (draft/briefing/running/paused/debrief/scored — matching `vetcrew-sim-architecture`'s session lifecycle) rather than a scatter of boolean flags (`isRunning`, `isPaused`, `hasEnded`...). Boolean-flag state is exactly where "impossible states become representable" bugs creep in — e.g. `isRunning && isPaused` both true — and this product can't afford that kind of bug on the instructor console.

## Accessibility and design system

Carry over WCAG 2.1 AA as the baseline (consistent with VetTrack), and treat color-blind-safe severity coding as non-negotiable for vitals/criticality indicators — arguably more important here than in VetTrack, since a trainee reading a miscoded severity level during a timed exercise is a training-fidelity problem, not just an access problem.

**Open decision, don't assume:** whether VetCrew shares VetTrack's design system (ivory base, dark green action color, forest/clinical/dark themes, 48px touch targets) or gets its own. A shared system lowers build cost for a solo founder; a distinct system avoids importing assumptions (like dashboard-style information density) that fit VetTrack's equipment-tracking use case better than VetCrew's three very different surfaces. Decide this explicitly early, since role-station minimalism and instructor-console density will pull the visual language in different directions than VetTrack's cockpit-dashboard look.
