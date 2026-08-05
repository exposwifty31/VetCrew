import { describe, expect, test } from "vitest";

import { isScorable, refuseClientPhaseChange, refuseInjection } from "../mode-policy.js";

describe("assessment withholds capability, it does not ask for restraint", () => {
  test("the examiner cannot pause", () => {
    expect(refuseClientPhaseChange("assessment", "running", "paused")).toContain("cannot be paused");
  });

  test("the examiner cannot inject", () => {
    expect(refuseInjection("assessment")).toContain("pre-set");
  });

  test("an assessment cannot be archived straight out of debrief", () => {
    // Otherwise widening the FSM so practice has a terminal state would hand
    // assessment a burial mechanism: a run going badly could exit unscored.
    expect(refuseClientPhaseChange("assessment", "debrief", "archived")).toContain(
      "must be scored before it is archived",
    );
  });

  test("but the ordinary assessment path is untouched", () => {
    for (const [from, to] of [
      ["draft", "briefing"],
      ["briefing", "running"],
      ["running", "debrief"],
      ["scored", "archived"],
    ] as const) {
      expect(refuseClientPhaseChange("assessment", from, to)).toBeNull();
    }
  });
});

describe("practice and tutorial keep the instructor's hands free", () => {
  for (const mode of ["practice", "tutorial"] as const) {
    test(`${mode} may pause and inject`, () => {
      expect(refuseClientPhaseChange(mode, "running", "paused")).toBeNull();
      expect(refuseInjection(mode)).toBeNull();
    });

    test(`${mode} may archive from debrief — it is the only terminal state it has`, () => {
      expect(refuseClientPhaseChange(mode, "debrief", "archived")).toBeNull();
    });

    test(`${mode} never reaches scored`, () => {
      expect(refuseClientPhaseChange(mode, "debrief", "scored")).toContain("never reaches scored");
      expect(isScorable(mode)).toBe(false);
    });
  }
});

describe("scored is server-derived in every mode", () => {
  test("no client may assert it, assessment included", () => {
    expect(refuseClientPhaseChange("assessment", "debrief", "scored")).toContain(
      "set by the server",
    );
  });

  test("only assessment is scorable at all", () => {
    expect(isScorable("assessment")).toBe(true);
  });
});
