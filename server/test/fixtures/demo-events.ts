import type { EngineEventBody } from "@vetcrew/shared";

/**
 * The canonical scripted demo run, shared by the integration suite, the E2E
 * suite, and anything else that needs "the" demo session: briefing -> running,
 * a deliberate priority inversion (IV access attempted before airway/pulses
 * check — the recorded floor failure), then debrief at 120s.
 *
 * Bodies have NO seq — the server assigns contiguous seqs on append.
 */
export function demoEvents(actorId: string): EngineEventBody[] {
  const events: EngineEventBody[] = [];
  let timeMs = 0;
  const tick = (upToMs: number) => {
    while (timeMs < upToMs) {
      events.push({ type: "tick", dtMs: 5000 });
      timeMs += 5000;
    }
  };
  const act = (action: string) => {
    events.push({ type: "action", role: "technician", actorId, action });
  };
  events.push({ type: "phase_change", phase: "briefing" });
  events.push({ type: "phase_change", phase: "running" });
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
  events.push({ type: "phase_change", phase: "debrief" });
  return events;
}
