# SunTech Vet20 — implementation blueprint (Phase 3 reference)

**Status: DIRECTIONAL, not source of truth.** Contributed 2026-07-24. This is a
conceptual architecture for the simulated SunTech Vet20 NIBP device — a device-local
finite state machine plus a species/condition physiology generator. Adapt and refactor
it to the real engine; do not lift it verbatim.

## Where this fits

- **This is a component of Engine Alpha**, the base-rung procedural engine. The device
  FSM below is the device's *internal* lifecycle — separate from, and nested inside, the
  session FSM (`draft→briefing→running⇄paused→debrief→scored→archived`). Do not conflate them.
- It is consistent with **ADR-001**: pure `(state, action) => state` reducer, renderer-agnostic
  view component, explicit WebXR path via `react-three-fiber` (`<Html>` / canvas-to-texture).
  That is exactly the seam the WebXR spike proved (`spikes/webxr/`).
- The **design** of these screens is being produced in Claude Design (the Phase-2 SunTech item).
  The design tool owns the visual states; this file owns the behaviour the code implements.

## MUST FIX before use

1. **Clinical sign-off (§2.5, blocking).** Every vital range below is a clinical claim that
   will drive a scored result. Dog/cat baselines, the hypotensive/hypertensive/arrhythmia
   deltas, the MAP formula, and the `systolic + 35` occlusion target must all be reviewed by
   the clinical reviewer and stamped `clinically_reviewed` with the scenario version **before
   they score anyone**, no matter how plausible the numbers look.
2. **Type gap (code bug).** `Vet20Controller` reads `state.vitals?.condition`, but `condition`
   is not a field on `VitalSigns` — it is the generator's *input*, not its output. To drive the
   arrhythmia-specific motion-artefact branch, add `condition` (and ideally `species`) to
   `VitalSigns`, or carry it separately on machine state. As written, the arrhythmia error path
   never fires.
3. **Determinism (Engine Alpha rule).** The ticker uses `Math.random()` for the motion-artefact
   injection and wall-clock `setInterval`/`setTimeout` timers. Inside the deterministic reducer
   these are **forbidden** — randomness must come from the seeded PRNG and time from explicit
   tick events, or the replay/audit guarantee breaks. The reference's timer-driven shape is fine
   for a throwaway UI demo; the real engine drives ticks from the sim clock.
4. **Colour.** The reference view hard-codes SYS red / DIA green / PULSE blue and a mono font.
   The real device follows the locked design system: NIBP is the **white** channel; deviation is
   shown via the **alarm layer**, not by recolouring values; numerals use `--font-metric`. Take
   only the *layout and states* from the view below.

## The device state machine (states, not code to keep)

```
POWER_OFF → POWER_ON → BOOT → (BOOT_COMPLETE) → IDLE
IDLE → (START_MEASUREMENT) → INFLATING
INFLATING → (cuff ≥ occlusion target) → DEFLATING → (resolved) → RESULT
INFLATING|DEFLATING → (TRIGGER_ERROR) → ERROR
RESULT|ERROR → (RESET_TO_IDLE) → IDLE   |   (START_MEASUREMENT) → INFLATING
any → (POWER_OFF) → POWER_OFF
```

Measurement physics to preserve: inflate past systolic to an occlusion target
(~`systolic + 35`), then bleed down in small steps until `≈ diastolic − 10`, then resolve
SYS/DIA/MAP/PULSE. `MAP ≈ diastolic + (systolic − diastolic) / 3`.

## Reference source (directional — verbatim as contributed)

The original contribution included `types.ts` (`generatePatientVitals` with dog/cat baselines
and normal/hypotensive/hypertensive_stressed/arrhythmia conditions), `vet20Machine.ts`
(`vet20Reducer` over the states above), and `Vet20MonitorScreen.tsx` / `Vet20Controller.tsx`
(pure view + orchestration with boot timer and inflation/deflation ticker). Recover the full
listings from the 2026-07-24 chat log when implementing; they are not reproduced here as
authoritative because every numeric and colour value above is superseded by clinical review
and the design system.
