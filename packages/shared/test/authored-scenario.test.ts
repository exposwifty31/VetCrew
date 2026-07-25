import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { authoredScenarioSchema } from "../src/index.js";

const scenarioPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "scenarios",
  "base-rung-resp-distress.json",
);

describe("authored scenario contract", () => {
  test("the shipped base-rung scenario validates", () => {
    const raw: unknown = JSON.parse(readFileSync(scenarioPath, "utf8"));
    const result = authoredScenarioSchema.safeParse(raw);
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);
  });

  test("unreviewed scenario carries clinically_reviewed=false (internal testing only)", () => {
    const raw = JSON.parse(readFileSync(scenarioPath, "utf8")) as { clinicallyReviewed: boolean };
    expect(raw.clinicallyReviewed).toBe(false);
  });

  test("rejects checklist rules referencing unknown actions", () => {
    const raw = JSON.parse(readFileSync(scenarioPath, "utf8")) as Record<string, unknown>;
    const broken = {
      ...raw,
      checklist: [
        {
          id: "bad",
          label: "x",
          labelHe: "x",
          weight: 1,
          rule: { kind: "action_performed", action: "not_a_real_action" },
        },
      ],
    };
    expect(authoredScenarioSchema.safeParse(broken).success).toBe(false);
  });

  test("rejects engine triggers keyed off actions outside the verb menu", () => {
    const raw = JSON.parse(readFileSync(scenarioPath, "utf8")) as {
      engine: { vitals: Record<string, unknown>; triggers: unknown[] };
    } & Record<string, unknown>;
    const broken = {
      ...raw,
      engine: {
        ...raw.engine,
        triggers: [
          {
            id: "ghost",
            on: { kind: "action", action: "ghost_action" },
            effects: [{ vital: "spo2", target: 1 }],
          },
        ],
      },
    };
    expect(authoredScenarioSchema.safeParse(broken).success).toBe(false);
  });
});
