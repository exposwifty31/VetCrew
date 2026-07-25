import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";

import { replay, type EngineEvent, type ScenarioDef } from "@vetcrew/engine";

import { createSession, fetchSessions, type SessionSummary } from "./api.js";
import AuthBar from "./components/AuthBar.js";
import {
  hasClerkPublishableKey,
  noBearerToken,
  useClerkBearerToken,
} from "./hooks/useBearerToken.js";
import { t } from "./i18n";

const AarPage = lazy(() => import("./pages/AarPage.js"));
const InstructorConsolePage = lazy(() => import("./pages/InstructorConsolePage.js"));
const ManagerEvidencePage = lazy(() => import("./pages/ManagerEvidencePage.js"));
const StationPage = lazy(() => import("./pages/StationPage.js"));

function RouteLoadingFallback() {
  return <main style={{ padding: 32 }}>{t("shell.loading")}</main>;
}

function LazyRoute({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoadingFallback />}>{children}</Suspense>;
}

interface Health {
  ok: boolean;
  auth: "clerk" | "dev-bypass";
  db: "ready" | "starting" | "not-configured";
}

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

/** Layer A channel identity — label + fixed position, never hue alone. */
const CHANNELS = [
  { label: "HR", cssVar: "--ch-hr", fallback: "#00FF66" },
  { label: "SpO₂", cssVar: "--ch-spo2", fallback: "#00CCFF" },
  { label: "EtCO₂", cssVar: "--ch-etco2", fallback: "#FFCC00" },
  { label: "RR", cssVar: "--ch-rr", fallback: "#FFCC00" },
  { label: "ART", cssVar: "--ch-art", fallback: "#FF3B30" },
] as const;

/** Smoke scenario: SpO2 deteriorates, oxygen at t=15s recovers it. */
const SMOKE_SCENARIO: ScenarioDef = {
  slug: "shell-smoke",
  version: "0.0.1",
  vitals: {
    hr: { initial: 90, target: 140, ratePerSec: 1, jitter: 0.5 },
    spo2: { initial: 95, target: 80, ratePerSec: 0.5, jitter: 0.1 },
  },
  triggers: [
    {
      id: "oxygen",
      on: { kind: "action", action: "oxygen_on" },
      effects: [{ vital: "spo2", target: 97, ratePerSec: 1 }],
    },
  ],
};

function engineSmoke() {
  const events: EngineEvent[] = [
    { seq: 1, type: "phase_change", phase: "briefing" },
    { seq: 2, type: "phase_change", phase: "running" },
  ];
  let seq = 2;
  for (let i = 0; i < 30; i++) {
    events.push({ seq: ++seq, type: "tick", dtMs: 1000 });
    if (i === 14) {
      events.push({
        seq: ++seq,
        type: "action",
        role: "technician",
        actorId: "shell",
        action: "oxygen_on",
      });
    }
  }
  const state = replay(20260725, events, SMOKE_SCENARIO);
  return {
    events: events.length,
    hr: (state.vitals["hr"]?.value ?? 0).toFixed(1),
    spo2: (state.vitals["spo2"]?.value ?? 0).toFixed(1),
  };
}

export default function App() {
  const route = useHashRoute();
  const aarMatch = /^#\/aar\/(.+)$/.exec(route);
  if (aarMatch?.[1] !== undefined) {
    return (
      <LazyRoute>
        <AarPage sessionId={aarMatch[1]} />
      </LazyRoute>
    );
  }
  const stationMatch = /^#\/station\/(.+)$/.exec(route);
  if (stationMatch?.[1] !== undefined) {
    return (
      <LazyRoute>
        <StationPage sessionId={stationMatch[1]} />
      </LazyRoute>
    );
  }
  const instructorMatch = /^#\/instructor\/(.+)$/.exec(route);
  if (instructorMatch?.[1] !== undefined) {
    return (
      <LazyRoute>
        <InstructorConsolePage sessionId={instructorMatch[1]} />
      </LazyRoute>
    );
  }
  const managerTrendMatch = /^#\/manager\/([^/]+)\/trend$/.exec(route);
  if (managerTrendMatch?.[1] !== undefined) {
    return (
      <LazyRoute>
        <ManagerEvidencePage traineeId={decodeURIComponent(managerTrendMatch[1])} focus="trend" />
      </LazyRoute>
    );
  }
  const managerMatch = /^#\/manager\/(.+)$/.exec(route);
  if (managerMatch?.[1] !== undefined) {
    return (
      <LazyRoute>
        <ManagerEvidencePage traineeId={decodeURIComponent(managerMatch[1])} />
      </LazyRoute>
    );
  }
  return hasClerkPublishableKey ? <HomePageWithClerk /> : <HomePage getToken={noBearerToken} />;
}

function HomePageWithClerk() {
  const getToken = useClerkBearerToken();
  return <HomePage getToken={getToken} />;
}

function HomePage({ getToken }: { getToken: () => Promise<string | null> }) {
  const [health, setHealth] = useState<Health | null | "down">(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [startingStation, setStartingStation] = useState(false);
  const [startingInstructor, setStartingInstructor] = useState(false);
  const engine = useMemo(engineSmoke, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/health", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`health: ${res.status}`);
        return res.json() as Promise<Health>;
      })
      .then((body) => setHealth(body.ok ? body : "down"))
      .catch(() => setHealth("down"));
    void (async () => {
      try {
        const token = await getToken();
        setSessions(await fetchSessions(token));
      } catch {
        setSessions([]);
      }
    })();
    return () => controller.abort();
  }, [getToken]);

  async function startStation() {
    setStartingStation(true);
    try {
      const token = await getToken();
      const session = await createSession(
        {
          scenarioSlug: "base-rung-stepped-tasks",
          traineeId: "pitch-trainee",
          traineeTimeInTrainingDays: 90,
        },
        token,
      );
      window.location.hash = `#/station/${session.id}`;
    } catch {
      setStartingStation(false);
    }
  }

  async function startInstructorDemo() {
    setStartingInstructor(true);
    try {
      const token = await getToken();
      const session = await createSession(
        {
          scenarioSlug: "base-rung-resp-distress",
          traineeId: "pitch-trainee",
          traineeTimeInTrainingDays: 90,
        },
        token,
      );
      window.location.hash = `#/instructor/${session.id}`;
    } catch {
      setStartingInstructor(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, marginInline: "auto", padding: "var(--sp-8, 32px)" }}>
      <AuthBar />
      <h1 style={{ fontSize: "var(--fs-xl, 28px)", marginBlockEnd: 4 }}>{t("app.title")}</h1>
      <p style={{ color: "var(--text-secondary, #9aa7b8)", marginBlockStart: 0 }}>{t("shell.subtitle")}</p>

      <section style={{ marginBlockStart: 32 }}>
        <h2 style={{ fontSize: "var(--fs-md, 17px)" }}>{t("shell.server.heading")}</h2>
        {health === null && <p>{t("shell.server.checking")}</p>}
        {health === "down" && <p>{t("shell.server.down")}</p>}
        {health !== null && health !== "down" && (
          <p>
            {t("shell.server.ok")} · {t(`shell.server.auth.${health.auth}`)} ·{" "}
            {t(`shell.server.db.${health.db}`)}
          </p>
        )}
      </section>

      <section style={{ marginBlockStart: 32 }}>
        <h2 style={{ fontSize: "var(--fs-md, 17px)" }}>{t("shell.tokens.heading")}</h2>
        <ul style={{ display: "flex", gap: 12, listStyle: "none", padding: 0 }}>
          {CHANNELS.map((channel) => (
            <li key={channel.label} style={{ textAlign: "center" }}>
              <span
                aria-hidden="true"
                style={{
                  display: "block",
                  width: 48,
                  height: 24,
                  borderRadius: "var(--r-sm, 4px)",
                  background: `var(${channel.cssVar}, ${channel.fallback})`,
                }}
              />
              <span style={{ fontSize: "var(--fs-xs, 13px)" }}>{channel.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginBlockStart: 32 }}>
        <h2 style={{ fontSize: "var(--fs-md, 17px)" }}>{t("shell.engine.heading")}</h2>
        <p style={{ fontVariantNumeric: "tabular-nums" }}>
          {t("shell.engine.summary", { events: engine.events, hr: engine.hr, spo2: engine.spo2 })}
        </p>
      </section>

      <section style={{ marginBlockStart: 32 }}>
        <h2 style={{ fontSize: "var(--fs-md, 17px)" }}>{t("home.station.heading")}</h2>
        <p style={{ color: "var(--text-secondary, #9aa7b8)" }}>{t("home.station.blurb")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <button
            type="button"
            disabled={startingStation || health === "down" || health === null}
            onClick={() => void startStation()}
            style={{
              minHeight: 48,
              paddingInline: 16,
              background: "var(--action-accent, #008080)",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {startingStation ? t("home.station.starting") : t("home.station.start")}
          </button>
          <button
            type="button"
            disabled={startingInstructor || health === "down" || health === null}
            onClick={() => void startInstructorDemo()}
            style={{
              minHeight: 48,
              paddingInline: 16,
              // Outline accent must meet WCAG AA on --bg (#0a1216): #008080 is ~3.95:1.
              background: "transparent",
              color: "var(--action-accent-contrast, #5eead4)",
              border: "2px solid var(--action-accent-contrast, #5eead4)",
              borderRadius: 8,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {startingInstructor ? t("home.instructor.starting") : t("home.instructor.start")}
          </button>
          <a
            href="#/manager/pitch-trainee"
            style={{
              minHeight: 48,
              paddingInline: 16,
              display: "inline-flex",
              alignItems: "center",
              background: "transparent",
              color: "var(--text-primary, #e8eef4)",
              border: "1px solid var(--border-default, #2a3a42)",
              borderRadius: 8,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("home.manager.open")}
          </a>
        </div>
      </section>

      <section style={{ marginBlockStart: 32 }}>
        <h2 style={{ fontSize: "var(--fs-md, 17px)" }}>{t("home.sessions.heading")}</h2>
        {sessions.length === 0 ? (
          <p style={{ color: "var(--text-secondary, #9aa7b8)" }}>{t("home.sessions.empty")}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
            {sessions.map((session) => (
              <li
                key={session.id}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "10px 14px",
                  border: "1px solid var(--border-default, #2a3a42)",
                  borderRadius: "var(--r-md, 8px)",
                }}
              >
                <span style={{ flex: 1 }}>
                  {session.scenarioSlug} · {session.traineeId ?? "—"} · v{session.scenarioVersion} ·{" "}
                  {t(`phase.${session.phase}`)}
                </span>
                <a
                  href={`#/instructor/${session.id}`}
                  style={{ fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}
                >
                  {t("home.sessions.openInstructor")}
                </a>
                <a
                  href={`#/station/${session.id}`}
                  style={{ fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}
                >
                  {t("home.sessions.openStation")}
                </a>
                <a href={`#/aar/${session.id}`} style={{ fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}>
                  {t("home.sessions.open")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
