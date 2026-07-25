import type { Server as HttpServer } from "node:http";

import type { EngineEventBody } from "@vetcrew/shared";
import {
  LIVE_EVENTS,
  instructorViewWireSchema,
  parseClientIntent,
  roleViewWireSchema,
  sessionJoinSchema,
  type ClientIntent,
  type SessionPresence,
  type SessionSnapshot,
  type StationKind,
} from "@vetcrew/shared";
import { Server, type Socket } from "socket.io";

import type { RoomRegistry } from "./room-registry.js";
import type { SessionRoom } from "./session-room.js";

/** Trainee station target under memo Option (a). */
export const STATION_SCENARIO_SLUG = "base-rung-stepped-tasks";
/** Instructor inject-demo scenario (menu has injections). */
export const INSTRUCTOR_DEMO_SCENARIO_SLUG = "base-rung-resp-distress";

const TRAINEE_SCENARIOS = new Set([STATION_SCENARIO_SLUG, INSTRUCTOR_DEMO_SCENARIO_SLUG]);
const INSTRUCTOR_SCENARIOS = new Set([STATION_SCENARIO_SLUG, INSTRUCTOR_DEMO_SCENARIO_SLUG]);

type SocketBinding = {
  readonly sessionId: string;
  readonly role: string;
  readonly actorId: string;
  readonly tenantId: string;
  readonly stationKind: StationKind;
};

type SocketData = {
  binding?: SocketBinding;
  unsubSnapshot?: () => void;
  unsubPresence?: () => void;
  unsubRoomPresence?: () => void;
};

export type LiveSocketOptions = {
  readonly tenantId: string;
  readonly registry: RoomRegistry;
  /**
   * When true, join is allowed without Clerk (loud console warning).
   * Security veto: not for pitch/pilot until role_stations binding ships.
   */
  readonly allowDevBypass: boolean;
};

function socketRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

function toBody(intent: ClientIntent, binding: SocketBinding): EngineEventBody {
  switch (intent.type) {
    case "phase_change":
      return { type: "phase_change", phase: intent.phase };
    case "action":
      return {
        type: "action",
        role: binding.role,
        actorId: binding.actorId,
        action: intent.action,
        payload: intent.payload,
      };
    case "task_start":
      return {
        type: "task_start",
        role: binding.role,
        actorId: binding.actorId,
        taskId: intent.taskId,
      };
    case "task_submit":
      return {
        type: "task_submit",
        role: binding.role,
        actorId: binding.actorId,
        taskId: intent.taskId,
        submission: intent.submission,
      };
    case "injection":
      return { type: "injection", injection: intent.injection };
    default: {
      const exhaustive: never = intent;
      throw new Error(`Unhandled intent: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function emitTraineeSnapshot(socket: Socket, room: SessionRoom, role: string): void {
  const view = room.project(role);
  const parsed = roleViewWireSchema.safeParse(view);
  if (!parsed.success) {
    socket.emit(LIVE_EVENTS.reject, {
      code: "validation",
      message: "role view failed wire validation",
    });
    return;
  }
  const frame: SessionSnapshot = { kind: "trainee", seq: view.seq, roleView: parsed.data };
  socket.emit(LIVE_EVENTS.snapshot, frame);
}

function emitInstructorSnapshot(socket: Socket, room: SessionRoom): void {
  const view = room.projectInstructor();
  const parsed = instructorViewWireSchema.safeParse(view);
  if (!parsed.success) {
    socket.emit(LIVE_EVENTS.reject, {
      code: "validation",
      message: "instructor view failed wire validation",
    });
    return;
  }
  const frame: SessionSnapshot = {
    kind: "instructor",
    seq: view.seq,
    instructorView: parsed.data,
  };
  socket.emit(LIVE_EVENTS.snapshot, frame);
}

function emitPresence(socket: Socket, sessionId: string, room: SessionRoom): void {
  const payload: SessionPresence = {
    sessionId,
    connected: room.listPresence(),
  };
  socket.emit(LIVE_EVENTS.presence, payload);
}

function authorizeIntent(
  binding: SocketBinding,
  intent: ClientIntent,
  room: SessionRoom,
): { ok: true } | { ok: false; code: "role_bound" | "validation"; message: string } {
  if (binding.stationKind === "instructor") {
    if (intent.type === "task_start" || intent.type === "task_submit" || intent.type === "action") {
      return { ok: false, code: "role_bound", message: "instructor cannot send trainee intents" };
    }
    if (intent.type === "injection") {
      const allowed = room.injectionMenuIds();
      if (!allowed.includes(intent.injection)) {
        return {
          ok: false,
          code: "validation",
          message: `injection "${intent.injection}" is not on this scenario menu`,
        };
      }
    }
    return { ok: true };
  }
  // Trainee path
  if (intent.type === "injection" || intent.type === "phase_change") {
    return {
      ok: false,
      code: "role_bound",
      message: "trainee cannot inject or change session phase",
    };
  }
  return { ok: true };
}

export function attachLiveSocket(httpServer: HttpServer, options: LiveSocketOptions): Server {
  if (options.allowDevBypass) {
    console.warn(
      "[vetcrew] LIVE JOIN DEV BYPASS ENABLED — Security veto: not for pitch/pilot. Bind Clerk → role_stations before shipping live join.",
    );
  }

  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
    path: "/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    const data = socket.data as SocketData;

    socket.on(LIVE_EVENTS.join, async (raw: unknown, ack?: (result: unknown) => void) => {
      const parsed = sessionJoinSchema.safeParse(raw);
      if (!parsed.success) {
        const reject = { code: "validation" as const, message: "invalid join payload" };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
        return;
      }
      if (!options.allowDevBypass) {
        const reject = {
          code: "auth" as const,
          message: "live join requires authenticated role binding (not yet enabled)",
        };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
        return;
      }

      // Clear prior membership if re-joining.
      data.unsubSnapshot?.();
      data.unsubPresence?.();
      data.unsubRoomPresence?.();

      const { sessionId, role, lastSeq, actorId, stationKind } = parsed.data;
      if (stationKind === "instructor" && role !== "instructor") {
        const reject = {
          code: "role_bound" as const,
          message: 'instructor join requires role "instructor"',
        };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
        return;
      }

      const room = await options.registry.getOrCreate(options.tenantId, sessionId);
      if (room === null) {
        const reject = { code: "not_found" as const, message: "session not found" };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
        return;
      }

      if (stationKind === "trainee") {
        if (!TRAINEE_SCENARIOS.has(room.scenarioSlug)) {
          const reject = {
            code: "scenario" as const,
            message: `trainee join not allowed for scenario ${room.scenarioSlug}`,
          };
          socket.emit(LIVE_EVENTS.reject, reject);
          ack?.(reject);
          return;
        }
        const roles = room.scenarioRoles;
        if (roles.length > 0 && !roles.includes(role)) {
          const reject = {
            code: "role_bound" as const,
            message: `role "${role}" is not in scenario roles`,
          };
          socket.emit(LIVE_EVENTS.reject, reject);
          ack?.(reject);
          return;
        }
      } else if (!INSTRUCTOR_SCENARIOS.has(room.scenarioSlug)) {
        const reject = {
          code: "scenario" as const,
          message: `instructor join not allowed for scenario ${room.scenarioSlug}`,
        };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
        return;
      }

      const binding: SocketBinding = {
        sessionId,
        role,
        actorId: actorId ?? (stationKind === "instructor" ? "dev-instructor" : "dev-trainee"),
        tenantId: options.tenantId,
        stationKind,
      };
      data.binding = binding;
      await socket.join(socketRoom(sessionId));

      data.unsubRoomPresence = room.registerPresence({
        socketId: socket.id,
        role,
        stationKind,
        actorId: binding.actorId,
      });
      data.unsubPresence = room.onPresence((members) => {
        const payload: SessionPresence = { sessionId, connected: [...members] };
        socket.emit(LIVE_EVENTS.presence, payload);
      });
      data.unsubSnapshot = room.onSnapshot(stationKind, role, (frame) => {
        if (frame.kind === "instructor") {
          const wire = instructorViewWireSchema.safeParse(frame.instructorView);
          if (!wire.success) return;
          socket.emit(LIVE_EVENTS.snapshot, {
            kind: "instructor",
            seq: frame.instructorView.seq,
            instructorView: wire.data,
          } satisfies SessionSnapshot);
          return;
        }
        const wire = roleViewWireSchema.safeParse(frame.roleView);
        if (!wire.success) return;
        socket.emit(LIVE_EVENTS.snapshot, {
          kind: "trainee",
          seq: frame.roleView.seq,
          roleView: wire.data,
        } satisfies SessionSnapshot);
      });

      socket.once("disconnect", () => {
        data.unsubSnapshot?.();
        data.unsubPresence?.();
        data.unsubRoomPresence?.();
      });

      if (stationKind === "instructor") {
        emitInstructorSnapshot(socket, room);
      } else {
        emitTraineeSnapshot(socket, room, role);
      }
      emitPresence(socket, sessionId, room);
      // Catch-up events are optional; snapshot alone is correctness.
      if (lastSeq !== undefined && lastSeq < room.appliedSeq) {
        // Intentionally empty: client replaces view from snapshot.
      }
      socket.emit(LIVE_EVENTS.connection, { status: "connected" });
      ack?.({ ok: true, seq: room.appliedSeq, stationKind });
    });

    socket.on(LIVE_EVENTS.intent, async (raw: unknown, ack?: (result: unknown) => void) => {
      const binding = data.binding;
      if (binding === undefined) {
        const reject = { code: "auth" as const, message: "join before sending intents" };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
        return;
      }
      const parsed = parseClientIntent(raw);
      if (!parsed.success) {
        const reject = { code: "validation" as const, message: parsed.error };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
        return;
      }

      const room = options.registry.get(binding.sessionId);
      if (room === undefined) {
        const reject = { code: "not_found" as const, message: "live room not loaded" };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
        return;
      }

      const authz = authorizeIntent(binding, parsed.data, room);
      if (!authz.ok) {
        const reject = { code: authz.code, message: authz.message };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
        return;
      }

      try {
        const body = toBody(parsed.data, binding);
        const result = await room.applyIntent([body]);
        ack?.({ ok: true, seq: result.events.at(-1)?.seq ?? room.appliedSeq });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "intent failed";
        const reject = { code: "fsm" as const, message };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
      }
    });

    socket.on(LIVE_EVENTS.leave, async () => {
      const binding = data.binding;
      if (binding === undefined) return;
      data.unsubSnapshot?.();
      data.unsubPresence?.();
      data.unsubRoomPresence?.();
      await socket.leave(socketRoom(binding.sessionId));
      delete data.binding;
      socket.emit(LIVE_EVENTS.connection, { status: "closed" });
    });
  });

  return io;
}
