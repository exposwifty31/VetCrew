import { describe, expect, test } from "vitest";

import { evaluateTasks, type EngineEvent } from "../src/index.js";
import { TASK_SCENARIO, ev, fullRunEvents, resetSeq, startAndSubmit } from "./fixtures/task-scenario.js";

describe("evaluateTasks — expected vs actual over the log", () => {
  const evaluation = evaluateTasks(42, fullRunEvents(), TASK_SCENARIO);
  const byDim = (taskId: string, dimension: string) =>
    evaluation.results.find((r) => r.taskId === taskId && r.dimension === dimension);

  test("correct entries pass with evidence pointing at the submit event", () => {
    const temp = byDim("t1", "temp");
    expect(temp?.passed).toBe(true);
    expect(temp?.actual).toBe("38.4 °C");
    expect(temp?.evidenceSeqs.length).toBeGreaterThan(0);
    expect(byDim("t2", "position")?.passed).toBe(true);
    expect(byDim("t2", "error_diagnosis")?.passed).toBe(true);
    expect(byDim("t4", "tubes")?.passed).toBe(true);
    expect(byDim("t5", "order")?.passed).toBe(true);
  });

  test("route is scored separately from dose: correct ml + wrong route = dose pass, route FAIL (SRS §5.3)", () => {
    const dose = byDim("t3", "dose");
    const route = byDim("t3", "route");
    expect(dose?.passed).toBe(true);
    expect(dose?.actual).toBe("0.2 ml");
    expect(route?.passed).toBe(false);
    expect(route?.expected).toBe("SC");
    expect(route?.actual).toBe("IV");
  });

  test("the SC-only-given-IV route is flagged as a fatal-class (critical) error", () => {
    expect(byDim("t3", "route")?.critical).toBe(true);
    expect(byDim("t3", "dose")?.critical).toBe(false);
  });

  test("drops/min is judged against the CHOSEN set's formula (ml/hr entered as drops/min on a regular set fails)", () => {
    const set = byDim("t6", "set");
    const drops = byDim("t6", "drops_per_min");
    expect(set?.passed).toBe(true);
    expect(drops?.passed).toBe(false);
    expect(drops?.expected).toBe("50"); // 150 ml/hr ÷ 3 on a regular set
    expect(drops?.actual).toBe("150");
  });

  test("escalation is noticed with a directional time-to-notice", () => {
    expect(evaluation.escalation?.noticed).toBe(true);
    expect(evaluation.escalation?.timeToNoticeMs).toBe(10_000);
    expect(byDim("t7", "escalate")?.passed).toBe(true);
    // Evidence links both the abnormality and the escalation.
    expect(byDim("t7", "escalate")?.evidenceSeqs).toHaveLength(2);
  });

  test("summary counts pass/fail across all dimensions", () => {
    // t1×2 + t2×3 + t3×2 + t4×1 + t5×1 + t6×2 + t7×1 = 12
    expect(evaluation.totalCount).toBe(12);
    expect(evaluation.passedCount).toBe(10); // route + drops_per_min failed
  });
});

describe("evaluateTasks — edge cases", () => {
  test("an unattempted task fails every dimension with null actual", () => {
    resetSeq();
    const events: EngineEvent[] = [
      ev({ type: "phase_change", phase: "briefing" }),
      ev({ type: "phase_change", phase: "running" }),
      ev({ type: "phase_change", phase: "debrief" }),
    ];
    const evaluation = evaluateTasks(1, events, TASK_SCENARIO);
    const dose = evaluation.results.find((r) => r.taskId === "t3" && r.dimension === "dose");
    expect(dose?.passed).toBe(false);
    expect(dose?.actual).toBeNull();
  });

  test("escalating BEFORE the abnormality is a false alarm, not noticing", () => {
    resetSeq();
    const events: EngineEvent[] = [
      ev({ type: "phase_change", phase: "briefing" }),
      ev({ type: "phase_change", phase: "running" }),
      ev({
        type: "task_submit",
        role: "technician",
        actorId: "tech-1",
        taskId: "t7",
        submission: { kind: "escalate" },
      }),
      ...startAndSubmit("t6", { kind: "fluids_setup", setId: "regular", dropsPerMin: 50 }),
      ev({ type: "phase_change", phase: "debrief" }),
    ];
    const evaluation = evaluateTasks(1, events, TASK_SCENARIO);
    expect(evaluation.escalation?.noticed).toBe(false);
    expect(evaluation.results.find((r) => r.dimension === "escalate")?.passed).toBe(false);
  });

  test("when the abnormality never presents, the escalate dimension passes vacuously", () => {
    resetSeq();
    const events: EngineEvent[] = [
      ev({ type: "phase_change", phase: "briefing" }),
      ev({ type: "phase_change", phase: "running" }),
      ev({ type: "phase_change", phase: "debrief" }),
    ];
    const evaluation = evaluateTasks(1, events, TASK_SCENARIO);
    expect(evaluation.escalation?.abnormalitySeq).toBeNull();
    expect(evaluation.results.find((r) => r.dimension === "escalate")?.passed).toBe(true);
  });

  test("evaluation is deterministic", () => {
    const a = evaluateTasks(42, fullRunEvents(), TASK_SCENARIO);
    const b = evaluateTasks(42, fullRunEvents(), TASK_SCENARIO);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
