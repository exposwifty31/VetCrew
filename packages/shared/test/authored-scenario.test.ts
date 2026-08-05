import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { authoredScenarioSchema } from "../src/index.js";

const scenariosDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "scenarios");
const demoPath = join(scenariosDir, "base-rung-resp-distress.json");
const steppedPath = join(scenariosDir, "base-rung-stepped-tasks.json");

describe("authored scenario contract", () => {
  test("the engine-demo deterioration scenario validates", () => {
    const raw: unknown = JSON.parse(readFileSync(demoPath, "utf8"));
    const result = authoredScenarioSchema.safeParse(raw);
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);
  });

  test("Scenario #2 stepped base-rung validates with SA+DM only (Domain Safety)", () => {
    const raw = JSON.parse(readFileSync(steppedPath, "utf8")) as {
      clinicallyReviewed: boolean;
      scoringDimensions: string[];
      tasks: { id: string }[];
    };
    const result = authoredScenarioSchema.safeParse(raw);
    if (!result.success) console.error(result.error.issues);
    expect(result.success).toBe(true);
    expect(raw.clinicallyReviewed).toBe(false);
    expect(raw.scoringDimensions).toEqual(["situation_awareness", "decision_making"]);
    expect(raw.tasks.map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4", "t5", "t6", "t7"]);
  });

  test("unreviewed scenario carries clinically_reviewed=false (internal testing only)", () => {
    const raw = JSON.parse(readFileSync(demoPath, "utf8")) as { clinicallyReviewed: boolean };
    expect(raw.clinicallyReviewed).toBe(false);
  });

  test("rejects checklist rules referencing unknown actions", () => {
    const raw = JSON.parse(readFileSync(demoPath, "utf8")) as Record<string, unknown>;
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

  describe("mode (CLAUDE.md §1.1, D3)", () => {
    function demo(overrides: Record<string, unknown>): Record<string, unknown> {
      const raw = JSON.parse(readFileSync(demoPath, "utf8")) as Record<string, unknown>;
      return { ...raw, ...overrides };
    }

    test("defaults to practice — the locked mode is never reached by omission", () => {
      const raw = demo({});
      delete raw["mode"];
      const result = authoredScenarioSchema.safeParse(raw);
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.mode).toBe("practice");
    });

    test("both shipped scenarios are practice, not assessment", () => {
      for (const path of [demoPath, steppedPath]) {
        const raw = JSON.parse(readFileSync(path, "utf8")) as { mode: string };
        expect(raw.mode).toBe("practice");
      }
    });

    test("an assessment must declare at least 3 ANTS domains", () => {
      // D2 as amended: completion is measured against the DECLARED set, which
      // makes that set load-bearing — a token one or two would let an
      // assessment be "complete" while testing almost nothing.
      const twoDomains = demo({
        mode: "assessment",
        seed: 7,
        scoringDimensions: ["situation_awareness", "decision_making"],
      });
      expect(authoredScenarioSchema.safeParse(twoDomains).success).toBe(false);

      const threeDomains = demo({
        mode: "assessment",
        seed: 7,
        scoringDimensions: ["task_management", "situation_awareness", "decision_making"],
      });
      expect(authoredScenarioSchema.safeParse(threeDomains).success).toBe(true);
    });

    test("an assessment must pin a seed so every candidate faces the same run", () => {
      const noSeed = demo({
        mode: "assessment",
        scoringDimensions: ["task_management", "situation_awareness", "decision_making"],
      });
      expect(authoredScenarioSchema.safeParse(noSeed).success).toBe(false);
    });

    test("practice needs neither a pinned seed nor three domains", () => {
      const practice = demo({ mode: "practice", scoringDimensions: ["decision_making"] });
      expect(authoredScenarioSchema.safeParse(practice).success).toBe(true);
    });
  });

  test("rejects engine triggers keyed off actions outside the verb menu", () => {
    const raw = JSON.parse(readFileSync(demoPath, "utf8")) as {
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
