# Decision memo — shipped scenario vs. base-rung SRS divergence

**Status:** PROPOSED — awaiting Dan's decision. Do not build the Sprint 3 station UI until this is resolved (lifecycle audit V5, 2026-07-25).
**Raised by:** dev-team lifecycle audit, per the SRS's own footer rule ("any conflict with this SRS is a defect — raise it").

## The divergence

`docs/specs/base-rung-srs.md` (2026-07-24) specifies Scenario #1 as a **deliberate, stepped, turn-based** task sequence (Engine Alpha, seven tasks; OD-1 explicitly rules out wall-clock time). What Sprint 2 shipped as `scenarios/base-rung-resp-distress.json` is a **real-time deterioration scenario**: `ratePerSec` vitals decay, a timed decompensation trigger at 150s, an "oxygen within 60 seconds" checklist item. That is Engine Beta content carrying a "base rung" label.

Secondary deviations:
- It scores `task_management`, where the SRS restricts solo scoring to Situation Awareness + Decision-Making.
- It includes a communication hook in a solo scenario, which CLAUDE.md §2.4 forbids ("do not solo-ize the non-technical axis").

## Why it matters now

Sprint 3 builds the trainee station **around the scenario**. A monitor-driven crash UI and a task-panel stepped UI are different surfaces (different registers in the design system). Building the station against the wrong scenario shape bakes the divergence into a second, much more expensive layer, and breaks requirements-to-build traceability in a project whose doctrine is auditability.

## Options

**(a) Amend the SRS — RECOMMENDED.**
`resp-distress` is reclassified as the **engine-proving demo** (it exists to exercise deterioration, triggers, and the AAR — which it did). The seven-task stepped scenario from the SRS becomes **Scenario #2**, and it is what the Sprint 3 station targets. The SRS gains a note that the deterioration engine shipped early as a demo, not as the base rung.
- Cost: one SRS edit + authoring Scenario #2 (data only, no engine change — the reducer already handles both shapes).
- Preserves: everything built; the demo stays as the pitch asset.
- Also fixes the secondary deviations by scoping them to the demo: Scenario #2 scores SA + DM only, no communication hook.

**(b) The SRS stands as-is.**
`resp-distress` is replaced before the station UI locks onto it. The seven-task scenario is authored now and becomes the only scenario.
- Cost: the demo scenario is demoted/deleted; the pitch loses its live-deterioration AAR unless kept as an unlisted dev fixture.

Either is fine; **undocumented divergence is not.**

## Decision

_(to be filled by Dan; record date and chosen option)_
