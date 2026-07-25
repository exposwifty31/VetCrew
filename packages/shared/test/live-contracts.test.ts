import { describe, expect, test } from "vitest";

import {
  clientIntentSchema,
  clientIntentStrictSchema,
  roleViewWireSchema,
  sessionJoinSchema,
  sessionSnapshotSchema,
} from "../src/live-contracts.js";

describe("live contracts", () => {
  test("join requires a uuid sessionId", () => {
    expect(sessionJoinSchema.safeParse({ sessionId: "nope", role: "technician" }).success).toBe(
      false,
    );
    expect(
      sessionJoinSchema.safeParse({
        sessionId: "11111111-1111-4111-8111-111111111111",
        role: "technician",
        lastSeq: 0,
      }).success,
    ).toBe(true);
  });

  test("client intents reject a smuggled seq", () => {
    const withSeq = {
      type: "task_start",
      taskId: "t1",
      seq: 9,
    };
    // Base schema strips unknown keys in zod 4? — strict refine catches own property.
    expect(clientIntentSchema.safeParse({ type: "task_start", taskId: "t1" }).success).toBe(true);
    expect(clientIntentStrictSchema.safeParse(withSeq).success).toBe(false);
  });

  test("snapshot roleView forbids expected* leak keys in value_entry", () => {
    const leaky = {
      seq: 1,
      roleView: {
        role: "technician",
        phase: "running",
        timeMs: 0,
        seq: 1,
        scenarioSlug: "base-rung-stepped-tasks",
        scenarioVersion: "0.1.0",
        species: "dog",
        vitals: { hr: 90 },
        tasks: [
          {
            id: "t1",
            code: "do",
            title: "TPR",
            titleHe: "מדדים",
            instruction: "x",
            instructionHe: "x",
            hidden: false,
            lifecycle: "available",
            submission: null,
            body: {
              kind: "value_entry",
              fields: [
                {
                  id: "hr",
                  label: "HR",
                  labelHe: "דופק",
                  unit: "bpm",
                  format: "^\\d+$",
                  expectedMin: 70,
                  expectedMax: 120,
                },
              ],
            },
          },
        ],
      },
    };
    // Zod object schemas strip unknown keys by default — parse succeeds but
    // the stripped output must not retain the leak.
    const parsed = sessionSnapshotSchema.safeParse(leaky);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(JSON.stringify(parsed.data)).not.toMatch(/expectedMin|expectedMax/);
  });

  test("escalate body on the wire has no abnormalityTriggerId", () => {
    const view = {
      role: "technician",
      phase: "running",
      timeMs: 0,
      seq: 2,
      scenarioSlug: "s",
      scenarioVersion: "0.1.0",
      species: null,
      vitals: {},
      tasks: [
        {
          id: "t7",
          code: "approval",
          title: "Escalate",
          titleHe: "הסלמה",
          instruction: "x",
          instructionHe: "x",
          hidden: true,
          lifecycle: "available",
          submission: null,
          body: { kind: "escalate", abnormalityTriggerId: "secret" },
        },
      ],
    };
    const parsed = roleViewWireSchema.safeParse(view);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.tasks[0]?.body).toEqual({ kind: "escalate" });
  });
});
