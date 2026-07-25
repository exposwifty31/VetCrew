import { describe, expect, test } from "vitest";

import {
  clientIntentSchema,
  clientIntentStrictSchema,
  roleViewWireSchema,
  sessionJoinSchema,
  sessionSnapshotSchema,
} from "../src/live-contracts.js";

describe("live contracts", () => {
  test("join requires a uuid sessionId and defaults stationKind to trainee", () => {
    expect(sessionJoinSchema.safeParse({ sessionId: "nope", role: "technician" }).success).toBe(
      false,
    );
    const parsed = sessionJoinSchema.safeParse({
      sessionId: "11111111-1111-4111-8111-111111111111",
      role: "technician",
      lastSeq: 0,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.stationKind).toBe("trainee");
  });

  test("client intents reject a smuggled seq", () => {
    const withSeq = {
      type: "task_start",
      taskId: "t1",
      seq: 9,
    };
    expect(clientIntentSchema.safeParse({ type: "task_start", taskId: "t1" }).success).toBe(true);
    expect(clientIntentStrictSchema.safeParse(withSeq).success).toBe(false);
  });

  test("trainee snapshot strips expected* leak keys in value_entry", () => {
    const leaky = {
      kind: "trainee",
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
    const parsed = sessionSnapshotSchema.safeParse(leaky);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.kind).toBe("trainee");
    expect(JSON.stringify(parsed.data)).not.toMatch(/expectedMin|expectedMax/);
  });

  test("instructor and trainee snapshots are discriminated", () => {
    const instructor = sessionSnapshotSchema.safeParse({
      kind: "instructor",
      seq: 2,
      instructorView: {
        phase: "running",
        timeMs: 1000,
        seq: 2,
        scenarioSlug: "base-rung-resp-distress",
        scenarioVersion: "0.1.0",
        species: "canine",
        vitals: { hr: 130 },
        injections: [
          {
            id: "monitor_artifact",
            label: "Monitor artifact",
            labelHe: "ארטיפקט",
            fired: false,
            firedAtMs: null,
          },
        ],
        taskSummaries: [],
        roles: ["technician"],
      },
    });
    expect(instructor.success).toBe(true);
    expect(
      sessionSnapshotSchema.safeParse({
        kind: "trainee",
        seq: 1,
        instructorView: instructor.success ? instructor.data : null,
      }).success,
    ).toBe(false);
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
