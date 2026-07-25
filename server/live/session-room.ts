import {
  createInitialState,
  reduce,
  replay,
  roleView,
  type EngineEvent,
  type EngineState,
  type RoleView,
  type ScenarioDef,
  type SessionPhase,
} from "@vetcrew/engine";
import type { EngineEventBody } from "@vetcrew/shared";

import type { Db } from "../db/client.js";
import { appendSessionEvents } from "./event-append.js";

const TICK_MS = 1000;

type SnapshotFrame = {
  readonly role: string;
  readonly roleView: RoleView;
};

export type SnapshotListener = (frame: SnapshotFrame) => void;

type BoundListener = {
  readonly role: string;
  readonly listener: SnapshotListener;
};

/**
 * One in-memory authoritative engine per live session. The tick loop lives
 * HERE (outside the reducer) — time enters state only as persisted tick
 * events. Hydration is always `replay()` from the Postgres log.
 */
export class SessionRoom {
  private state: EngineState;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<BoundListener>();
  /** Serialize append+reduce so tick and trainee intents cannot interleave mid-batch. */
  private chain: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly db: Db,
    private readonly tenantId: string,
    private readonly sessionId: string,
    private readonly scenario: ScenarioDef,
    seed: number,
    events: readonly EngineEvent[],
  ) {
    this.state =
      events.length === 0
        ? createInitialState(seed, scenario)
        : replay(seed, events, scenario);
  }

  static hydrate(args: {
    readonly db: Db;
    readonly tenantId: string;
    readonly sessionId: string;
    readonly seed: number;
    readonly scenario: ScenarioDef;
    readonly events: readonly EngineEvent[];
  }): SessionRoom {
    const room = new SessionRoom(
      args.db,
      args.tenantId,
      args.sessionId,
      args.scenario,
      args.seed,
      args.events,
    );
    room.syncTickLoop();
    return room;
  }

  get phase(): SessionPhase {
    return this.state.phase;
  }

  get appliedSeq(): number {
    return this.state.appliedSeq;
  }

  get scenarioSlug(): string {
    return this.scenario.slug;
  }

  getState(): EngineState {
    return this.state;
  }

  project(role: string): RoleView {
    return roleView(this.state, role);
  }

  onSnapshot(role: string, listener: SnapshotListener): () => void {
    const bound: BoundListener = { role, listener };
    this.listeners.add(bound);
    return () => {
      this.listeners.delete(bound);
    };
  }

  /** Apply client/instructor intents (no seq). Persists then reduces. */
  applyIntent(bodies: readonly EngineEventBody[]): Promise<{
    readonly events: EngineEvent[];
    readonly phase: SessionPhase;
  }> {
    const run = async () => {
      const result = await appendSessionEvents(this.db, {
        tenantId: this.tenantId,
        sessionId: this.sessionId,
        bodies,
      });
      if (result.kind === "not_found") {
        throw new Error(`session ${this.sessionId} vanished under the room`);
      }
      for (const event of result.events) {
        this.state = reduce(this.state, event);
      }
      this.syncTickLoop();
      this.broadcast();
      return { events: result.events, phase: result.phase };
    };
    const pending = this.chain.then(run, run);
    this.chain = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }

  dispose(): void {
    this.stopTick();
    this.listeners.clear();
  }

  private syncTickLoop(): void {
    if (this.state.phase === "running") {
      this.startTick();
    } else {
      this.stopTick();
    }
  }

  private startTick(): void {
    if (this.tickTimer !== null) return;
    this.tickTimer = setInterval(() => {
      void this.applyIntent([{ type: "tick", dtMs: TICK_MS }]).catch((error: unknown) => {
        console.error(`session ${this.sessionId} tick failed:`, error);
        this.stopTick();
      });
    }, TICK_MS);
  }

  private stopTick(): void {
    if (this.tickTimer === null) return;
    clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  private broadcast(): void {
    for (const { role, listener } of this.listeners) {
      listener({ role, roleView: this.project(role) });
    }
  }
}
