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

export type UseInstructorSessionOptions = {
  /** Dev-bypass only — ignored when the server stamps actorId from auth. */
  readonly actorId?: string;
  readonly getToken?: () => Promise<string | null>;
};

/** Thin instructor live client — renders instructorView only, never RoleView. */
export function useInstructorSession(
  sessionId: string,
  options: UseInstructorSessionOptions = {},
): UseInstructorSessionResult {
  const actorId = options.actorId ?? "dev-instructor";
  const getToken = options.getToken;
  const [instructorView, setInstructorView] = useState<InstructorViewWire | null>(null);
  const [presence, setPresence] = useState<SessionPresence["connected"]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [lastReject, setLastReject] = useState<SessionReject | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastSeqRef = useRef(0);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  useEffect(() => {
    setInstructorView(null);
    setPresence([]);
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
    })();

    return () => {
      cancelled = true;
      socket?.emit(LIVE_EVENTS.leave, {});
      socket?.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, actorId, getToken]);

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
