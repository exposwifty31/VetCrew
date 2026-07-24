# VetCrew — WebXR spike (ADR-001)

**Purpose:** retire the one open condition on [ADR-001](../../docs/decisions/ADR-001-simulator-architecture.md) — prove that VetCrew can reach VR **from the web stack**, without adopting Unity.

## The thesis being tested

> The renderer is disposable; the simulation and the event log are the durable asset.

If that's true, one monitor implementation should drive both a 2D client and a VR client with **no changes to the monitor code**.

`src/monitor.js` is the proof. It is a plain ES class that draws a uMEC12-Vet-style monitor into a `<canvas>`. It imports nothing — no React, no three.js, no WebXR. Then:

- the **2D client** mounts that canvas directly into the DOM (the inspector panel, bottom-left), and
- the **XR client** wraps the *same* canvas in a `THREE.CanvasTexture` and maps it onto 3D screen planes with device bezels and a rotary knob.

Both are on screen simultaneously, driven by one `MonitorRenderer` instance.

## Result: **PASS** (desktop-verified)

Verified in-browser at `http://localhost:5173`:

- ✅ Sweep rendering works — traces are erased and rewritten by a moving cursor with a blanking gap, not scrolled. Reads as an instrument, not a chart.
- ✅ Waveform shapes render correctly — ECG (P-QRS-T), pleth with dicrotic notch, arterial, capnography plateau.
- ✅ **Channel colours match the real uMEC12 Vet**: ECG green · SpO₂ **cyan** · Art red · CO₂/Resp yellow · NIBP/Temp white.
- ✅ **Layer A / Layer B separation holds under alarm.** Trigger the crash: HR reads 208 and SpO₂ reads 79, and *both keep their channel hue*. Severity is carried only by the LED strip, the full-screen frame, and the value flash. This is the single most important thing the spike demonstrates — the two-colour-system rule survives contact with a real renderer.
- ✅ Diegetic UI works — the monitor is a **surface in the world** (two angled screens on bezels), which is the pattern the VR spec asks for.
- ✅ One canvas → two clients, zero monitor-code changes.
- ✅ Production build succeeds (`pnpm build`).

**Not yet verified: on-headset.** `immersive-vr` is correctly reported unsupported on desktop. The "Enter VR" button is wired to `store.enterVR()` and needs a Quest 3 to confirm frame pacing and legibility. See below.

## Running it

```bash
pnpm --dir spikes/webxr dev
```

Then open `http://localhost:5173`. Drag to orbit. "Trigger crash" toggles the critical alarm state.

## Testing on the Quest 3

WebXR requires a **secure origin**. Two options:

```bash
adb reverse tcp:5173 tcp:5173
```
then open `http://localhost:5173` in the Quest browser (localhost counts as secure) — this is the reliable path.

Otherwise serve over HTTPS on the LAN and open the machine's IP from the headset.

**What to check on-headset:** is the monitor text legible at a natural standing distance; does the sweep hold a steady frame rate; does the alarm frame read peripherally.

## What this spike does NOT claim

- It does not model a dog. The patient is a capsule — deliberately. The spike tests whether a patient can *occupy space* beside the monitor, not whether we can do 3D anatomy.
- It does not test hand tracking, controller interaction, or spatial audio. Those are the genuinely 3D-only capabilities and remain out of scope per ADR-001.
- Performance is untested at scale (multiple patients, multiple monitors).

## If this had failed

The ADR's revisit trigger would have fired and Unity would be back on the table. It didn't — so VR stays open via WebXR, and no Unity cost is paid now.
