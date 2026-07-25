The uMEC12-Vet-style main monitor — the centrepiece of the "Dark Instrument" language. Waveforms are **sweep-rendered** on a canvas (a moving cursor erases and rewrites the trace, like real equipment), never scrolled.

**Channel colour is identity (Layer A), never severity** — and these are the verified real-device values:
`ECG/HR` **green `#00FF66`** · `SpO₂/Pleth` **cyan `#00CCFF`** · `EtCO₂` **yellow `#FFCC00`** · `Resp` yellow-amber · `NIBP`/`Temp` **white**.
A channel keeps its hue at every value (HR is green at 60 and at 210). The alarm state is a **separate, redundantly-coded layer** (LED strip + full-screen frame + number flash + mute indicator).

> ⚠️ Do **not** "restore" an older mapping that shows SpO₂ as yellow or EtCO₂ as lilac/purple — that is the superseded palette and it breaks the muscle-memory contract with the real device.

```jsx
<PatientMonitor
  patient={{ species: "dog", breed: "Canine", weightKg: 22, weightRange: "18–30 kg" }}
  channels={{ hr: 92, spo2: 97, etco2: 34, resp: 22 }}
  sub={{ pvcs: 0, st: "OFF", pi: 12.0, pr: 92, awrr: 22, fi: 2 }}
  temp={{ t1: 38.4, t2: 38.5 }}
  nibp={{ sys: 122, dia: 78, map: 93, time: "10:15" }}
  alarm="normal"
  alarming={[]}
  style={{ height: "100%" }}
/>
```

**Five lanes, mapped 1:1 to their value blocks:** ECG I + ECG II (the ECG block spans both), Pleth → SpO₂, CO2 → EtCO₂, Resp → Resp.

**No invasive arterial ("Art") lane or readout.** It was removed deliberately: the base-rung patient has no arterial line, so it was clinically irrelevant, it duplicated the NIBP numbers, and its red collided with the critical-alarm colour. **NIBP is the only blood-pressure readout.** If a future surgical/anaesthesia scenario genuinely needs invasive BP, add it back as an explicit opt-in — do not re-enable it by default.

**Sizing:** give it a fixed-height dark container and pass `style={{height:"100%"}}` — it fills its box. Each value block is its own size container: when a block is short, it keeps its **label + number** and hides secondary sub-values rather than letting them collide; at hero size all sub-values return. The number is never the element that gets squeezed.

Respects reduced-motion: traces draw static and alarms hold **steady-on** instead of strobing — the signal is kept, only the strobe is dropped.
