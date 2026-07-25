import { replay, type EngineEvent, type ScenarioDef } from "@vetcrew/engine";
import { authoredScenarioSchema, engineEventSchema } from "@vetcrew/shared";
import { and, asc, eq } from "drizzle-orm";

import type { Db } from "../db/client.js";
import { scenarios, sessionEvents, simSessions } from "../db/schema/index.js";
import { compileScenario } from "../scenarios.js";
import { SessionRoom } from "./session-room.js";

/**
 * One SessionRoom per active sessionId. Cold getOrCreate hydrates via
 * replay() from the durable event log — process restart never invents state.
 */
export class RoomRegistry {
  private readonly rooms = new Map<string, SessionRoom>();

  constructor(private readonly db: Db) {}

  async getOrCreate(tenantId: string, sessionId: string): Promise<SessionRoom | null> {
    const existing = this.rooms.get(sessionId);
    if (existing !== undefined) return existing;

    const sessionRows = await this.db
      .select()
      .from(simSessions)
      .where(and(eq(simSessions.tenantId, tenantId), eq(simSessions.id, sessionId)));
    const session = sessionRows[0];
    if (session === undefined) return null;

    const scenarioRows = await this.db
      .select()
      .from(scenarios)
      .where(eq(scenarios.id, session.scenarioId));
    const scenarioRow = scenarioRows[0];
    if (scenarioRow === undefined) {
      throw new Error(`session ${sessionId} references missing scenario`);
    }
    const authored = authoredScenarioSchema.parse(scenarioRow.definition);
    const scenario: ScenarioDef = compileScenario(authored);

    const eventRows = await this.db
      .select({ payload: sessionEvents.payload })
      .from(sessionEvents)
      .where(eq(sessionEvents.sessionId, sessionId))
      .orderBy(asc(sessionEvents.seq));
    const events: EngineEvent[] = eventRows.map((row) => engineEventSchema.parse(row.payload));

    // Sanity: replay must agree with itself (determinism).
    if (events.length > 0) {
      replay(session.seed, events, scenario);
    }

    const room = SessionRoom.hydrate({
      db: this.db,
      tenantId,
      sessionId,
      seed: session.seed,
      scenario,
      events,
    });
    this.rooms.set(sessionId, room);
    return room;
  }

  get(sessionId: string): SessionRoom | undefined {
    return this.rooms.get(sessionId);
  }

  dispose(sessionId: string): void {
    const room = this.rooms.get(sessionId);
    if (room === undefined) return;
    room.dispose();
    this.rooms.delete(sessionId);
  }

  disposeAll(): void {
    for (const id of [...this.rooms.keys()]) {
      this.dispose(id);
    }
  }
}
