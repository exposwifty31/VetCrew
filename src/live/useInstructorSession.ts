import { useEffect, useRef, useState } from "react";

import {
  LIVE_EVENTS,
  sessionPresenceSchema,
  sessionRejectSchema,
  sessionSnapshotSchema,
  type ClientIntent,
  type InstructorViewWire,
  type SessionPresence,
  type SessionReject,
} from "@vetcrew/shared";
import { io, type Socket } from "socket.io-client";

import type { ConnectionStatus } from "./useSession.js";

export type UseInstructorSessionResult = {
  readonly instructorView: InstructorViewWire | null;
  readonly presence: SessionPresence["connected"];
  readonly connectionStatus: ConnectionStatus;
  readonly lastReject: SessionReject | null;
  readonly sendIntent: (intent: ClientIntent) => void;
};

/** Thin instructor live client — renders instructorView only, never RoleView. */
export function useInstructorSession(
  sessionId: string,
  actorId = "dev-instructor",
): UseInstructorSessionResult {
  const [instructorView, setInstructorView] = useState<InstructorViewWire | null>(null);
  const [presence, setPresence] = useState<SessionPresence["connected"]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [lastReject, setLastReject] = useState<SessionReject | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    setInstructorView(null);
    setPresence([]);
    setConnectionStatus("connecting");
    lastSeqRef.current = 0;

    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    const join = () => {
      socket.emit(LIVE_EVENTS.join, {
        sessionId,
        stationKind: "instructor",
        role: "instructor",
        lastSeq: lastSeqRef.current,
        actorId,
      });
    };

    socket.on("connect", () => {
      setConnectionStatus("connecting");
      join();
    });
    socket.on("disconnect", () => {
      setConnectionStatus("reconnecting");
      setInstructorView(null);
    });
    socket.io.on("reconnect_attempt", () => {
      setConnectionStatus("reconnecting");
      setInstructorView(null);
    });
    socket.on(LIVE_EVENTS.snapshot, (raw: unknown) => {
      const parsed = sessionSnapshotSchema.safeParse(raw);
      if (!parsed.success || parsed.data.kind !== "instructor") return;
      lastSeqRef.current = parsed.data.seq;
      setInstructorView(parsed.data.instructorView);
      setConnectionStatus("connected");
    });
    socket.on(LIVE_EVENTS.presence, (raw: unknown) => {
      const parsed = sessionPresenceSchema.safeParse(raw);
      if (parsed.success) setPresence(parsed.data.connected);
    });
    socket.on(LIVE_EVENTS.reject, (raw: unknown) => {
      const parsed = sessionRejectSchema.safeParse(raw);
      if (parsed.success) setLastReject(parsed.data);
    });
    socket.on(LIVE_EVENTS.connection, (raw: unknown) => {
      if (
        raw !== null &&
        typeof raw === "object" &&
        "status" in raw &&
        (raw as { status: string }).status === "closed"
      ) {
        setConnectionStatus("offline");
      }
    });

    return () => {
      socket.emit(LIVE_EVENTS.leave, {});
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, actorId]);

  const sendIntent = (intent: ClientIntent) => {
    const socket = socketRef.current;
    if (socket === null || !socket.connected) return;
    if (connectionStatus !== "connected") return;
    if (intent.type === "task_start" || intent.type === "task_submit" || intent.type === "action") {
      return;
    }
    socket.emit(LIVE_EVENTS.intent, intent);
  };

  return { instructorView, presence, connectionStatus, lastReject, sendIntent };
}
