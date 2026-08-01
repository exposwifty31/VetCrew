import { useMemo, useState, type CSSProperties } from "react";

import type { ClientIntent, RoleViewWire } from "@vetcrew/shared";

import { CompactAuthBanner } from "../components/AuthBar.js";
import { ConnectionPill } from "../components/ConnectionPill.js";
import { PatientMonitor } from "../components/PatientMonitor.js";
import {
  e2eOrNoBearerToken,
  hasClerkPublishableKey,
  useClerkBearerToken,
} from "../hooks/useBearerToken.js";
import { t, type MessageKey } from "../i18n";
import { rejectMessageKey } from "../live/rejectMessage.js";
import { useSession } from "../live/useSession.js";
import type { MonitorVitals } from "../monitor/renderer.js";

/**
 * Numeric tile colours follow monitor channel identity (§4). Cuff pressure is
 * NIBP (white), never arterial red — Art means an invasive line.
 */
const VITAL_META: Record<string, { label: string; cssVar: string; fallback: string }> = {
  hr: { label: "HR", cssVar: "--ch-hr", fallback: "#00FF66" },
  spo2: { label: "SpO₂", cssVar: "--ch-spo2", fallback: "#00CCFF" },
  etco2: { label: "EtCO₂", cssVar: "--ch-etco2", fallback: "#FFFFFF" },
  rr: { label: "RR", cssVar: "--ch-rr", fallback: "#FFCC00" },
  temp: { label: "Temp", cssVar: "--ch-temp", fallback: "#FFFFFF" },
  sys_bp: { label: "SYS", cssVar: "--ch-nibp", fallback: "#FFFFFF" },
  dia_bp: { label: "DIA", cssVar: "--ch-nibp", fallback: "#FFFFFF" },
};

/**
 * Task-surface CODE colours signal task type and live only inside the task
 * panel (§4). The code itself is user-facing text, so it goes through i18n —
 * a bare "do"/"report" is English leaking onto a Hebrew-first screen.
 */
const TASK_CODE_KEY: Record<string, MessageKey> = {
  do: "station.task.code.do",
  report: "station.task.code.report",
  timed: "station.task.code.timed",
  approval: "station.task.code.approval",
};

function taskCodeLabel(code: string): string {
  const key = TASK_CODE_KEY[code];
  return key === undefined ? code : t(key);
}

type Props = { readonly sessionId: string };

export default function StationPage({ sessionId }: Props) {
  if (hasClerkPublishableKey) {
    return <StationPageWithClerk sessionId={sessionId} />;
  }
  return <StationPageBody sessionId={sessionId} getToken={e2eOrNoBearerToken} />;
}

function StationPageWithClerk({ sessionId }: Props) {
  const getToken = useClerkBearerToken();
  return <StationPageBody sessionId={sessionId} getToken={getToken} />;
}

function StationPageBody({
  sessionId,
  getToken,
}: Props & { getToken: () => Promise<string | null> }) {
  const { roleView, connectionStatus, lastReject, sendIntent } = useSession(sessionId, {
    getToken,
  });
  const live = connectionStatus === "connected" && roleView !== null;
  const interactive = live && roleView.phase === "running";

  return (
    <div
      className="station"
      style={{
        minHeight: "100dvh",
        background: "var(--instrument-bg, #0A0F18)",
        color: "var(--instrument-fg, #E8EEF5)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-ui, 'IBM Plex Sans Hebrew', sans-serif)",
      }}
    >
      <header
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-default, #243040)",
        }}
      >
        <div style={{ minWidth: 0, maxWidth: "min(100%, 28rem)" }}>
          <div style={{ fontWeight: 700 }}>{t("station.role")}</div>
          <div
            style={{
              color: "var(--text-secondary, #9aa7b8)",
              fontSize: 14,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={`${roleView?.species ?? t("station.patient.unknown")} · ${roleView?.scenarioSlug ?? "—"}`}
          >
            {roleView?.species ?? t("station.patient.unknown")} · {roleView?.scenarioSlug ?? "—"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <PhaseBadge phase={roleView?.phase} />
          <ConnectionPill status={connectionStatus} labelPrefix="station" />
          <a href="#/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            {t("station.back")}
          </a>
        </div>
      </header>

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
            ? t("station.banner.reconnecting")
            : t("station.banner.offline")}
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

      {roleView !== null &&
        (roleView.phase === "draft" || roleView.phase === "briefing") && (
          <div
            role="status"
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-default, #243040)",
              background: "var(--task-surface, #121926)",
            }}
          >
            {t("station.waitingForInstructor")}
          </div>
        )}

      {roleView?.phase === "paused" && (
        <div
          role="status"
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-default, #243040)",
            background: "rgba(0,128,128,0.15)",
            fontWeight: 700,
          }}
        >
          {t("station.paused")}
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 8px minmax(0, 1fr)",
          gap: 0,
          minHeight: 0,
        }}
      >
        <TaskPanel
          roleView={roleView}
          interactive={interactive}
          sendIntent={sendIntent}
        />
        <div aria-hidden="true" style={{ background: "var(--instrument-bg, #0A0F18)" }} />
        <MonitorZone roleView={roleView} stale={!live} />
      </div>
    </div>
  );
}

function PhaseBadge({ phase }: { phase: RoleViewWire["phase"] | undefined }) {
  return (
    <span
      style={{
        minHeight: 44,
        display: "inline-flex",
        alignItems: "center",
        paddingInline: 12,
        border: "1px solid var(--border-default, #243040)",
        borderRadius: 8,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {phase !== undefined ? t(`phase.${phase}`) : "—"}
    </span>
  );
}

function MonitorZone({
  roleView,
  stale,
}: {
  roleView: RoleViewWire | null;
  stale: boolean;
}) {
  const entries = useMemo(() => {
    if (roleView === null) return [];
    return Object.entries(roleView.vitals);
  }, [roleView]);

  // The monitor draws only channels the engine actually supplies (see
  // monitor/renderer.ts) — an unmodelled vital stays absent, never invented.
  const monitorVitals = useMemo<MonitorVitals>(
    () => (roleView === null ? {} : (roleView.vitals as MonitorVitals)),
    [roleView],
  );

  return (
    <section
      aria-label={t("station.monitor.label")}
      style={{
        padding: 16,
        background: "var(--monitor-surface, #070B12)",
        opacity: stale ? 0.55 : 1,
        filter: stale ? "grayscale(0.35)" : "none",
        backgroundImage: stale
          ? "repeating-linear-gradient(135deg, transparent, transparent 6px, rgba(255,255,255,0.04) 6px, rgba(255,255,255,0.04) 12px)"
          : undefined,
      }}
    >
      <div style={{ marginBlockEnd: 12, color: "var(--text-secondary, #9aa7b8)" }}>
        {t("station.monitor.strip")}
      </div>
      {stale && (
        <p role="status" style={{ marginTop: 0, fontWeight: 700 }}>
          {t("station.monitor.stale")}
        </p>
      )}
      {roleView !== null && (
        <div style={{ marginBlockEnd: 12 }}>
          <PatientMonitor
            vitals={monitorVitals}
            species={roleView.species}
            frozen={stale || roleView.phase !== "running"}
          />
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 12,
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
              <div
                style={{
                  color: `var(${meta.cssVar}, ${meta.fallback})`,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {meta.label}
              </div>
              <div
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1.1,
                  color: `var(${meta.cssVar}, ${meta.fallback})`,
                }}
              >
                {Number.isFinite(value) ? value.toFixed(name === "temp" ? 1 : 0) : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TaskPanel({
  roleView,
  interactive,
  sendIntent,
}: {
  roleView: RoleViewWire | null;
  interactive: boolean;
  sendIntent: (intent: ClientIntent) => void;
}) {
  const railTasks = roleView?.tasks.filter((task) => !task.hidden) ?? [];
  const escalate = roleView?.tasks.find((task) => task.hidden && task.body.kind === "escalate");
  const focus =
    railTasks.find((task) => task.lifecycle === "in_progress") ??
    railTasks.find((task) => task.lifecycle === "available") ??
    null;

  return (
    <section
      aria-label={t("station.tasks.label")}
      style={{
        padding: 16,
        background: "var(--task-surface, #121926)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {railTasks.map((task) => (
          <span
            key={task.id}
            style={{
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              paddingInline: 12,
              borderRadius: 8,
              border: "1px solid var(--border-default, #243040)",
              opacity: task.lifecycle === "done" ? 0.55 : 1,
              outline:
                focus?.id === task.id ? "2px solid var(--action-accent, #008080)" : undefined,
            }}
          >
            <strong style={{ marginInlineEnd: 6 }}>{taskCodeLabel(task.code)}</strong>
            {task.titleHe}
          </span>
        ))}
      </div>

      {focus === null ? (
        <p style={{ color: "var(--text-secondary, #9aa7b8)" }}>{t("station.tasks.empty")}</p>
      ) : (
        <TaskWorkspace
          task={focus}
          interactive={interactive}
          sendIntent={sendIntent}
        />
      )}

      {escalate !== undefined && (
        <button
          type="button"
          disabled={!interactive || escalate.lifecycle === "done"}
          onClick={() => {
            if (escalate.lifecycle === "available") {
              sendIntent({ type: "task_start", taskId: escalate.id });
            }
            sendIntent({
              type: "task_submit",
              taskId: escalate.id,
              submission: { kind: "escalate" },
            });
          }}
          style={{
            minHeight: 56,
            marginBlockStart: "auto",
            background: "transparent",
            color: "var(--action-accent, #008080)",
            border: "2px solid var(--action-accent, #008080)",
            borderRadius: 10,
            fontWeight: 700,
            cursor: interactive ? "pointer" : "not-allowed",
          }}
        >
          {t("station.escalate")}
        </button>
      )}
    </section>
  );
}

function TaskWorkspace({
  task,
  interactive,
  sendIntent,
}: {
  task: RoleViewWire["tasks"][number];
  interactive: boolean;
  sendIntent: (intent: ClientIntent) => void;
}) {
  const started = task.lifecycle === "in_progress" || task.lifecycle === "done";

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, color: "var(--text-secondary, #9aa7b8)" }}>
          {taskCodeLabel(task.code)}
        </div>
        <h2 style={{ margin: "4px 0", fontSize: 22 }}>{task.titleHe}</h2>
        <p style={{ margin: 0, color: "var(--text-secondary, #9aa7b8)" }}>{task.instructionHe}</p>
      </div>

      {!started && (
        <button
          type="button"
          disabled={!interactive}
          onClick={() => sendIntent({ type: "task_start", taskId: task.id })}
          style={verbStyle(interactive)}
        >
          {t("station.verb.start")}
        </button>
      )}

      {started && task.lifecycle !== "done" && (
        <DecisionBody task={task} interactive={interactive} sendIntent={sendIntent} />
      )}

      {task.lifecycle === "done" && (
        <p style={{ color: "var(--text-secondary, #9aa7b8)" }}>{t("station.tasks.done")}</p>
      )}
    </div>
  );
}

function DecisionBody({
  task,
  interactive,
  sendIntent,
}: {
  task: RoleViewWire["tasks"][number];
  interactive: boolean;
  sendIntent: (intent: ClientIntent) => void;
}) {
  const body = task.body;
  switch (body.kind) {
    case "value_entry":
      return (
        <ValueEntryBody
          taskId={task.id}
          fields={body.fields}
          interactive={interactive}
          sendIntent={sendIntent}
        />
      );
    case "choice_chain":
      return (
        <ChoiceChainBody
          taskId={task.id}
          steps={body.steps}
          interactive={interactive}
          sendIntent={sendIntent}
        />
      );
    case "med_admin":
      return (
        <MedAdminBody
          taskId={task.id}
          body={body}
          interactive={interactive}
          sendIntent={sendIntent}
        />
      );
    case "tube_choice":
      return (
        <TubeChoiceBody
          taskId={task.id}
          options={body.options}
          interactive={interactive}
          sendIntent={sendIntent}
        />
      );
    case "step_order":
      return (
        <StepOrderBody
          taskId={task.id}
          steps={body.steps}
          interactive={interactive}
          sendIntent={sendIntent}
        />
      );
    case "fluids_setup":
      return (
        <FluidsSetupBody
          taskId={task.id}
          body={body}
          interactive={interactive}
          sendIntent={sendIntent}
        />
      );
    case "escalate":
      return null;
    default: {
      const exhaustive: never = body;
      throw new Error(`Unhandled body: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function ValueEntryBody({
  taskId,
  fields,
  interactive,
  sendIntent,
}: {
  taskId: string;
  fields: Extract<RoleViewWire["tasks"][number]["body"], { kind: "value_entry" }>["fields"];
  interactive: boolean;
  sendIntent: (intent: ClientIntent) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const parsed: Record<string, number> = {};
        for (const field of fields) {
          const raw = values[field.id] ?? "";
          if (!new RegExp(field.format).test(raw)) return;
          parsed[field.id] = Number(raw);
        }
        sendIntent({
          type: "task_submit",
          taskId,
          submission: { kind: "value_entry", values: parsed },
        });
      }}
      style={{ display: "grid", gap: 10 }}
    >
      {fields.map((field) => (
        <label key={field.id} style={{ display: "grid", gap: 4 }}>
          <span>
            {field.labelHe} ({field.unit})
          </span>
          <input
            value={values[field.id] ?? ""}
            disabled={!interactive}
            onChange={(e) => setValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
            style={{ minHeight: 48, paddingInline: 12, borderRadius: 8 }}
          />
        </label>
      ))}
      <button type="submit" disabled={!interactive} style={verbStyle(interactive)}>
        {t("station.verb.submit")}
      </button>
    </form>
  );
}

function ChoiceChainBody({
  taskId,
  steps,
  interactive,
  sendIntent,
}: {
  taskId: string;
  steps: Extract<RoleViewWire["tasks"][number]["body"], { kind: "choice_chain" }>["steps"];
  interactive: boolean;
  sendIntent: (intent: ClientIntent) => void;
}) {
  const [choices, setChoices] = useState<Record<string, string>>({});
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {steps.map((step) => (
        <fieldset key={step.id} style={{ border: "1px solid var(--border-default, #243040)", borderRadius: 8 }}>
          <legend>{step.labelHe}</legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8 }}>
            {step.options.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={!interactive}
                onClick={() => setChoices((prev) => ({ ...prev, [step.id]: option.id }))}
                style={{
                  ...verbStyle(interactive),
                  background:
                    choices[step.id] === option.id
                      ? "var(--action-accent, #008080)"
                      : "transparent",
                  border: "1px solid var(--action-accent, #008080)",
                }}
              >
                {option.labelHe}
              </button>
            ))}
          </div>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={!interactive || steps.some((step) => choices[step.id] === undefined)}
        onClick={() =>
          sendIntent({
            type: "task_submit",
            taskId,
            submission: { kind: "choice_chain", choices },
          })
        }
        style={verbStyle(interactive)}
      >
        {t("station.verb.submit")}
      </button>
    </div>
  );
}

function MedAdminBody({
  taskId,
  body,
  interactive,
  sendIntent,
}: {
  taskId: string;
  body: Extract<RoleViewWire["tasks"][number]["body"], { kind: "med_admin" }>;
  interactive: boolean;
  sendIntent: (intent: ClientIntent) => void;
}) {
  const [ml, setMl] = useState("");
  const [routeId, setRouteId] = useState<string | null>(null);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <p style={{ margin: 0 }}>
        {body.drugLabelHe} · {body.doseMg} mg · {body.concentrationMgPerMl} mg/ml
      </p>
      <label style={{ display: "grid", gap: 4 }}>
        <span>{t("station.med.ml")}</span>
        <input
          value={ml}
          disabled={!interactive}
          onChange={(e) => setMl(e.target.value)}
          style={{ minHeight: 48, paddingInline: 12, borderRadius: 8 }}
        />
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {body.routes.map((route) => (
          <button
            key={route.id}
            type="button"
            disabled={!interactive}
            onClick={() => setRouteId(route.id)}
            style={{
              ...verbStyle(interactive),
              background: routeId === route.id ? "var(--action-accent, #008080)" : "transparent",
              border: "1px solid var(--action-accent, #008080)",
            }}
          >
            {route.labelHe}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!interactive || routeId === null || ml === ""}
        onClick={() =>
          sendIntent({
            type: "task_submit",
            taskId,
            submission: { kind: "med_admin", ml: Number(ml), routeId: routeId! },
          })
        }
        style={verbStyle(interactive)}
      >
        {t("station.verb.submit")}
      </button>
    </div>
  );
}

function TubeChoiceBody({
  taskId,
  options,
  interactive,
  sendIntent,
}: {
  taskId: string;
  options: Extract<RoleViewWire["tasks"][number]["body"], { kind: "tube_choice" }>["options"];
  interactive: boolean;
  sendIntent: (intent: ClientIntent) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const on = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              disabled={!interactive}
              onClick={() =>
                setSelected((prev) =>
                  on ? prev.filter((id) => id !== option.id) : [...prev, option.id],
                )
              }
              style={{
                ...verbStyle(interactive),
                background: on ? "var(--action-accent, #008080)" : "transparent",
                border: "1px solid var(--action-accent, #008080)",
              }}
            >
              {option.labelHe}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!interactive || selected.length === 0}
        onClick={() =>
          sendIntent({
            type: "task_submit",
            taskId,
            submission: { kind: "tube_choice", optionIds: selected },
          })
        }
        style={verbStyle(interactive)}
      >
        {t("station.verb.submit")}
      </button>
    </div>
  );
}

function StepOrderBody({
  taskId,
  steps,
  interactive,
  sendIntent,
}: {
  taskId: string;
  steps: Extract<RoleViewWire["tasks"][number]["body"], { kind: "step_order" }>["steps"];
  interactive: boolean;
  sendIntent: (intent: ClientIntent) => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const remaining = steps.filter((step) => !order.includes(step.id));
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <ol style={{ margin: 0, paddingInlineStart: 20 }}>
        {order.map((id) => {
          const step = steps.find((s) => s.id === id);
          return <li key={id}>{step?.labelHe ?? id}</li>;
        })}
      </ol>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {remaining.map((step) => (
          <button
            key={step.id}
            type="button"
            disabled={!interactive}
            onClick={() => setOrder((prev) => [...prev, step.id])}
            style={verbStyle(interactive)}
          >
            {step.labelHe}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={!interactive || order.length !== steps.length}
        onClick={() =>
          sendIntent({
            type: "task_submit",
            taskId,
            submission: { kind: "step_order", order },
          })
        }
        style={verbStyle(interactive)}
      >
        {t("station.verb.submit")}
      </button>
    </div>
  );
}

function FluidsSetupBody({
  taskId,
  body,
  interactive,
  sendIntent,
}: {
  taskId: string;
  body: Extract<RoleViewWire["tasks"][number]["body"], { kind: "fluids_setup" }>;
  interactive: boolean;
  sendIntent: (intent: ClientIntent) => void;
}) {
  const [setId, setSetId] = useState<string | null>(null);
  const [drops, setDrops] = useState("");
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <p style={{ margin: 0 }}>
        {body.weightKg} kg · {body.orderedMlPerHr} ml/hr
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {body.sets.map((set) => (
          <button
            key={set.id}
            type="button"
            disabled={!interactive}
            onClick={() => setSetId(set.id)}
            style={{
              ...verbStyle(interactive),
              background: setId === set.id ? "var(--action-accent, #008080)" : "transparent",
              border: "1px solid var(--action-accent, #008080)",
            }}
          >
            {set.labelHe}
          </button>
        ))}
      </div>
      <label style={{ display: "grid", gap: 4 }}>
        <span>{t("station.fluids.drops")}</span>
        <input
          value={drops}
          disabled={!interactive}
          onChange={(e) => setDrops(e.target.value)}
          style={{ minHeight: 48, paddingInline: 12, borderRadius: 8 }}
        />
      </label>
      <button
        type="button"
        disabled={!interactive || setId === null || drops === ""}
        onClick={() =>
          sendIntent({
            type: "task_submit",
            taskId,
            submission: {
              kind: "fluids_setup",
              setId: setId!,
              dropsPerMin: Number(drops),
            },
          })
        }
        style={verbStyle(interactive)}
      >
        {t("station.verb.submit")}
      </button>
    </div>
  );
}

function verbStyle(interactive: boolean): CSSProperties {
  return {
    minHeight: 48,
    paddingInline: 16,
    background: "var(--action-accent, #008080)",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    fontWeight: 700,
    cursor: interactive ? "pointer" : "not-allowed",
    opacity: interactive ? 1 : 0.5,
  };
}
