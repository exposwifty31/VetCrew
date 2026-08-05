import {
  createInitialState,
  instructorView,
  reduce,
  replay,
  roleView,
  type EngineEvent,
  type EngineState,
  type InstructorView,
  type RoleView,
  type ScenarioDef,
  type SessionPhase,
} from "@vetcrew/engine";
import type { EngineEventBody, ScenarioMode, StationKind } from "@vetcrew/shared";

import type { Db } from "../db/client.js";
import { appendSessionEvents } from "./event-append.js";

const TICK_MS = 1000;

export type PresenceMember = {
  readonly role: string;
  readonly stationKind: StationKind;
  readonly actorId: string;
  readonly status: "connected";
};

export type SnapshotFrame =
  | { readonly kind: "trainee"; readonly role: string; readonly roleView: RoleView }
  | { readonly kind: "instructor"; readonly instructorView: InstructorView };

export type SnapshotListener = (frame: SnapshotFrame) => void;
export type PresenceListener = (members: readonly PresenceMember[]) => void;

type BoundListener =
  | { readonly kind: "trainee"; readonly role: string; readonly listener: SnapshotListener }
  | { readonly kind: "instructor"; readonly listener: SnapshotListener };

/**
 * One in-memory authoritative engine per live session. The tick loop lives
 * HERE (outside the reducer) — time enters state only as persisted tick
 * events. Hydration is always `replay()` from the Postgres log.
 */
export class SessionRoom {
  private state: EngineState;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<BoundListener>();
  private readonly presenceListeners = new Set<PresenceListener>();
  private readonly presence = new Map<string, PresenceMember>();
  /** Serialize append+reduce so tick and trainee intents cannot interleave mid-batch. */
  private chain: Promise<unknown> = Promise.resolve();

  private constructor(
    private readonly db: Db,
    private readonly tenantId: string,
    private readonly sessionId: string,
    private readonly scenario: ScenarioDef,
    /**
     * The session's FROZEN mode, not the live scenario's — see
     * `server/mode-policy.ts`. Deliberately held on the room rather than in
     * `EngineState`: content metadata must never be able to alter replay (D3).
     */
    readonly mode: ScenarioMode,
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
    readonly mode: ScenarioMode;
    readonly events: readonly EngineEvent[];
  }): SessionRoom {
    const room = new SessionRoom(
      args.db,
      args.tenantId,
      args.sessionId,
      args.scenario,
      args.mode,
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

  get scenarioRoles(): readonly string[] {
    return this.scenario.roles ?? [];
  }

  injectionMenuIds(): readonly string[] {
    return (this.scenario.injections ?? []).map((item) => item.id);
  }

  getState(): EngineState {
    return this.state;
  }

  project(role: string): RoleView {
    return roleView(this.state, role);
  }

  projectInstructor(): InstructorView {
    return instructorView(this.state);
  }

  onSnapshot(
    stationKind: StationKind,
    role: string,
    listener: SnapshotListener,
  ): () => void {
    const bound: BoundListener =
      stationKind === "instructor"
        ? { kind: "instructor", listener }
        : { kind: "trainee", role, listener };
    this.listeners.add(bound);
    return () => {
      this.listeners.delete(bound);
    };
  }

  onPresence(listener: PresenceListener): () => void {
    this.presenceListeners.add(listener);
    return () => {
      this.presenceListeners.delete(listener);
    };
  }

  registerPresence(args: {
    readonly socketId: string;
    readonly role: string;
    readonly stationKind: StationKind;
    readonly actorId: string;
  }): () => void {
    this.presence.set(args.socketId, {
      role: args.role,
      stationKind: args.stationKind,
      actorId: args.actorId,
      status: "connected",
    });
    this.emitPresence();
    return () => {
      this.presence.delete(args.socketId);
      this.emitPresence();
    };
  }

  listPresence(): PresenceMember[] {
    return [...this.presence.values()];
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
        // Everything reaching this method is either a client intent or a tick,
        // and ticks are neither a phase change nor an injection — so the mode
        // policy costs them nothing and re-checks intents under the row lock.
        // `authorizeIntent` already refused these at the socket; this is the
        // backstop for two server instances racing on the same session.
        clientOriginated: true,
      });
      if (result.kind === "not_found") {
        throw new Error(`session ${this.sessionId} vanished under the room`);
      }
      if (result.kind === "refused") {
        throw new Error(result.reason);
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
    this.presenceListeners.clear();
    this.presence.clear();
  }

  private emitPresence(): void {
    const members = this.listPresence();
    for (const listener of this.presenceListeners) {
      listener(members);
    }
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
    for (const bound of this.listeners) {
      if (bound.kind === "instructor") {
        bound.listener({ kind: "instructor", instructorView: this.projectInstructor() });
      } else {
        bound.listener({
          kind: "trainee",
          role: bound.role,
          roleView: this.project(bound.role),
        });
      }
    }
  }
}
