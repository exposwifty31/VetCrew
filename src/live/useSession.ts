import { useEffect, useRef, useState } from "react";

import {
  LIVE_EVENTS,
  sessionRejectSchema,
  sessionSnapshotSchema,
  type ClientIntent,
  type RoleViewWire,
  type SessionReject,
} from "@vetcrew/shared";
import { io, type Socket } from "socket.io-client";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "offline";

export type UseSessionResult = {
  readonly roleView: RoleViewWire | null;
  readonly connectionStatus: ConnectionStatus;
  readonly lastReject: SessionReject | null;
  readonly sendIntent: (intent: ClientIntent) => void;
};

/**
 * Thin live client: connection FSM + RoleView from server snapshots only.
 * Never reduces engine state locally (CLAUDE.md §4 / architecture doctrine).
 */
export function useSession(sessionId: string, actorId = "dev-trainee"): UseSessionResult {
  const [roleView, setRoleView] = useState<RoleViewWire | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [lastReject, setLastReject] = useState<SessionReject | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastSeqRef = useRef(0);

  useEffect(() => {
    setRoleView(null);
    setConnectionStatus("connecting");
    lastSeqRef.current = 0;

    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = socket;

    const join = () => {
      socket.emit(
        LIVE_EVENTS.join,
        {
          sessionId,
          role: "technician",
          lastSeq: lastSeqRef.current,
          actorId,
        },
        () => {
          /* ack handled via snapshot */
        },
      );
    };

    socket.on("connect", () => {
      setConnectionStatus("connecting");
      join();
    });
    socket.on("disconnect", () => {
      setConnectionStatus("reconnecting");
      // Doctrine: do not act on stale vitals — clear the live view.
      setRoleView(null);
    });
    socket.io.on("reconnect_attempt", () => {
      setConnectionStatus("reconnecting");
      setRoleView(null);
    });
    socket.on(LIVE_EVENTS.snapshot, (raw: unknown) => {
      const parsed = sessionSnapshotSchema.safeParse(raw);
      if (!parsed.success) return;
      lastSeqRef.current = parsed.data.seq;
      setRoleView(parsed.data.roleView);
      setConnectionStatus("connected");
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
    socket.emit(LIVE_EVENTS.intent, intent);
  };

  return { roleView, connectionStatus, lastReject, sendIntent };
}
