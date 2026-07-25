import type { EngineEvent } from "@vetcrew/engine";

/**
 * The canonical scripted demo run, shared by the integration suite, the E2E
 * suite, and anything else that needs "the" demo session: briefing -> running,
 * a deliberate priority inversion (IV access attempted before airway/pulses
 * check — the recorded floor failure), then debrief at 120s.
 */
export function demoEvents(actorId: string): EngineEvent[] {
  const events: EngineEvent[] = [];
  let seq = 0;
  let timeMs = 0;
  const tick = (upToMs: number) => {
    while (timeMs < upToMs) {
      events.push({ seq: ++seq, type: "tick", dtMs: 5000 });
      timeMs += 5000;
    }
  };
  const act = (action: string) => {
    events.push({ seq: ++seq, type: "action", role: "technician", actorId, action });
  };
  events.push({ seq: ++seq, type: "phase_change", phase: "briefing" });
  events.push({ seq: ++seq, type: "phase_change", phase: "running" });
  tick(10_000);
  act("vitals_callout");
  tick(25_000);
  act("oxygen_on");
  tick(45_000);
  act("iv_access_attempt"); // before airway_pulses_check: the recorded floor failure
  tick(55_000);
  act("airway_pulses_check");
  tick(90_000);
  act("give_drug_sc");
  tick(120_000);
  events.push({ seq: ++seq, type: "phase_change", phase: "debrief" });
  return events;
}
