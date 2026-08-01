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

/** Human-act event types that may bind an ANTS rating (role + actor required). */
const ROLE_ATTRIBUTED_EVIDENCE_TYPES = new Set(["action", "task_start", "task_submit"]);

export type AttestOutcome =
  | { kind: "ok"; attestation: EvidenceAttestation }
  | { kind: "unknown_evidence"; seqs: number[] }
  | { kind: "non_role_attributed"; seqs: number[] }
  | { kind: "empty_evidence" };

/**
 * Verify every evidence seq exists in the session log, is a role-attributed
 * human act (§2.3 / event taxonomy), and freeze the current head (seq + sha256)
 * for the rating row. Call before appending phase=scored.
 */
export function attestEvidenceSeqs(
  rows: readonly EventLogRow[],
  evidenceSeqs: readonly number[],
): AttestOutcome {
  if (evidenceSeqs.length === 0) {
    return { kind: "empty_evidence" };
  }
  const bySeq = new Map(rows.map((row) => [row.seq, row]));
  const unique = [...new Set(evidenceSeqs)];
  const unknown = unique.filter((seq) => !bySeq.has(seq));
  if (unknown.length > 0) {
    return { kind: "unknown_evidence", seqs: unknown };
  }
  const nonRoleAttributed = unique.filter((seq) => {
    const row = bySeq.get(seq);
    if (row === undefined) return true;
    return (
      !ROLE_ATTRIBUTED_EVIDENCE_TYPES.has(row.type) ||
      row.role === null ||
      row.actorId === null
    );
  });
  if (nonRoleAttributed.length > 0) {
    return { kind: "non_role_attributed", seqs: nonRoleAttributed };
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
