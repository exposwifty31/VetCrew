import { useEffect, useMemo, useState } from "react";

import type { AntsDomain } from "@vetcrew/shared";

import { fetchAar, submitRatings, type AarResponse } from "../api.js";
import { t, type MessageKey } from "../i18n/index.js";

/**
 * AAR replay viewer (vetcrew-realtime-ui, surface 3): reviewed after the
 * pressure is off — trades speed for depth. Light theme per design HANDOFF.
 * Scores are tied to timeline moments via evidence seqs, never a detached
 * report (CLAUDE.md §2.3).
 */

type Filter = "all" | "actions" | "injections" | "phases";

// Channel colours (identity, never severity — CLAUDE.md §4). Values chosen
// for >=4.5:1 contrast as legend text on the light AAR card surface.
const VITAL_COLORS: Record<string, string> = {
  hr: "#087a33",
  spo2: "#0077b6",
  rr: "#b45309",
};

function formatTime(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

const card: React.CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--r-md, 8px)",
  padding: 16,
  marginBlockStart: 16,
};

function VitalsChart({
  aar,
  scrubMs,
}: {
  aar: AarResponse["aar"];
  scrubMs: number;
}) {
  const width = 600;
  const height = 150;
  const series = aar.vitalsSeries;
  const names = Object.keys(series[0]?.vitals ?? {});

  const paths = names.map((name) => {
    const values = series.map((s) => s.vitals[name] ?? 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const points = series
      .map((s, i) => {
        const x = aar.durationMs === 0 ? 0 : (s.timeMs / aar.durationMs) * width;
        const y = height - (((s.vitals[name] ?? 0) - min) / span) * (height - 20) - 10;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return { name, d: points, color: VITAL_COLORS[name] ?? "var(--text-muted)" };
  });

  const nearest = series.reduce(
    (best, s) => (Math.abs(s.timeMs - scrubMs) < Math.abs(best.timeMs - scrubMs) ? s : best),
    series[0] ?? { timeMs: 0, vitals: {} },
  );
  const scrubX = aar.durationMs === 0 ? 0 : (scrubMs / aar.durationMs) * width;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", direction: "ltr" }}
        role="img"
        aria-label={t("aar.vitals.heading")}
      >
        {paths.map((p) => (
          <path key={p.name} d={p.d} fill="none" stroke={p.color} strokeWidth={2} />
        ))}
        <line x1={scrubX} x2={scrubX} y1={0} y2={height} stroke="var(--text-muted)" strokeDasharray="4 3" />
      </svg>
      <div style={{ display: "flex", gap: 16, fontVariantNumeric: "tabular-nums" }}>
        {names.map((name) => (
          <span key={name} style={{ color: VITAL_COLORS[name] ?? "inherit", fontWeight: 600 }}>
            {name.toUpperCase()}: {(nearest.vitals[name] ?? 0).toFixed(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AarPage({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<AarResponse | null>(null);
  const [error, setError] = useState(false);
  const [scrubMs, setScrubMs] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [evidence, setEvidence] = useState<Set<number>>(new Set());
  const [scores, setScores] = useState<Partial<Record<AntsDomain, number>>>({});
  const [submitState, setSubmitState] = useState<"idle" | "invalid" | "saved">("idle");

  // The AAR is a light-theme surface (design HANDOFF); restore dark on leave.
  useEffect(() => {
    document.documentElement.dataset["theme"] = "light";
    return () => {
      document.documentElement.dataset["theme"] = "dark";
    };
  }, []);

  useEffect(() => {
    fetchAar(sessionId)
      .then((d) => {
        setData(d);
        setScrubMs(d.aar.durationMs);
      })
      .catch(() => setError(true));
  }, [sessionId]);

  const actionLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const action of data?.scenario.actions ?? []) {
      map.set(action.id, action.labelHe);
    }
    return map;
  }, [data]);

  const failedEvidenceSeqs = useMemo(() => {
    const seqs = new Set<number>();
    for (const item of data?.checklist.items ?? []) {
      if (!item.passed) for (const seq of item.evidenceSeqs) seqs.add(seq);
    }
    return seqs;
  }, [data]);

  if (error) return <main style={{ padding: 32 }}>{t("aar.error")}</main>;
  if (data === null) return <main style={{ padding: 32 }}>{t("aar.loading")}</main>;

  const { session, scenario, aar, checklist, ratings } = data;

  const visible = aar.timeline.filter((entry) => {
    if (entry.type === "tick") return false;
    if (filter === "actions") return entry.type === "action";
    if (filter === "injections") return entry.type === "injection";
    if (filter === "phases") return entry.type === "phase_change";
    return true;
  });

  const toggleEvidence = (seq: number) => {
    setEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(seq)) next.delete(seq);
      else next.add(seq);
      return next;
    });
  };

  const submit = async () => {
    const missing = scenario.scoringDimensions.some((domain) => scores[domain] === undefined);
    if (missing || evidence.size === 0) {
      setSubmitState("invalid");
      return;
    }
    await submitRatings(
      session.id,
      "instructor-dev",
      scenario.scoringDimensions.map((domain) => ({
        domain,
        score: scores[domain] ?? 0,
        evidenceEventSeqs: [...evidence].sort((a, b) => a - b),
      })),
    );
    setSubmitState("saved");
    const refreshed = await fetchAar(sessionId);
    setData(refreshed);
  };

  return (
    <main style={{ maxWidth: 860, marginInline: "auto", padding: 24 }}>
      <a href="#/" style={{ color: "var(--text-secondary)" }}>
        ← {t("aar.back")}
      </a>
      <h1 style={{ marginBlockEnd: 0 }}>{scenario.titleHe}</h1>
      <p style={{ color: "var(--text-secondary)", marginBlockStart: 4 }}>
        {t(`phase.${session.phase}`)} · {t("aar.header.trainee", { id: session.traineeId ?? "—" })} ·{" "}
        {t("aar.header.timeInTraining", { days: session.traineeTimeInTrainingDays ?? 0 })} ·{" "}
        {t("aar.header.scenarioVersion", { version: session.scenarioVersion })} ·{" "}
        {t("aar.header.seed", { seed: session.seed })}
      </p>
      {!scenario.clinicallyReviewed && (
        <p
          style={{
            background: "var(--bg-elevated-subtle)",
            border: "1px solid var(--border-elevated-subtle)",
            color: "var(--text-elevated)",
            borderRadius: "var(--r-sm, 4px)",
            padding: "8px 12px",
            fontWeight: 600,
          }}
        >
          {t("aar.unreviewed.warning")}
        </p>
      )}

      <section style={card}>
        <h2>{t("aar.vitals.heading")}</h2>
        <VitalsChart aar={aar} scrubMs={scrubMs} />
        <label style={{ display: "block", marginBlockStart: 8 }}>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {t("aar.vitals.scrub", { time: formatTime(scrubMs) })}
          </span>
          <input
            type="range"
            min={0}
            max={aar.durationMs}
            step={1000}
            value={scrubMs}
            onChange={(e) => setScrubMs(Number(e.target.value))}
            style={{ width: "100%", direction: "ltr" }}
          />
        </label>
      </section>

      <section style={card}>
        <h2>{t("aar.checklist.heading")}</h2>
        <p style={{ fontWeight: 700 }}>
          {t("aar.checklist.score", {
            score: checklist.score,
            max: checklist.maxScore,
            percent: checklist.percent,
          })}
        </p>
        <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
          {checklist.items.map((item) => (
            <li
              key={item.id}
              style={{
                display: "flex",
                gap: 12,
                alignItems: "baseline",
                padding: "8px 12px",
                borderRadius: "var(--r-sm, 4px)",
                background: item.passed ? "var(--bg-running-subtle)" : "var(--bg-critical-subtle)",
                border: `1px solid ${item.passed ? "var(--border-running-subtle)" : "var(--border-critical-subtle)"}`,
              }}
            >
              <strong style={{ color: item.passed ? "var(--text-running)" : "var(--text-critical)" }}>
                {item.passed ? t("aar.checklist.pass") : t("aar.checklist.fail")}
              </strong>
              <span style={{ flex: 1 }}>{item.label}</span>
              <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                ×{item.weight}
                {item.evidenceSeqs.length > 0 &&
                  ` · ${t("aar.checklist.evidence", { seqs: item.evidenceSeqs.join(", ") })}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section style={card}>
        <h2>{t("aar.timeline.heading")}</h2>
        <div style={{ display: "flex", gap: 8, marginBlockEnd: 12 }}>
          {(["all", "actions", "injections", "phases"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "6px 14px",
                borderRadius: 999,
                border: "1px solid var(--border-default)",
                background: filter === f ? "var(--surface-card-hover)" : "transparent",
                fontWeight: filter === f ? 700 : 400,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              {t(`aar.filter.${f}`)}
            </button>
          ))}
        </div>
        <ol style={{ listStyle: "none", padding: 0, display: "grid", gap: 6 }}>
          {visible.map((entry) => {
            const isFailedEvidence = failedEvidenceSeqs.has(entry.seq);
            const label =
              entry.type === "action"
                ? actionLabels.get(entry.action ?? "") ?? entry.action
                : entry.type === "injection"
                  ? t("aar.event.injection", { name: entry.injection ?? "" })
                  : t("aar.event.phase", {
                      phase: t(`phase.${entry.phase ?? "draft"}` as MessageKey),
                    });
            return (
              <li
                key={entry.seq}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  padding: "6px 12px",
                  borderRadius: "var(--r-sm, 4px)",
                  border: isFailedEvidence
                    ? "1px solid var(--border-critical-subtle)"
                    : "1px solid transparent",
                  background: isFailedEvidence ? "var(--bg-critical-subtle)" : "transparent",
                }}
              >
                {entry.type === "action" && session.phase !== "scored" && (
                  <input
                    type="checkbox"
                    checked={evidence.has(entry.seq)}
                    onChange={() => toggleEvidence(entry.seq)}
                    style={{ width: 20, height: 20 }}
                    aria-label={`evidence-${entry.seq}`}
                  />
                )}
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", minWidth: 48 }}>
                  {formatTime(entry.timeMs)}
                </span>
                <span style={{ flex: 1 }}>{label}</span>
                <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                  #{entry.seq}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {ratings.length > 0 ? (
        <section style={card}>
          <h2>{t("aar.ratings.heading")}</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 6 }}>
            {ratings.map((rating) => (
              <li key={rating.id} style={{ fontVariantNumeric: "tabular-nums" }}>
                {t("aar.ratings.row", {
                  domain: t(`ants.${rating.domain}`),
                  score: rating.score,
                  seqs: rating.evidenceEventSeqs.join(", "),
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section style={card}>
          <h2>{t("aar.rating.heading")}</h2>
          <p style={{ color: "var(--text-secondary)" }}>{t("aar.rating.formative")}</p>
          <p style={{ color: "var(--text-muted)" }}>
            {t("aar.rating.evidenceHint")} · {t("aar.rating.selected", { count: evidence.size })}
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {scenario.scoringDimensions.map((domain) => (
              <div key={domain} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ minWidth: 140 }}>{t(`ants.${domain}`)}</span>
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => setScores((prev) => ({ ...prev, [domain]: value }))}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "var(--r-sm, 4px)",
                        border: "1px solid var(--border-default)",
                        background:
                          scores[domain] === value ? "var(--surface-card-hover)" : "transparent",
                        fontWeight: scores[domain] === value ? 700 : 400,
                        cursor: "pointer",
                      }}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => void submit()}
            style={{
              marginBlockStart: 16,
              padding: "12px 24px",
              minHeight: 44,
              borderRadius: "var(--r-sm, 4px)",
              border: "1px solid var(--border-default)",
              background: "var(--surface-card-hover)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t("aar.rating.submit")}
          </button>
          {submitState === "invalid" && (
            <p style={{ color: "var(--text-critical)" }}>{t("aar.rating.incomplete")}</p>
          )}
          {submitState === "saved" && (
            <p style={{ color: "var(--text-running)" }}>{t("aar.rating.submitted")}</p>
          )}
        </section>
      )}
    </main>
  );
}
