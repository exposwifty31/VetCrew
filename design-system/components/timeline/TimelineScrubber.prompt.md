The AAR replay spine: a draggable playhead over the session duration with shape-coded event markers (action / injection / vitals / callout / phase) and optional per-role lanes. Clicking a marker seeks to it — this is the mechanism behind "click a score, jump to its source events". Time is RTL-native (T0 at the inline-start / right edge; ArrowLeft advances).

```jsx
<TimelineScrubber
  duration={720}
  position={pos}
  onSeek={setPos}
  markers={[
    { t: 42, type: "injection", role: "instructor", label: "החמרה" },
    { t: 88, type: "vitals", severity: "elevated", role: "patient", label: "דופק עולה" },
    { t: 130, type: "action", role: "primary_tech", label: "גישה ורידית" },
  ]}
  lanes={[{ role: "primary_tech", label: "טכנאי ראשי" }, { role: "vet", label: "וטרינר" }]}
  onMarkerClick={(m) => openEvent(m)}
/>
```

Keyboard: it's a `slider`; arrows seek (±5s, ±30s with Shift), Home/End jump to ends. Markers are ≥18px hit targets.
