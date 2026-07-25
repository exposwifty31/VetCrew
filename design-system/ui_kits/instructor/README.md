# Instructor Console + Rating

The **highest-stakes** control surface — dense-but-controlled, fast, hard to mis-click. Composes `SessionState`, `ConnectionPill`, `VitalCard`, `InjectionTrigger`, `Button`.

- Persistent, glanceable **session state** + elapsed clock; **Pause/Resume** and **End Session** always visible (never scroll to find pause).
- **Live patient monitor** (station-size ticking `VitalCard`s) and **connected-role status** (per-role connection pill; one role shown `reconnecting`).
- **Fast-fire injection triggers** — large, well-spaced (Fitts's law), fire immediately with no confirmation; fired triggers show their T+ time and stay legible. A **conditional** injection is surfaced as "available", not auto-fired.
- **Only destructive actions confirm:** *End Session* opens a confirm dialog; injections never do.

Files: `index.html`, `Console.jsx` (→ `window.VCKit.Console`), `data.js`.
