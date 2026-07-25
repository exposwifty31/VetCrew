import { describe, expect, test } from "vitest";

import { scenarioDefSchema } from "../src/index.js";

const VALID = {
  slug: "hypoxia",
  version: "0.1.0",
  vitals: {
    spo2: { initial: 95, target: 78, ratePerSec: 0.5, jitter: 0 },
  },
  triggers: [
    {
      id: "oxygen",
      on: { kind: "action", action: "oxygen_on" },
      effects: [{ vital: "spo2", target: 97 }],
    },
  ],
};

describe("scenario contract", () => {
  test("accepts a valid scenario", () => {
    expect(scenarioDefSchema.safeParse(VALID).success).toBe(true);
  });

  test("rejects a trigger effect on an undefined vital", () => {
    const bad = {
      ...VALID,
      triggers: [{ ...VALID.triggers[0], effects: [{ vital: "hr", target: 100 }] }],
    };
    const result = scenarioDefSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  test("rejects duplicate trigger ids", () => {
    const bad = { ...VALID, triggers: [VALID.triggers[0], VALID.triggers[0]] };
    expect(scenarioDefSchema.safeParse(bad).success).toBe(false);
  });

  test("rejects unknown trigger kinds and negative rates", () => {
    expect(
      scenarioDefSchema.safeParse({
        ...VALID,
        triggers: [{ id: "x", on: { kind: "weather" }, effects: [{ vital: "spo2" }] }],
      }).success,
    ).toBe(false);
    expect(
      scenarioDefSchema.safeParse({
        ...VALID,
        vitals: { spo2: { initial: 95, target: 78, ratePerSec: -1, jitter: 0 } },
      }).success,
    ).toBe(false);
  });
});
