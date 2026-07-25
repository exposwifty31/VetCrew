A single monitored vital. Severity is redundantly coded (bare severity chip + accent edge + faint wash). The number is tabular mono and flashes on change (amber rising / blue falling) without relayout. Setting `stale` freezes the card into an unmistakable "reconnecting" state — desaturated, hatched, veiled, with a last-seen timestamp — so it can never be read as live.

```jsx
<VitalCard name="דופק" abbr="HR" value={168} unit="bpm" level="elevated" trend="up" />
<VitalCard name="ריווי חמצן" abbr="SpO₂" value={91} unit="%" level="watch" trend="down" size="compact" />
<VitalCard name="דופק" abbr="HR" value={168} unit="bpm" stale lastSeen="12:04:38" />
```

`size`: `station` (large, trainee glanceable) or `compact` (dense AAR/instructor grids). Always pass a numeric `value` when you want the tick flash.
