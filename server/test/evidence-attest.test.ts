import { describe, expect, test } from "vitest";

import {
  attestEvidenceSeqs,
  eventLogPreimage,
  hashEventLog,
  type EventLogRow,
} from "../evidence-attest.js";

const rows: EventLogRow[] = [
  { seq: 1, type: "phase_change", role: null, actorId: null, payload: { phase: "briefing" } },
  { seq: 2, type: "phase_change", role: null, actorId: null, payload: { phase: "running" } },
  {
    seq: 4,
    type: "action",
    role: "technician",
    actorId: "t1",
    payload: { action: "oxygen_on" },
  },
];

/**
 * Engine seed+event determinism lives in packages/engine/test/determinism.test.ts.
 * This file covers attestation hashing only (preimage + evidence seq checks).
 */
describe("evidence attestation", () => {
  test("hash is stable for the same ordered log", () => {
    const a = hashEventLog(rows);
    const b = hashEventLog(rows);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(eventLogPreimage(rows)).toContain("4|action|technician|t1|");
  });

  test("hash changes when payload changes", () => {
    const mutated: EventLogRow[] = [
      ...rows.slice(0, 2),
      { ...rows[2]!, payload: { action: "oxygen_off" } },
    ];
    expect(hashEventLog(mutated)).not.toBe(hashEventLog(rows));
  });

  test("rejects unknown evidence seqs", () => {
    const result = attestEvidenceSeqs(rows, [4, 999]);
    expect(result).toEqual({ kind: "unknown_evidence", seqs: [999] });
  });

  test("rejects empty evidence list", () => {
    expect(attestEvidenceSeqs(rows, []).kind).toBe("empty_evidence");
  });

  test("ok attestation freezes head seq and hash", () => {
    const result = attestEvidenceSeqs(rows, [4]);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.attestation.logHeadSeq).toBe(4);
    expect(result.attestation.logHeadHash).toBe(hashEventLog(rows));
  });
});
