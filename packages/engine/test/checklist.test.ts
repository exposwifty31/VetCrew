import { describe, expect, test } from "vitest";

import { evaluateChecklist, type ChecklistItemDef, type EngineEvent } from "../src/index.js";

/**
 * Technical checklist evaluation — pure query over the event log.
 * Encodes the two recorded floor-failure anchors (CLAUDE.md §2.7):
 *  - priority inversion: IV access attempted before airway/pulses check
 *  - route error: an SC-only drug given IV
 */

const ITEMS: ChecklistItemDef[] = [
  {
    id: "airway-first",
    label: "Airway/pulses check before IV access",
    weight: 3,
    rule: { kind: "action_before", action: "airway_pulses_check", before: "iv_access_attempt" },
  },
  {
    id: "iv-access",
    label: "IV access attempted",
    weight: 2,
    rule: { kind: "action_performed", action: "iv_access_attempt" },
  },
  {
    id: "no-route-error",
    label: "SC-only drug NOT given IV",
    weight: 3,
    rule: { kind: "action_not_performed", action: "give_drug_iv_wrong_route" },
  },
  {
    id: "fast-oxygen",
    label: "Oxygen within 60s",
    weight: 2,
    rule: { kind: "action_performed", action: "oxygen_on", withinMs: 60_000 },
  },
];

function act(seq: number, action: string): EngineEvent {
  return { seq, type: "action", role: "technician", actorId: "t1", action };
}

function tick(seq: number, dtMs = 10_000): EngineEvent {
  return { seq, type: "tick", dtMs };
}

describe("checklist evaluation", () => {
  test("perfect run passes everything with full score", () => {
    const events: EngineEvent[] = [
      { seq: 1, type: "phase_change", phase: "running" },
      tick(2),
      act(3, "airway_pulses_check"),
      act(4, "oxygen_on"),
      tick(5),
      act(6, "iv_access_attempt"),
    ];
    const result = evaluateChecklist(events, ITEMS);
    expect(result.items.every((item) => item.passed)).toBe(true);
    expect(result.score).toBe(10);
    expect(result.maxScore).toBe(10);
    expect(result.percent).toBe(100);
  });

  test("priority inversion fails airway-first and links the violating events", () => {
    const events: EngineEvent[] = [
      { seq: 1, type: "phase_change", phase: "running" },
      tick(2),
      act(3, "iv_access_attempt"),
      act(4, "airway_pulses_check"),
    ];
    const result = evaluateChecklist(events, ITEMS);
    const airway = result.items.find((item) => item.id === "airway-first");
    expect(airway?.passed).toBe(false);
    expect(airway?.evidenceSeqs).toContain(3);
  });

  test("route error fails and evidence points at the wrong-route action", () => {
    const events: EngineEvent[] = [
      { seq: 1, type: "phase_change", phase: "running" },
      act(2, "airway_pulses_check"),
      act(3, "give_drug_iv_wrong_route"),
    ];
    const result = evaluateChecklist(events, ITEMS);
    const route = result.items.find((item) => item.id === "no-route-error");
    expect(route?.passed).toBe(false);
    expect(route?.evidenceSeqs).toEqual([3]);
  });

  test("withinMs enforces session time from accumulated ticks", () => {
    const late: EngineEvent[] = [
      { seq: 1, type: "phase_change", phase: "running" },
      tick(2, 61_000),
      act(3, "oxygen_on"),
    ];
    const result = evaluateChecklist(late, ITEMS);
    const oxygen = result.items.find((item) => item.id === "fast-oxygen");
    expect(oxygen?.passed).toBe(false);
  });

  test("action_before passes vacuously when the hazard action never occurs", () => {
    const events: EngineEvent[] = [{ seq: 1, type: "phase_change", phase: "running" }];
    const result = evaluateChecklist(events, ITEMS);
    expect(result.items.find((item) => item.id === "airway-first")?.passed).toBe(true);
    expect(result.items.find((item) => item.id === "iv-access")?.passed).toBe(false);
  });

  test("weighted score sums only passed items", () => {
    const events: EngineEvent[] = [
      { seq: 1, type: "phase_change", phase: "running" },
      act(2, "airway_pulses_check"),
      act(3, "oxygen_on"),
      act(4, "give_drug_iv_wrong_route"),
    ];
    const result = evaluateChecklist(events, ITEMS);
    // airway-first (3, vacuous pass) + fast-oxygen (2) pass; iv-access (2) + no-route-error (3) fail
    expect(result.score).toBe(5);
    expect(result.percent).toBe(50);
  });
});
