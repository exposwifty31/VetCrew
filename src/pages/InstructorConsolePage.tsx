import { useMemo, useState, type CSSProperties } from "react";

import type { InstructorViewWire, SessionPhase } from "@vetcrew/shared";

import { CompactAuthBanner } from "../components/AuthBar.js";
import { ConnectionPill } from "../components/ConnectionPill.js";
import {
  e2eOrNoBearerToken,
  hasClerkPublishableKey,
  useClerkBearerToken,
} from "../hooks/useBearerToken.js";
import { t } from "../i18n";
import { rejectMessageKey } from "../live/rejectMessage.js";
import { useInstructorSession } from "../live/useInstructorSession.js";
import type { ConnectionStatus } from "../live/useSession.js";

/** Cuff BP is NIBP identity colour — never arterial (`--ch-art`). */
const VITAL_META: Record<string, { label: string; cssVar: string; fallback: string }> = {
  hr: { label: "HR", cssVar: "--ch-hr", fallback: "#00FF66" },
  spo2: { label: "SpO₂", cssVar: "--ch-spo2", fallback: "#00CCFF" },
  etco2: { label: "EtCO₂", cssVar: "--ch-etco2", fallback: "#FFFFFF" },
  rr: { label: "RR", cssVar: "--ch-rr", fallback: "#FFCC00" },
  temp: { label: "Temp", cssVar: "--ch-temp", fallback: "#FFFFFF" },
  sys_bp: { label: "SYS", cssVar: "--ch-nibp", fallback: "#FFFFFF" },
  dia_bp: { label: "DIA", cssVar: "--ch-nibp", fallback: "#FFFFFF" },
};

type Props = { readonly sessionId: string };

function formatElapsed(timeMs: number): string {
  const totalSec = Math.floor(timeMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const ss = String(totalSec % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatFiredAt(timeMs: number): string {
  return `T+${formatElapsed(timeMs)}`;
}

export default function InstructorConsolePage({ sessionId }: Props) {
  if (hasClerkPublishableKey) {
    return <InstructorConsolePageWithClerk sessionId={sessionId} />;
  }
  return <InstructorConsolePageBody sessionId={sessionId} getToken={e2eOrNoBearerToken} />;
}

function InstructorConsolePageWithClerk({ sessionId }: Props) {
  const getToken = useClerkBearerToken();
  return <InstructorConsolePageBody sessionId={sessionId} getToken={getToken} />;
}

function InstructorConsolePageBody({
  sessionId,
  getToken,
}: Props & { getToken: () => Promise<string | null> }) {
  const { instructorView, presence, connectionStatus, lastReject, sendIntent } =
    useInstructorSession(sessionId, { getToken });
  const [endOpen, setEndOpen] = useState(false);
  const live = connectionStatus === "connected" && instructorView !== null;
  const phase = instructorView?.phase;
  const paused = phase === "paused";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "var(--instrument-bg, #0A0F18)",
        color: "var(--instrument-fg, #E8EEF5)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-ui, 'IBM Plex Sans Hebrew', sans-serif)",
      }}
    >
      <CommandBar
        sessionId={sessionId}
        phase={phase}
        elapsedLabel={formatElapsed(instructorView?.timeMs ?? 0)}
        scenarioLabel={instructorView?.scenarioSlug ?? "—"}
        disabled={!live || phase === "debrief" || phase === "scored" || phase === "archived"}
        onPause={() => sendIntent({ type: "phase_change", phase: "paused" })}
        onResume={() => sendIntent({ type: "phase_change", phase: "running" })}
        onStartBriefing={() => sendIntent({ type: "phase_change", phase: "briefing" })}
        onStartRun={() => sendIntent({ type: "phase_change", phase: "running" })}
        onRequestEnd={() => setEndOpen(true)}
        connectionStatus={connectionStatus}
      />

      <CompactAuthBanner />

      {(connectionStatus === "reconnecting" || connectionStatus === "offline") && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            background: "var(--sev-elevated, #FFCC00)",
            color: "#0A0F18",
            fontWeight: 700,
          }}
        >
          {connectionStatus === "reconnecting"
            ? t("instructor.banner.reconnecting")
            : t("instructor.banner.offline")}
        </div>
      )}

      {lastReject !== null && (
        <div
          role="alert"
          style={{
            padding: "8px 16px",
            color: "var(--sev-critical, #FF3333)",
            fontWeight: 700,
            overflowWrap: "anywhere",
          }}
        >
          {t(rejectMessageKey(lastReject))}
        </div>
      )}

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)",
            gap: 16,
            padding: 16,
            minHeight: "100%",
            filter: paused ? "none" : undefined,
          }}
        >
          <LiveStateColumn
            view={instructorView}
            presence={presence}
            stale={!live}
            paused={paused}
          />
          <InjectionDeck
            view={instructorView}
            canFire={live && phase === "running"}
            onFire={(injection) => sendIntent({ type: "injection", injection })}
          />
        </div>

        {paused && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(7,13,16,0.55)",
              display: "grid",
              placeItems: "center",
              pointerEvents: "none",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            {t("instructor.pause.veil")}
          </div>
        )}
      </div>

      {endOpen && (
        <EndConfirmDialog
          onCancel={() => setEndOpen(false)}
          onConfirm={() => {
            sendIntent({ type: "phase_change", phase: "debrief" });
            setEndOpen(false);
            window.location.hash = `#/aar/${sessionId}`;
          }}
        />
      )}
    </div>
  );
}

function CommandBar({
  sessionId,
  phase,
  elapsedLabel,
  scenarioLabel,
  disabled,
  onPause,
  onResume,
  onStartBriefing,
  onStartRun,
  onRequestEnd,
  connectionStatus,
}: {
  sessionId: string;
  phase: SessionPhase | undefined;
  elapsedLabel: string;
  scenarioLabel: string;
  disabled: boolean;
  onPause: () => void;
  onResume: () => void;
  onStartBriefing: () => void;
  onStartRun: () => void;
  onRequestEnd: () => void;
  connectionStatus: ConnectionStatus;
}) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");
  const paused = phase === "paused";

  function copyStationLinkLabel(state: "idle" | "done" | "failed"): string {
    switch (state) {
      case "done":
        return t("instructor.copyStationLink.done");
      case "failed":
        return t("instructor.copyStationLink.failed");
      case "idle":
        return t("instructor.copyStationLink");
      default: {
        const exhaustive: never = state;
        throw new Error(`Unhandled copy state: ${String(exhaustive)}`);
      }
    }
  }

  async function copyStationLink() {
    const url = `${window.location.origin}${window.location.pathname}#/station/${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("done");
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2500);
  }

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 2,
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--border-default, #243040)",
        background: "var(--instrument-bg, #0A0F18)",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", minWidth: 0 }}>
        <strong style={{ fontSize: 20 }}>
          Vet<span style={{ color: "var(--action-accent, #008080)" }}>Crew</span>
        </strong>
        <span style={chipStyle}>
          {phase !== undefined ? t(`phase.${phase}`) : "—"} ·{" "}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>{elapsedLabel}</span>
        </span>
        <span
          style={{
            color: "var(--text-secondary, #9aa7b8)",
            maxWidth: "16rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={scenarioLabel}
        >
          {scenarioLabel}
        </span>
        <ConnectionPill
          status={connectionStatus}
          paused={paused}
          labelPrefix="instructor"
        />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button type="button" onClick={() => void copyStationLink()} style={lgPrimary}>
          {copyStationLinkLabel(copyState)}
        </button>
        {phase === "draft" && (
          <button type="button" disabled={disabled} onClick={onStartBriefing} style={lgPrimary}>
            {t("instructor.verb.briefing")}
          </button>
        )}
        {phase === "briefing" && (
          <button type="button" disabled={disabled} onClick={onStartRun} style={lgPrimary}>
            {t("instructor.verb.start")}
          </button>
        )}
        {phase === "running" && (
          <button type="button" disabled={disabled} onClick={onPause} style={lgPrimary}>
            {t("instructor.verb.pause")}
          </button>
        )}
        {phase === "paused" && (
          <button type="button" disabled={disabled} onClick={onResume} style={lgPrimary}>
            {t("instructor.verb.resume")}
          </button>
        )}
        <button
          type="button"
          disabled={disabled || phase === "draft"}
          onClick={onRequestEnd}
          style={lgDanger}
        >
          {t("instructor.verb.end")}
        </button>
        <a href="#/" style={{ minHeight: 56, display: "inline-flex", alignItems: "center" }}>
          {t("instructor.back")}
        </a>
      </div>
    </header>
  );
}

function LiveStateColumn({
  view,
  presence,
  stale,
  paused,
}: {
  view: InstructorViewWire | null;
  presence: { role: string; stationKind: string; actorId: string; status: string }[];
  stale: boolean;
  paused: boolean;
}) {
  const entries = useMemo(() => (view === null ? [] : Object.entries(view.vitals)), [view]);
  return (
    <section
      aria-label={t("instructor.live.label")}
      style={{
        padding: 16,
        background: "var(--monitor-surface, #070B12)",
        borderRadius: 10,
        opacity: stale ? 0.55 : 1,
        filter: stale ? "grayscale(0.35)" : "none",
        backgroundImage: stale
          ? "repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(255,255,255,0.04) 6px, rgba(255,255,255,0.04) 12px)"
          : undefined,
      }}
    >
      <div style={{ marginBlockEnd: 8, fontWeight: 700 }}>
        {t("instructor.live.monitor")} ·{" "}
        {paused ? t("instructor.connection.paused") : t("instructor.connection.live")}
      </div>
      {stale && (
        <p role="status" style={{ fontWeight: 700 }}>
          {t("instructor.live.stale")}
        </p>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
          marginBlockEnd: 20,
        }}
      >
        {entries.map(([name, value]) => {
          const meta = VITAL_META[name] ?? {
            label: name.toUpperCase(),
            cssVar: "--ch-hr",
            fallback: "#FFFFFF",
          };
          return (
            <div
              key={name}
              style={{
                border: "1px solid var(--border-default, #243040)",
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div style={{ color: `var(${meta.cssVar}, ${meta.fallback})`, fontWeight: 700 }}>
                {meta.label}
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: `var(${meta.cssVar}, ${meta.fallback})`,
                }}
              >
                {Number.isFinite(value) ? value.toFixed(name === "temp" || name === "spo2" ? 1 : 0) : "—"}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontWeight: 700, marginBlockEnd: 8 }}>{t("instructor.roles.heading")}</div>
      {presence.length === 0 ? (
        <p style={{ color: "var(--text-secondary, #9aa7b8)" }}>{t("instructor.roles.empty")}</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
          {presence.map((member) => (
            <li key={`${member.stationKind}-${member.role}-${member.actorId}`} style={chipStyle}>
              {member.stationKind === "instructor"
                ? t("instructor.roles.instructor")
                : t("instructor.roles.trainee", { role: member.role })}{" "}
              ·{" "}
              {member.status === "connected"
                ? t("instructor.roles.status.connected")
                : t("instructor.roles.status.disconnected")}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function InjectionDeck({
  view,
  canFire,
  onFire,
}: {
  view: InstructorViewWire | null;
  canFire: boolean;
  onFire: (injectionId: string) => void;
}) {
  const injections = view?.injections ?? [];
  return (
    <section
      aria-label={t("instructor.injections.label")}
      style={{
        padding: 16,
        background: "var(--task-surface, #121926)",
        borderRadius: 10,
        border: "2px solid var(--border-default, #243040)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontWeight: 700 }}>{t("instructor.injections.heading")}</div>
        <div style={{ color: "var(--text-secondary, #9aa7b8)", fontSize: 14 }}>
          {t("instructor.injections.hint")}
        </div>
      </div>
      {injections.length === 0 ? (
        <p style={{ color: "var(--text-secondary, #9aa7b8)" }}>{t("instructor.injections.empty")}</p>
      ) : (
        injections.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={!canFire || item.fired}
            aria-pressed={item.fired}
            onClick={() => onFire(item.id)}
            style={{
              minHeight: 56,
              textAlign: "start",
              padding: 14,
              borderRadius: 10,
              border: "2px solid var(--action-accent-contrast, #5eead4)",
              background: item.fired ? "rgba(94,234,212,0.12)" : "transparent",
              color: "inherit",
              opacity: !canFire && !item.fired ? 0.45 : 1,
              cursor: canFire && !item.fired ? "pointer" : "not-allowed",
              fontWeight: 700,
            }}
          >
            <div>{item.labelHe}</div>
            {item.fired && (
              <div style={{ fontWeight: 400, fontSize: 13, color: "var(--text-secondary, #9aa7b8)" }}>
                {t("instructor.injections.fired", {
                  at: item.firedAtMs === null ? "—" : formatFiredAt(item.firedAtMs),
                })}
              </div>
            )}
          </button>
        ))
      )}
    </section>
  );
}

function EndConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="end-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "grid",
        placeItems: "center",
        zIndex: 10,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--instrument-bg, #0A0F18)",
          border: "1px solid var(--border-default, #243040)",
          borderRadius: 12,
          padding: 24,
          maxWidth: 420,
          width: "100%",
          display: "grid",
          gap: 16,
        }}
      >
        <h2 id="end-title" style={{ margin: 0 }}>
          {t("instructor.end.title")}
        </h2>
        <p style={{ margin: 0, color: "var(--text-secondary, #9aa7b8)" }}>
          {t("instructor.end.body")}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={lgGhost} autoFocus>
            {t("instructor.end.cancel")}
          </button>
          <button type="button" onClick={onConfirm} style={lgDanger}>
            {t("instructor.end.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

const chipStyle: CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  paddingInline: 12,
  borderRadius: 8,
  border: "1px solid var(--border-default, #243040)",
};

const lgPrimary: CSSProperties = {
  minHeight: 56,
  minWidth: 120,
  paddingInline: 16,
  background: "var(--action-accent, #008080)",
  color: "#fff",
  border: 0,
  borderRadius: 8,
  fontWeight: 700,
  cursor: "pointer",
};

const lgDanger: CSSProperties = {
  ...lgPrimary,
  background: "var(--sev-critical, #FF3333)",
};

const lgGhost: CSSProperties = {
  ...lgPrimary,
  background: "transparent",
  border: "1px solid var(--border-default, #243040)",
  color: "inherit",
};
