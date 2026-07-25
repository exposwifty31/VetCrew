# Trainee Station

Calm, glanceable, and **deliberately partial** — a role sees only what its role would know, so trainees must communicate to get the rest. Composes `VitalCard`, `SessionState`, `ConnectionPill`, `Button`.

- **Partial view:** this role (primary tech) sees HR + SpO₂ large; blood pressure is a **withheld tile** ("ask the vet") — information hiding as a feature.
- **Two modalities** (same language, different tempo), switchable in the demo strip:
  - **Base / procedural (Engine Alpha):** the clock is **frozen** between actions; a big step card advances on "בצע והמשך".
  - **Real-time (Engine Beta):** the clock ticks, vitals evolve, callout/help actions under time pressure.
- **Never-stale reconnecting state:** toggle connection to `מתנתק` and the vitals freeze — desaturated, hatched, veiled, with a last-seen stamp and an alert banner. It can never be mistaken for live data.

Files: `index.html`, `Station.jsx` (→ `window.VCKit.Station`), `data.js`.
