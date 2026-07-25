import { SESSION_PHASES } from "@vetcrew/engine";
import { describe, expect, test } from "vitest";

import { engineEventSchema, sessionPhaseSchema } from "../src/index.js";

describe("wire contracts stay in sync with the engine", () => {
  test("accepts every engine event shape", () => {
    const samples = [
      { seq: 1, type: "tick", dtMs: 1000 },
      { seq: 2, type: "action", role: "technician", actorId: "t1", action: "task_step" },
      { seq: 3, type: "injection", injection: "nibp_artifact" },
      { seq: 4, type: "phase_change", phase: "running" },
      {
        seq: 5,
        type: "task_start",
        role: "technician",
        actorId: "t1",
        taskId: "t1",
      },
      {
        seq: 6,
        type: "task_submit",
        role: "technician",
        actorId: "t1",
        taskId: "t1",
        submission: { kind: "value_entry", values: { temp: 38.4 } },
      },
      {
        seq: 7,
        type: "task_submit",
        role: "technician",
        actorId: "t1",
        taskId: "t7",
        submission: { kind: "escalate" },
      },
    ];
    for (const sample of samples) {
      expect(engineEventSchema.safeParse(sample).success).toBe(true);
    }
  });

  test("rejects malformed events", () => {
    expect(engineEventSchema.safeParse({ seq: 0, type: "tick", dtMs: 1000 }).success).toBe(false);
    expect(engineEventSchema.safeParse({ seq: 1, type: "tick", dtMs: -5 }).success).toBe(false);
    expect(engineEventSchema.safeParse({ seq: 1, type: "unknown" }).success).toBe(false);
    expect(engineEventSchema.safeParse({ seq: 1, type: "phase_change", phase: "exploded" }).success).toBe(false);
  });

  test("phase enum matches the engine FSM (imported, not hardcoded)", () => {
    expect(sessionPhaseSchema.options).toEqual([...SESSION_PHASES]);
  });
});
