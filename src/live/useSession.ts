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

export type UseSessionOptions = {
  readonly role?: string;
  /** Dev-bypass only — ignored when the server stamps actorId from auth. */
  readonly actorId?: string;
  readonly getToken?: () => Promise<string | null>;
};

/**
 * Thin trainee live client: connection FSM + RoleView from server snapshots only.
 * Never reduces engine state locally (CLAUDE.md §4 / architecture doctrine).
 * Lifecycle (briefing/running/pause/end) is instructor-owned in Sprint 4.
 */
export function useSession(sessionId: string, options: UseSessionOptions = {}): UseSessionResult {
  const role = options.role ?? "technician";
  const actorId = options.actorId ?? "dev-trainee";
  const getToken = options.getToken;
  const [roleView, setRoleView] = useState<RoleViewWire | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [lastReject, setLastReject] = useState<SessionReject | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastSeqRef = useRef(0);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    setRoleView(null);
    setConnectionStatus("connecting");
    lastSeqRef.current = 0;

    let cancelled = false;
    let socket: Socket | null = null;

    void (async () => {
      const token = getTokenRef.current !== undefined ? await getTokenRef.current() : null;
      if (cancelled) return;

      socket = io({
        path: "/socket.io",
        transports: ["websocket", "polling"],
        reconnection: true,
        auth: token !== null ? { token } : {},
      });
      socketRef.current = socket;

      const join = () => {
        socket?.emit(LIVE_EVENTS.join, {
          sessionId,
          stationKind: "trainee",
          role,
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
        setRoleView(null);
      });
      socket.io.on("reconnect_attempt", () => {
        setConnectionStatus("reconnecting");
        setRoleView(null);
      });
      socket.on(LIVE_EVENTS.snapshot, (raw: unknown) => {
        const parsed = sessionSnapshotSchema.safeParse(raw);
        if (!parsed.success || parsed.data.kind !== "trainee") return;
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
    })();

    return () => {
      cancelled = true;
      socket?.emit(LIVE_EVENTS.leave, {});
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, role, actorId, getToken]);

  const sendIntent = (intent: ClientIntent) => {
    const socket = socketRef.current;
    if (socket === null || !socket.connected) return;
    if (connectionStatus !== "connected") return;
    if (intent.type === "phase_change" || intent.type === "injection") return;
    socket.emit(LIVE_EVENTS.intent, intent);
  };

  return { roleView, connectionStatus, lastReject, sendIntent };
}
