import { useEffect, useState } from "react";

import {
  fetchTraineeEvidence,
  fetchTraineeTrend,
  type TraineeEvidenceResponse,
  type TraineeTrendResponse,
} from "../api.js";
import { t, type MessageKey } from "../i18n/index.js";

/**
 * Manager Evidence Desk (Sprint 5a) — within-person evidence + trend only.
 * Same Reflective register as AAR. No hiring verdicts / readiness bands.
 */

const card: React.CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--r-md, 8px)",
  padding: 16,
  marginBlockStart: 16,
};

function driftKey(drift: TraineeTrendResponse["overallDrift"]): MessageKey {
  switch (drift) {
    case "up":
      return "manager.trend.drift.up";
    case "down":
      return "manager.trend.drift.down";
    case "none":
      return "manager.trend.drift.none";
    default: {
      const exhaustive: never = drift;
      throw new Error(`Unhandled drift: ${String(exhaustive)}`);
    }
  }
}

function hintDirectionKey(
  direction: TraineeTrendResponse["domainHints"][number]["direction"],
): MessageKey {
  switch (direction) {
    case "up":
      return "manager.trend.hint.up";
    case "down":
      return "manager.trend.hint.down";
    case "flat":
      return "manager.trend.hint.flat";
    default: {
      const exhaustive: never = direction;
      throw new Error(`Unhandled hint: ${String(exhaustive)}`);
    }
  }
}

export default function ManagerEvidencePage({
  traineeId,
  focus = "evidence",
}: {
  traineeId: string;
  focus?: "evidence" | "trend";
}) {
  const [evidence, setEvidence] = useState<TraineeEvidenceResponse | null | "error">(null);
  const [trend, setTrend] = useState<TraineeTrendResponse | null | "error">(null);
  const [showInternal, setShowInternal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEvidence(null);
    setTrend(null);
    Promise.all([fetchTraineeEvidence(traineeId), fetchTraineeTrend(traineeId)])
      .then(([ev, tr]) => {
        if (cancelled) return;
        setEvidence(ev);
        setTrend(tr);
        // Pitch reality: nothing is clinically reviewed yet — surface internal
        // rows with the badge rather than an empty desk.
        const hasReviewed = ev.sessions.some((s) => s.clinicallyReviewed);
        if (!hasReviewed && ev.sessions.length > 0) setShowInternal(true);
      })
      .catch(() => {
        if (cancelled) return;
        setEvidence("error");
        setTrend("error");
      });
    return () => {
      cancelled = true;
    };
  }, [traineeId]);

  if (evidence === null || trend === null) {
    return (
      <main style={{ maxWidth: 720, marginInline: "auto", padding: 24 }}>
        <p>{t("manager.loading")}</p>
      </main>
    );
  }
  if (evidence === "error" || trend === "error") {
    return (
      <main style={{ maxWidth: 720, marginInline: "auto", padding: 24 }}>
        <p>{t("manager.error")}</p>
        <a href="#/">{t("manager.back")}</a>
      </main>
    );
  }

  const visibleSessions = showInternal
    ? evidence.sessions
    : evidence.sessions.filter((s) => s.clinicallyReviewed);
  const hiddenInternalCount = evidence.sessions.length - visibleSessions.length;

  return (
    <main style={{ maxWidth: 720, marginInline: "auto", padding: 24 }}>
      <a href="#/" style={{ fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}>
        {t("manager.back")}
      </a>
      <h1 style={{ fontSize: "var(--fs-xl, 28px)", marginBlockEnd: 4 }}>{t("manager.title")}</h1>
      <p style={{ color: "var(--text-secondary)", marginBlockStart: 0 }}>
        {t("manager.subtitle", { trainee: traineeId })}
      </p>

      <p
        style={{
          ...card,
          marginBlockStart: 12,
          background: "var(--bg-elevated-subtle)",
          borderColor: "var(--border-elevated-subtle)",
          fontWeight: 600,
        }}
      >
        {t("manager.trust.strip")}
      </p>

      <section style={card} aria-labelledby={focus === "trend" ? "trend-h" : "evidence-h"}>
        <h2 id="trend-h">{t("manager.trend.heading")}</h2>
        <p style={{ color: "var(--text-secondary)" }}>{t("manager.trend.bandWithheld")}</p>
        <p style={{ fontWeight: 700 }}>{t(driftKey(trend.overallDrift))}</p>
        {trend.series.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("manager.trend.empty")}</p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {trend.series.map((point) => (
              <li
                key={point.sessionId}
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--r-sm, 4px)",
                }}
              >
                {t("manager.trend.point", {
                  days: point.timeInTrainingDays,
                  tech: point.technicalPercent,
                  ants: point.overallAnts ?? "—",
                })}
              </li>
            ))}
          </ul>
        )}
        {trend.domainHints.length > 0 && (
          <div style={{ marginBlockStart: 12 }}>
            <p style={{ fontWeight: 600 }}>{t("manager.trend.hintsHeading")}</p>
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 6 }}>
              {trend.domainHints.map((hint) => (
                <li key={hint.domain} style={{ color: "var(--text-secondary)" }}>
                  {t("manager.trend.hintRow", {
                    domain: t(`ants.${hint.domain}` as MessageKey),
                    direction: t(hintDirectionKey(hint.direction)),
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section style={card}>
        <h2 id="evidence-h">{t("manager.evidence.heading")}</h2>
        <p style={{ color: "var(--text-secondary)" }}>{t("manager.evidence.blurb")}</p>
        {hiddenInternalCount > 0 && (
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginBlock: 12 }}>
            <input
              type="checkbox"
              checked={showInternal}
              onChange={(e) => setShowInternal(e.target.checked)}
            />
            {t("manager.evidence.showInternal", { count: hiddenInternalCount })}
          </label>
        )}
        {visibleSessions.length === 0 ? (
          <p style={{ color: "var(--text-secondary)" }}>{t("manager.evidence.empty")}</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
            {visibleSessions.map((session) => (
              <li
                key={session.sessionId}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  alignItems: "center",
                  padding: "12px 14px",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--r-md, 8px)",
                }}
              >
                <span style={{ flex: 1, minWidth: 200 }}>
                  {session.scenarioSlug} · v{session.scenarioVersion} ·{" "}
                  {t("manager.evidence.tit", { days: session.traineeTimeInTrainingDays })} ·{" "}
                  {t("manager.evidence.tech", { percent: session.technicalPercent })} ·{" "}
                  {t("manager.evidence.ants", {
                    score: session.overallAnts ?? "—",
                  })}
                  {!session.clinicallyReviewed && (
                    <>
                      {" "}
                      · <strong>{t("manager.evidence.internalBadge")}</strong>
                    </>
                  )}
                </span>
                <a
                  href={`#/aar/${session.sessionId}`}
                  style={{ fontWeight: 700, minHeight: 44, display: "inline-flex", alignItems: "center" }}
                >
                  {t("manager.evidence.openAar")}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
