# AAR Replay Viewer

The MVP's visible, **manager-facing** output — reflective and data-rich. Composes `TimelineScrubber`, `VitalCard`, `AntsRating`, `SeverityChip`, `SessionState`.

- **Timeline scrubber** (RTL, T0 at the start/right) with per-role lanes and shape-coded event markers; drag or use transport controls to move through the session.
- **Per-role partial views** reconstruct what each role saw at the current moment (event-sourced replay).
- **Scores are tied to their evidence:** each `AntsRating`'s evidence link and every technical-checklist row **jumps the timeline to the exact event** that justifies it — a score is never a disconnected number.
- Filter markers by role and by event type. Light/dark toggle in the header.

Files: `index.html` (harness), `AarViewer.jsx` (app → `window.VCKit.AarViewer`), `data.js` (sample GDV session).
