import type { CSSProperties } from "react";

import { t, type MessageKey } from "../i18n/index.js";
import type { ConnectionStatus } from "../live/useSession.js";

/**
 * Data-freshness pill ported from design-system ConnectionPill — hatch on
 * reconnecting so stale can never read as live by color alone. Labels go
 * through i18n (Hebrew-first), not the DS hard-coded HE/EN map.
 */

export type PillConnectionState = "live" | "paused" | "offline" | "reconnecting";

type Props = {
  readonly status: ConnectionStatus;
  /** Instructor surfaces may show paused; station maps connecting → reconnecting. */
  readonly paused?: boolean;
  readonly labelPrefix?: "station" | "instructor";
};

function toPillState(status: ConnectionStatus, paused: boolean): PillConnectionState {
  if (paused && status === "connected") return "paused";
  switch (status) {
    case "connected":
      return "live";
    case "reconnecting":
    case "connecting":
      return "reconnecting";
    case "offline":
      return "offline";
    default: {
      const exhaustive: never = status;
      throw new Error(`Unhandled connection status: ${String(exhaustive)}`);
    }
  }
}

function labelKey(
  prefix: "station" | "instructor",
  state: PillConnectionState,
): MessageKey {
  switch (state) {
    case "live":
      return `${prefix}.connection.live`;
    case "reconnecting":
      return `${prefix}.connection.reconnecting`;
    case "offline":
      return `${prefix}.connection.offline`;
    case "paused":
      return "instructor.connection.paused";
    default: {
      const exhaustive: never = state;
      throw new Error(`Unhandled pill state: ${String(exhaustive)}`);
    }
  }
}

/** Token family is `--status-running-*` for live (DS naming). */
function tokenFamily(state: PillConnectionState): string {
  return state === "live" ? "running" : state;
}

function Glyph({ state }: { state: PillConnectionState }) {
  if (state === "live") {
    return <span className="vc-connpill__dot" aria-hidden="true" />;
  }
  if (state === "paused") {
    return (
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
        <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
      </svg>
    );
  }
  if (state === "offline") {
    return (
      <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" stroke="currentColor" strokeWidth="2.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
      <path
        d="M12 3 a9 9 0 1 1-8.5 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ConnectionPill({
  status,
  paused = false,
  labelPrefix = "station",
}: Props) {
  const state = toPillState(status, paused);
  const family = tokenFamily(state);
  const style: CSSProperties = {
    color: `var(--status-${family}-fg, #e8eef5)`,
    background: `var(--status-${family}-fill, rgba(0,128,128,0.25))`,
    borderColor: `color-mix(in srgb, var(--status-${family}-dot, #008080) 55%, transparent)`,
    backgroundImage: state === "reconnecting" ? "var(--stale-hatch)" : undefined,
  };

  return (
    <span
      className={`vc-connpill vc-connpill--${state}`}
      style={style}
      role="status"
      aria-live={state === "reconnecting" ? "assertive" : "polite"}
    >
      <span
        className="vc-connpill__g"
        style={{ color: `var(--status-${family}-dot, currentColor)` }}
      >
        <Glyph state={state} />
      </span>
      <span>{t(labelKey(labelPrefix, state))}</span>
    </span>
  );
}
