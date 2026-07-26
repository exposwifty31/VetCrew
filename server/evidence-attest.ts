import { createHash } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import { sessionEvents } from "./db/schema/index.js";
import type { AppendTx } from "./live/event-append.js";

export type EventLogRow = {
  readonly seq: number;
  readonly type: string;
  readonly role: string | null;
  readonly actorId: string | null;
  readonly payload: unknown;
};

export type EvidenceAttestation = {
  readonly logHeadSeq: number;
  readonly logHeadHash: string;
};

/** Canonical preimage — order and fields are part of the attestation contract. */
export function eventLogPreimage(rows: readonly EventLogRow[]): string {
  return rows
    .map((row) => {
      const role = row.role ?? "";
      const actorId = row.actorId ?? "";
      const payload = JSON.stringify(row.payload ?? {});
      return `${row.seq}|${row.type}|${role}|${actorId}|${payload}`;
    })
    .join("\n");
}

export function hashEventLog(rows: readonly EventLogRow[]): string {
  return createHash("sha256").update(eventLogPreimage(rows), "utf8").digest("hex");
}

export type AttestOutcome =
  | { kind: "ok"; attestation: EvidenceAttestation }
  | { kind: "unknown_evidence"; seqs: number[] }
  | { kind: "empty_evidence" };

/**
 * Verify every evidence seq exists in the session log and freeze the current
 * head (seq + sha256) for the rating row. Call before appending phase=scored.
 */
export function attestEvidenceSeqs(
  rows: readonly EventLogRow[],
  evidenceSeqs: readonly number[],
): AttestOutcome {
  if (evidenceSeqs.length === 0) {
    return { kind: "empty_evidence" };
  }
  const bySeq = new Map(rows.map((row) => [row.seq, row]));
  const unknown = [...new Set(evidenceSeqs.filter((seq) => !bySeq.has(seq)))];
  if (unknown.length > 0) {
    return { kind: "unknown_evidence", seqs: unknown };
  }
  const head = rows[rows.length - 1];
  return {
    kind: "ok",
    attestation: {
      logHeadSeq: head?.seq ?? 0,
      logHeadHash: hashEventLog(rows),
    },
  };
}

export async function loadEventLogRows(
  tx: AppendTx,
  sessionId: string,
): Promise<EventLogRow[]> {
  const rows = await tx
    .select({
      seq: sessionEvents.seq,
      type: sessionEvents.type,
      role: sessionEvents.role,
      actorId: sessionEvents.actorId,
      payload: sessionEvents.payload,
    })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(asc(sessionEvents.seq));
  return rows;
}
