import { describe, expect, test } from "vitest";

import { engineEventSchema, sessionPhaseSchema } from "../src/index.js";

describe("wire contracts stay in sync with the engine", () => {
  test("accepts every engine event shape", () => {
    const samples = [
      { seq: 1, type: "tick", dtMs: 1000 },
      { seq: 2, type: "action", role: "technician", actorId: "t1", action: "task_step" },
      { seq: 3, type: "injection", injection: "nibp_artifact" },
      { seq: 4, type: "phase_change", phase: "running" },
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

  test("phase enum matches the engine FSM", () => {
    expect(sessionPhaseSchema.options).toEqual([
      "draft",
      "briefing",
      "running",
      "paused",
      "debrief",
      "scored",
      "archived",
    ]);
  });
});
