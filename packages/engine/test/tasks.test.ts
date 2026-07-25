import { describe, expect, test } from "vitest";

import { createInitialState, reduce, replay, type EngineState } from "../src/index.js";
import { TASK_SCENARIO, ev, fullRunEvents, resetSeq, startAndSubmit } from "./fixtures/task-scenario.js";

function running(): EngineState {
  resetSeq();
  let state = createInitialState(7, TASK_SCENARIO);
  state = reduce(state, ev({ type: "phase_change", phase: "briefing" }));
  state = reduce(state, ev({ type: "phase_change", phase: "running" }));
  return state;
}

describe("task lifecycle in the reducer", () => {
  test("initial state marks every task available", () => {
    const state = createInitialState(1, TASK_SCENARIO);
    expect(Object.keys(state.tasks)).toHaveLength(7);
    for (const runtime of Object.values(state.tasks)) {
      expect(runtime.lifecycle).toBe("available");
      expect(runtime.submission).toBeNull();
    }
  });

  test("task_start moves available -> in_progress with time and seq attribution", () => {
    let state = running();
    state = reduce(state, ev({ type: "tick", dtMs: 5000 }));
    const startEvent = ev({ type: "task_start", role: "technician", actorId: "tech-1", taskId: "t1" });
    state = reduce(state, startEvent);
    const t1 = state.tasks["t1"];
    expect(t1?.lifecycle).toBe("in_progress");
    expect(t1?.startedAtMs).toBe(5000);
    expect(t1?.startSeq).toBe(startEvent.seq);
  });

  test("a WRONG answer is accepted and recorded verbatim (SRS §5.2 — never block)", () => {
    let state = running();
    for (const event of startAndSubmit("t3", { kind: "med_admin", ml: 2, routeId: "iv" })) {
      state = reduce(state, event);
    }
    const t3 = state.tasks["t3"];
    expect(t3?.lifecycle).toBe("done");
    expect(t3?.submission).toEqual({ kind: "med_admin", ml: 2, routeId: "iv" });
  });

  test("submit with a mismatched body kind is logged but moves nothing", () => {
    let state = running();
    state = reduce(
      state,
      ev({
        type: "task_submit",
        role: "technician",
        actorId: "tech-1",
        taskId: "t3",
        submission: { kind: "escalate" },
      }),
    );
    expect(state.tasks["t3"]?.lifecycle).toBe("available");
    expect(state.appliedSeq).toBeGreaterThan(0);
  });

  test("submit on a done task is logged but does not overwrite the record", () => {
    let state = running();
    for (const event of startAndSubmit("t4", { kind: "tube_choice", optionIds: ["edta"] })) {
      state = reduce(state, event);
    }
    state = reduce(
      state,
      ev({
        type: "task_submit",
        role: "technician",
        actorId: "tech-1",
        taskId: "t4",
        submission: { kind: "tube_choice", optionIds: ["edta", "serum"] },
      }),
    );
    expect(state.tasks["t4"]?.submission).toEqual({ kind: "tube_choice", optionIds: ["edta"] });
  });

  test("task events outside running phase are logged but move nothing", () => {
    resetSeq();
    let state = createInitialState(7, TASK_SCENARIO);
    state = reduce(state, ev({ type: "task_start", role: "technician", actorId: "tech-1", taskId: "t1" }));
    expect(state.tasks["t1"]?.lifecycle).toBe("available");
  });

  test("the standing escalate control submits without a prior start", () => {
    let state = running();
    state = reduce(
      state,
      ev({
        type: "task_submit",
        role: "technician",
        actorId: "tech-1",
        taskId: "t7",
        submission: { kind: "escalate" },
      }),
    );
    expect(state.tasks["t7"]?.lifecycle).toBe("done");
  });

  test("task_done trigger fires the abnormality when T6 completes", () => {
    let state = running();
    for (const event of startAndSubmit("t6", {
      kind: "fluids_setup",
      setId: "regular",
      dropsPerMin: 50,
    })) {
      state = reduce(state, event);
    }
    expect(state.firedTriggerIds).toContain("t7-abnormality");
    expect(state.vitals["hr"]?.target).toBe(44);
    expect(state.vitals["sys_bp"]?.target).toBe(195);
  });
});

describe("task-scenario determinism (golden)", () => {
  test("same seed + same events => byte-identical state across the full 7-task run", () => {
    const a = replay(42, fullRunEvents(), TASK_SCENARIO);
    const b = replay(42, fullRunEvents(), TASK_SCENARIO);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("the full run ends in debrief with all seven tasks done", () => {
    const state = replay(42, fullRunEvents(), TASK_SCENARIO);
    expect(state.phase).toBe("debrief");
    for (const runtime of Object.values(state.tasks)) {
      expect(runtime.lifecycle).toBe("done");
    }
  });
});
