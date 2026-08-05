import { canTransition, type EngineEvent, type SessionPhase } from "@vetcrew/engine";
import { scenarioModeSchema, type EngineEventBody } from "@vetcrew/shared";
import { and, desc, eq } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { sessionEvents, simSessions } from "../db/schema/index.js";
import { refuseClientPhaseChange, refuseInjection } from "../mode-policy.js";

export type AppendOutcome =
  | { kind: "not_found" }
  | { kind: "refused"; reason: string }
  | { kind: "ok"; events: EngineEvent[]; phase: SessionPhase };

/**
 * Mode policy for CLIENT-originated bodies, evaluated against the session row
 * this transaction has already locked.
 *
 * It has to run here rather than in the route: a check done before the
 * `FOR UPDATE` read is a time-of-check/time-of-use race. A concurrent append
 * could move an assessment from `running` to `debrief` in between, and a
 * stale-phase check would then wave through the `archived` that the debrief
 * rule exists to refuse — letting a bad run exit unscored, which is precisely
 * the burial the rule prevents.
 *
 * Server-originated appends (the ratings route's `scored`) pass
 * `clientOriginated: false` and bypass this, since `scored` is exactly what no
 * client may assert.
 */
function refuseClientBodies(
  session: { readonly phase: string; readonly mode: string },
  bodies: readonly EngineEventBody[],
): string | null {
  const mode = scenarioModeSchema.parse(session.mode);
  let phase = session.phase as SessionPhase;
  for (const body of bodies) {
    if (body.type === "injection") {
      const refusal = refuseInjection(mode);
      if (refusal !== null) return refusal;
      continue;
    }
    if (body.type !== "phase_change") continue;
    const refusal = refuseClientPhaseChange(mode, phase, body.phase);
    if (refusal !== null) return refusal;
    if (canTransition(phase, body.phase)) phase = body.phase;
  }
  return null;
}

/** Drizzle transaction handle — same query surface the append path needs. */
export type AppendTx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function projectPhase(from: SessionPhase, events: readonly EngineEvent[]): SessionPhase {
  let phase = from;
  for (const event of events) {
    if (event.type === "phase_change" && canTransition(phase, event.phase)) {
      phase = event.phase;
    }
  }
  return phase;
}

/**
 * Sole sequencing authority for a session's event log (inside an open TX).
 * Locks the session row, assigns contiguous seqs, inserts, projects phase.
 */
export async function appendSessionEventsTx(
  tx: AppendTx,
  args: {
    readonly tenantId: string;
    readonly sessionId: string;
    readonly bodies: readonly EngineEventBody[];
    /** True when a client asked for these bodies — see `refuseClientBodies`. */
    readonly clientOriginated?: boolean;
  },
): Promise<AppendOutcome> {
  if (args.bodies.length === 0) {
    throw new Error("appendSessionEvents: empty body list");
  }
  const rows = await tx
    .select()
    .from(simSessions)
    .where(and(eq(simSessions.tenantId, args.tenantId), eq(simSessions.id, args.sessionId)))
    .for("update");
  const session = rows[0];
  if (session === undefined) return { kind: "not_found" };

  if (args.clientOriginated === true) {
    const refusal = refuseClientBodies(session, args.bodies);
    if (refusal !== null) return { kind: "refused", reason: refusal };
  }

  const maxRows = await tx
    .select({ seq: sessionEvents.seq })
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, session.id))
    .orderBy(desc(sessionEvents.seq))
    .limit(1);
  let nextSeq = (maxRows[0]?.seq ?? 0) + 1;

  const events: EngineEvent[] = args.bodies.map((body) => {
    const event = { ...body, seq: nextSeq } as EngineEvent;
    nextSeq += 1;
    return event;
  });

  const nextPhase = projectPhase(session.phase as SessionPhase, events);
  await tx.insert(sessionEvents).values(
    events.map((event) => ({
      tenantId: args.tenantId,
      sessionId: session.id,
      seq: event.seq,
      type: event.type,
      role:
        event.type === "action" || event.type === "task_start" || event.type === "task_submit"
          ? event.role
          : null,
      actorId:
        event.type === "action" || event.type === "task_start" || event.type === "task_submit"
          ? event.actorId
          : null,
      payload: event,
    })),
  );
  if (nextPhase !== session.phase) {
    await tx.update(simSessions).set({ phase: nextPhase }).where(eq(simSessions.id, session.id));
  }
  return { kind: "ok", events, phase: nextPhase };
}

/**
 * Sole sequencing authority for a session's event log. REST and the live
 * room both call this; nothing else may INSERT into vc_session_events.
 */
export async function appendSessionEvents(
  db: Db,
  args: {
    readonly tenantId: string;
    readonly sessionId: string;
    readonly bodies: readonly EngineEventBody[];
    readonly clientOriginated?: boolean;
  },
): Promise<AppendOutcome> {
  return db.transaction(async (tx) => appendSessionEventsTx(tx, args));
}
