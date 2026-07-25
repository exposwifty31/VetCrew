Connection / data-freshness pill — separate channel from severity. `reconnecting` is coded three ways (amber + spinner + diagonal hatch) so a stale connection can never be mistaken for a live one.

```jsx
<ConnectionPill state="live" />
<ConnectionPill state="reconnecting" />
<ConnectionPill state="offline" lang="en" />
```

States: `live` (pulsing dot, green), `paused` (pause bars, neutral), `offline` (slashed ring, neutral), `reconnecting` (spinning arc + hatch, amber). Use inside a station header or over a VitalCard.
