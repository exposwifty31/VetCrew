import type {
  AarModel,
  ChecklistResult,
  SessionPhase,
  TaskEvaluation,
} from "@vetcrew/engine";
import type {
  AntsDomain,
  TraineeEvidenceResponse,
  TraineeTrendResponse,
} from "@vetcrew/shared";

export type { TraineeEvidenceResponse, TraineeTrendResponse };

/** Typed client for the session API (proxied /api → server). */

export interface SessionSummary {
  id: string;
  scenarioSlug: string;
  scenarioVersion: string;
  phase: SessionPhase;
  traineeId: string | null;
  createdAt: string;
}

export interface AarResponse {
  session: {
    id: string;
    phase: SessionPhase;
    seed: number;
    traineeId: string | null;
    traineeTimeInTrainingDays: number | null;
    scenarioVersion: string;
  };
  scenario: {
    slug: string;
    version: string;
    title: string;
    titleHe: string;
    clinicallyReviewed: boolean;
    actions: { id: string; label: string; labelHe: string }[];
    scoringDimensions: AntsDomain[];
  };
  aar: {
    durationMs: number;
    timeline: AarModel["timeline"];
    vitalsSeries: AarModel["vitalsSeries"];
    finalPhase: SessionPhase;
  };
  checklist: ChecklistResult;
  tasks: TaskEvaluation;
  ratings: {
    id: string;
    raterId: string;
    domain: AntsDomain;
    score: number;
    evidenceEventSeqs: number[];
  }[];
}

export async function fetchSessions(): Promise<SessionSummary[]> {
  const res = await fetch("/api/sessions");
  if (!res.ok) throw new Error(`sessions: ${res.status}`);
  const body = (await res.json()) as { sessions: SessionSummary[] };
  return body.sessions;
}

export async function createSession(input: {
  scenarioSlug: string;
  traineeId?: string;
  traineeTimeInTrainingDays?: number;
  seed?: number;
}): Promise<{ id: string }> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`create session: ${res.status}`);
  const body = (await res.json()) as { session: { id: string } };
  return body.session;
}

export async function fetchAar(sessionId: string): Promise<AarResponse> {
  const res = await fetch(`/api/sessions/${sessionId}/aar`);
  if (!res.ok) throw new Error(`aar: ${res.status}`);
  return (await res.json()) as AarResponse;
}

function authHeaders(token: string | null | undefined): HeadersInit {
  if (token === null || token === undefined || token.length === 0) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function fetchTraineeEvidence(
  traineeId: string,
  token?: string | null,
): Promise<TraineeEvidenceResponse> {
  const res = await fetch(`/api/trainees/${encodeURIComponent(traineeId)}/evidence`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`evidence: ${res.status}`);
  return (await res.json()) as TraineeEvidenceResponse;
}

export async function fetchTraineeTrend(
  traineeId: string,
  options?: { scenarioSlug?: string; token?: string | null },
): Promise<TraineeTrendResponse> {
  const qs =
    options?.scenarioSlug === undefined
      ? ""
      : `?scenarioSlug=${encodeURIComponent(options.scenarioSlug)}`;
  const res = await fetch(`/api/trainees/${encodeURIComponent(traineeId)}/trend${qs}`, {
    headers: authHeaders(options?.token),
  });
  if (!res.ok) throw new Error(`trend: ${res.status}`);
  return (await res.json()) as TraineeTrendResponse;
}

export async function submitRatings(
  sessionId: string,
  raterId: string,
  ratings: { domain: AntsDomain; score: number; evidenceEventSeqs: number[] }[],
): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/ratings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raterId, ratings }),
  });
  if (!res.ok) throw new Error(`ratings: ${res.status}`);
}
