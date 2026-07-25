Session lifecycle (FSM) indicator — the current state must always be glanceable. `badge` for tight headers (trainee/AAR), `stepper` for the instructor console to show progress through the whole lifecycle.

```jsx
<SessionState state="running" elapsed="07:42" />
<SessionState state="paused" variant="stepper" elapsed="12:05" />
```

States: draft · briefing · running ⇄ paused · debrief · scored · archived. `running` gets a green heartbeat dot (distinct from teal action and from severity). `elapsed` renders in tabular mono.
