import type { Server as HttpServer } from "node:http";

import type { EngineEventBody } from "@vetcrew/shared";
import {
  LIVE_EVENTS,
  parseClientIntent,
  roleViewWireSchema,
  sessionJoinSchema,
  type ClientIntent,
  type SessionSnapshot,
} from "@vetcrew/shared";
import { Server, type Socket } from "socket.io";

import type { RoomRegistry } from "./room-registry.js";
import type { SessionRoom } from "./session-room.js";

/** Station target under memo Option (a) — join rejects other slugs. */
export const STATION_SCENARIO_SLUG = "base-rung-stepped-tasks";

type SocketBinding = {
  readonly sessionId: string;
  readonly role: string;
  readonly actorId: string;
  readonly tenantId: string;
};

type SocketData = {
  binding?: SocketBinding;
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

function emitSnapshot(socket: Socket, room: SessionRoom, role: string): void {
  const view = room.project(role);
  const parsed = roleViewWireSchema.safeParse(view);
  if (!parsed.success) {
    socket.emit(LIVE_EVENTS.reject, {
      code: "validation",
      message: "role view failed wire validation",
    });
    return;
  }
  const frame: SessionSnapshot = { seq: view.seq, roleView: parsed.data };
  socket.emit(LIVE_EVENTS.snapshot, frame);
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

      const { sessionId, role, lastSeq, actorId } = parsed.data;
      if (role !== "technician") {
        const reject = {
          code: "role_bound" as const,
          message: `Sprint 3 allows only role "technician"; got "${role}"`,
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
      if (room.scenarioSlug !== STATION_SCENARIO_SLUG) {
        const reject = {
          code: "scenario" as const,
          message: `station join is limited to ${STATION_SCENARIO_SLUG}`,
        };
        socket.emit(LIVE_EVENTS.reject, reject);
        ack?.(reject);
        return;
      }

      const binding: SocketBinding = {
        sessionId,
        role,
        actorId: actorId ?? "dev-trainee",
        tenantId: options.tenantId,
      };
      data.binding = binding;
      await socket.join(socketRoom(sessionId));

      const unsub = room.onSnapshot(role, (frame) => {
        const wire = roleViewWireSchema.safeParse(frame.roleView);
        if (!wire.success) return;
        socket.emit(LIVE_EVENTS.snapshot, {
          seq: frame.roleView.seq,
          roleView: wire.data,
        } satisfies SessionSnapshot);
      });
      socket.once("disconnect", () => {
        unsub();
      });

      emitSnapshot(socket, room, role);
      // Catch-up events are optional; snapshot alone is correctness.
      if (lastSeq !== undefined && lastSeq < room.appliedSeq) {
        // Intentionally empty: client replaces view from snapshot.
      }
      socket.emit(LIVE_EVENTS.connection, { status: "connected" });
      ack?.({ ok: true, seq: room.appliedSeq });
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

      // S3 station: reject instructor-only injections from the trainee path.
      if (parsed.data.type === "injection") {
        const reject = {
          code: "role_bound" as const,
          message: "injections are instructor-only",
        };
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
      await socket.leave(socketRoom(binding.sessionId));
      delete data.binding;
      socket.emit(LIVE_EVENTS.connection, { status: "closed" });
    });
  });

  return io;
}
