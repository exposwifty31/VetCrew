import { useEffect, useMemo, useState } from "react";

import type { AntsDomain } from "@vetcrew/shared";

import { fetchAar, submitRatings, type AarResponse } from "../api.js";
import { errorMessageKeyFromUnknown } from "../apiErrors.js";
import AuthBar from "../components/AuthBar.js";
import {
  e2eOrNoBearerToken,
  hasClerkPublishableKey,
  useClerkBearerToken,
} from "../hooks/useBearerToken.js";
import { t, type MessageKey } from "../i18n/index.js";

/**
 * AAR replay viewer (vetcrew-realtime-ui, surface 3): reviewed after the
 * pressure is off — trades speed for depth. Light theme per design HANDOFF.
 * Scores are tied to timeline moments via evidence seqs, never a detached
 * report (CLAUDE.md §2.3) — and every evidence reference is clickable, so
 * "tied to the moment" is operable, not decorative.
 */

type Filter = "all" | "actions" | "injections" | "phases";
type SubmitState = "idle" | "invalid" | "saving" | "saved" | "error";

/** Layer A channel identity — resolved from theme-scoped tokens, never hardcoded. */
function channelColor(name: string): string {
  return `var(--ch-${name}, var(--text-muted))`;
}

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
    return { name, d: points, color: channelColor(name) };
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
          <span key={name} style={{ color: channelColor(name), fontWeight: 600 }}>
            {name.toUpperCase()}: {(nearest.vitals[name] ?? 0).toFixed(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Clickable evidence reference: jumps to (and highlights) the timeline entry. */
function SeqLink({ seq, onJump }: { seq: number; onJump: (seq: number) => void }) {
  return (
    <button
      onClick={() => onJump(seq)}
      aria-label={t("aar.checklist.evidenceJump", { seq })}
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--r-sm, 4px)",
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
        padding: "4px 8px",
        minHeight: 32,
        fontVariantNumeric: "tabular-nums",
        textDecoration: "underline",
      }}
    >
      #{seq}
    </button>
  );
}

export default function AarPage({ sessionId }: { sessionId: string }) {
  if (hasClerkPublishableKey) {
    return <AarPageWithClerk sessionId={sessionId} />;
  }
  return <AarPageBody sessionId={sessionId} getToken={e2eOrNoBearerToken} />;
}

function AarPageWithClerk({ sessionId }: { sessionId: string }) {
  const getToken = useClerkBearerToken();
  return <AarPageBody sessionId={sessionId} getToken={getToken} />;
}

function AarPageBody({
  sessionId,
  getToken,
}: {
  sessionId: string;
  getToken: () => Promise<string | null>;
}) {
  const [data, setData] = useState<AarResponse | null>(null);
  const [loadError, setLoadError] = useState<MessageKey | null>(null);
  const [scrubMs, setScrubMs] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [raterId, setRaterId] = useState("");
  const [activeDomain, setActiveDomain] = useState<AntsDomain | null>(null);
  // Per-domain evidence (audit blocker B2): each ANTS domain carries its OWN
  // event citations — a shared set would hollow out per-domain traceability.
  const [evidenceByDomain, setEvidenceByDomain] = useState<
    Partial<Record<AntsDomain, readonly number[]>>
  >({});
  const [scores, setScores] = useState<Partial<Record<AntsDomain, number>>>({});
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [highlightSeq, setHighlightSeq] = useState<number | null>(null);

  // The AAR is a light-theme surface (design HANDOFF); restore dark on leave.
  useEffect(() => {
    document.documentElement.dataset["theme"] = "light";
    return () => {
      document.documentElement.dataset["theme"] = "dark";
    };
  }, []);

  // Reset every session-scoped field when the route changes — AarPage is
  // reused across hash navigations, so stale rater/evidence/scores must not
  // bleed into the next session.
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoadError(null);
    setScrubMs(0);
    setFilter("all");
    setRaterId("");
    setActiveDomain(null);
    setEvidenceByDomain({});
    setScores({});
    setSubmitState("idle");
    setHighlightSeq(null);
    void (async () => {
      try {
        const token = await getToken();
        const d = await fetchAar(sessionId, token);
        if (cancelled) return;
        setData(d);
        setScrubMs(d.aar.durationMs);
        setActiveDomain(d.scenario.scoringDimensions[0] ?? null);
      } catch (err) {
        if (!cancelled) setLoadError(errorMessageKeyFromUnknown(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, getToken]);

  useEffect(() => {
    if (highlightSeq === null) return;
    document
      .getElementById(`evt-${highlightSeq}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = setTimeout(() => setHighlightSeq(null), 2500);
    return () => clearTimeout(timer);
  }, [highlightSeq]);

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
    for (const item of data?.tasks.results ?? []) {
      if (!item.passed) for (const seq of item.evidenceSeqs) seqs.add(seq);
    }
    return seqs;
  }, [data]);

  if (loadError !== null) {
    return (
      <main style={{ padding: 32 }}>
        <AuthBar />
        <p role="alert">{t(loadError)}</p>
        <a href="#/" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
          {t("aar.back")}
        </a>
      </main>
    );
  }
  if (data === null) {
    return (
      <main style={{ padding: 32 }}>
        <AuthBar />
        <p>{t("aar.loading")}</p>
      </main>
    );
  }

  const { session, scenario, aar, checklist, tasks, ratings } = data;

  const visible = aar.timeline.filter((entry) => {
    if (entry.type === "tick") return false;
    if (filter === "actions") return entry.type === "action";
    if (filter === "injections") return entry.type === "injection";
    if (filter === "phases") return entry.type === "phase_change";
    return true;
  });

  const jumpToSeq = (seq: number) => {
    setFilter("all");
    setHighlightSeq(seq);
  };

  const activeEvidence = activeDomain === null ? [] : evidenceByDomain[activeDomain] ?? [];

  const toggleEvidence = (seq: number) => {
    if (activeDomain === null) return;
    setEvidenceByDomain((prev) => {
      const current = new Set(prev[activeDomain] ?? []);
      if (current.has(seq)) current.delete(seq);
      else current.add(seq);
      return { ...prev, [activeDomain]: [...current].sort((a, b) => a - b) };
    });
  };

  const submit = async () => {
    const targetSessionId = session.id;
    const complete =
      raterId.trim().length > 0 &&
      scenario.scoringDimensions.every(
        (domain) =>
          scores[domain] !== undefined && (evidenceByDomain[domain]?.length ?? 0) > 0,
      );
    if (!complete) {
      setSubmitState("invalid");
      return;
    }
    setSubmitState("saving");
    try {
      const token = await getToken();
      await submitRatings(
        targetSessionId,
        raterId.trim(),
        scenario.scoringDimensions.map((domain) => ({
          domain,
          score: scores[domain] ?? 0,
          evidenceEventSeqs: [...(evidenceByDomain[domain] ?? [])],
        })),
        token,
      );
    } catch {
      // Ignore if the user navigated away mid-submit.
      if (targetSessionId === sessionId) setSubmitState("error");
      return;
    }
    // The rating is saved; a failed refresh must not mask that outcome.
    if (targetSessionId !== sessionId) return;
    setSubmitState("saved");
    try {
      const token = await getToken();
      const refreshed = await fetchAar(targetSessionId, token);
      if (targetSessionId === sessionId) setData(refreshed);
    } catch {
      // stale view is acceptable — the stored ratings render on next load
    }
  };

  const canRate = session.phase === "debrief";

  return (
    <main style={{ maxWidth: 860, marginInline: "auto", padding: 24 }}>
      <AuthBar />
      <a
        href="#/"
        style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", minHeight: 44 }}
      >
        {/* RTL: "back" points toward the start edge, which is the right. */}
        → {t("aar.back")}
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

      {/* The checklist verdict leads (audit): the score and its failed items
          are what a manager opens this page for; the chart supports them. */}
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
                alignItems: "center",
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
              <span
                style={{
                  color: "var(--text-muted)",
                  fontVariantNumeric: "tabular-nums",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                ×{item.weight}
                {item.evidenceSeqs.length > 0 && (
                  <>
                    <span>· {t("aar.checklist.evidenceLabel")}</span>
                    {item.evidenceSeqs.map((seq) => (
                      <SeqLink key={seq} seq={seq} onJump={jumpToSeq} />
                    ))}
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {tasks.totalCount > 0 && (
        <section style={card}>
          <h2>{t("aar.tasks.heading")}</h2>
          <p style={{ fontWeight: 700 }}>
            {t("aar.tasks.score", {
              passed: tasks.passedCount,
              total: tasks.totalCount,
            })}
          </p>
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 8 }}>
            {tasks.results.map((item) => (
              <li
                key={`${item.taskId}:${item.dimension}`}
                style={{
                  display: "grid",
                  gap: 4,
                  padding: "8px 12px",
                  borderRadius: "var(--r-sm, 4px)",
                  background: item.passed ? "var(--bg-running-subtle)" : "var(--bg-critical-subtle)",
                  border: `1px solid ${item.passed ? "var(--border-running-subtle)" : "var(--border-critical-subtle)"}`,
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <strong style={{ color: item.passed ? "var(--text-running)" : "var(--text-critical)" }}>
                    {item.passed ? t("aar.checklist.pass") : t("aar.checklist.fail")}
                    {item.critical ? ` · ${t("aar.tasks.critical")}` : ""}
                  </strong>
                  <span style={{ flex: 1 }}>{item.labelHe}</span>
                  {item.evidenceSeqs.length > 0 && (
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontVariantNumeric: "tabular-nums",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <span>{t("aar.checklist.evidenceLabel")}</span>
                      {item.evidenceSeqs.map((seq) => (
                        <SeqLink key={seq} seq={seq} onJump={jumpToSeq} />
                      ))}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "var(--fs-sm, 14px)" }}>
                  {t("aar.tasks.expectedVsActual", {
                    expected: item.expectedHe,
                    actual: item.actualHe ?? t("aar.tasks.notAttempted"),
                  })}
                </p>
              </li>
            ))}
          </ul>
        </section>
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
            const isHighlighted = highlightSeq === entry.seq;
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
                id={`evt-${entry.seq}`}
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
                  outline: isHighlighted ? "2px solid var(--text-primary, #333)" : "none",
                  outlineOffset: 1,
                }}
              >
                {entry.type === "action" && canRate && (
                  /* 44px touch target (tablet-first); the visible box stays 24px. */
                  <label
                    style={{
                      width: 44,
                      height: 44,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={activeEvidence.includes(entry.seq)}
                      onChange={() => toggleEvidence(entry.seq)}
                      style={{ width: 24, height: 24 }}
                      aria-label={t("aar.timeline.evidenceFor", {
                        seq: entry.seq,
                        domain: t(`ants.${activeDomain ?? "task_management"}` as MessageKey),
                      })}
                    />
                  </label>
                )}
                <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--text-muted)", minWidth: 48 }}>
                  {formatTime(entry.timeMs)}
                </span>
                <span style={{ flex: 1 }}>{label}</span>
                {isFailedEvidence && (
                  /* Non-hue signal (CVD-safe): failed evidence carries a label, not just a tint. */
                  <span
                    style={{
                      color: "var(--text-critical)",
                      fontWeight: 700,
                      fontSize: "var(--fs-xs, 13px)",
                      border: "1px solid var(--border-critical-subtle)",
                      borderRadius: 999,
                      padding: "2px 10px",
                    }}
                  >
                    {t("aar.timeline.evidenceBadge")}
                  </span>
                )}
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
              <li
                key={rating.id}
                style={{
                  fontVariantNumeric: "tabular-nums",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span>
                  {t("aar.ratings.row", {
                    domain: t(`ants.${rating.domain}`),
                    score: rating.score,
                  })}
                </span>
                <span style={{ color: "var(--text-muted)" }}>
                  · {t("aar.ratings.by", { rater: rating.raterId })} · {t("aar.checklist.evidenceLabel")}
                </span>
                {rating.evidenceEventSeqs.map((seq) => (
                  <SeqLink key={seq} seq={seq} onJump={jumpToSeq} />
                ))}
              </li>
            ))}
          </ul>
        </section>
      ) : canRate ? (
        <section style={card}>
          <h2>{t("aar.rating.heading")}</h2>
          <p style={{ color: "var(--text-secondary)" }}>{t("aar.rating.formative")}</p>
          <p style={{ color: "var(--text-muted)" }}>{t("aar.rating.evidenceHint")}</p>
          <label style={{ display: "flex", alignItems: "center", gap: 12, marginBlockEnd: 12 }}>
            <span style={{ minWidth: 140 }}>{t("aar.rating.rater")}</span>
            <input
              type="text"
              value={raterId}
              onChange={(e) => setRaterId(e.target.value)}
              style={{
                minHeight: 44,
                padding: "8px 12px",
                borderRadius: "var(--r-sm, 4px)",
                border: "1px solid var(--border-default)",
                background: "transparent",
                color: "inherit",
                flex: 1,
                maxWidth: 320,
              }}
            />
          </label>
          <div style={{ display: "grid", gap: 12 }}>
            {scenario.scoringDimensions.map((domain) => {
              const isActive = activeDomain === domain;
              const count = evidenceByDomain[domain]?.length ?? 0;
              return (
                <div key={domain} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setActiveDomain(domain)}
                    aria-pressed={isActive}
                    style={{
                      minWidth: 160,
                      minHeight: 44,
                      padding: "6px 12px",
                      borderRadius: "var(--r-sm, 4px)",
                      border: isActive
                        ? "2px solid var(--text-primary, #333)"
                        : "1px solid var(--border-default)",
                      background: isActive ? "var(--surface-card-hover)" : "transparent",
                      fontWeight: isActive ? 700 : 400,
                      cursor: "pointer",
                      textAlign: "start",
                    }}
                  >
                    {t(`ants.${domain}`)}
                  </button>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        onClick={() => setScores((prev) => ({ ...prev, [domain]: value }))}
                        aria-pressed={scores[domain] === value}
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
                  <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {t("aar.rating.domainEvidence", { count })}
                  </span>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => void submit()}
            disabled={submitState === "saving"}
            style={{
              marginBlockStart: 16,
              padding: "12px 24px",
              minHeight: 44,
              borderRadius: "var(--r-sm, 4px)",
              border: "1px solid var(--border-default)",
              background: "var(--surface-card-hover)",
              fontWeight: 700,
              cursor: submitState === "saving" ? "wait" : "pointer",
              opacity: submitState === "saving" ? 0.6 : 1,
            }}
          >
            {submitState === "saving" ? t("aar.rating.saving") : t("aar.rating.submit")}
          </button>
          {submitState === "invalid" && (
            <p style={{ color: "var(--text-critical)" }}>{t("aar.rating.incomplete")}</p>
          )}
          {submitState === "error" && (
            <p role="alert" style={{ color: "var(--text-critical)" }}>
              {t("aar.rating.error")}
            </p>
          )}
          {submitState === "saved" && (
            <p role="status" aria-live="polite" style={{ color: "var(--text-running)" }}>
              {t("aar.rating.submitted")}
            </p>
          )}
        </section>
      ) : (
        <section style={card}>
          <h2>{t("aar.rating.heading")}</h2>
          <p style={{ color: "var(--text-secondary)" }}>{t("aar.rating.notDebrief")}</p>
        </section>
      )}
    </main>
  );
}
