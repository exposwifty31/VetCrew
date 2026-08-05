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

import { HttpError } from "./apiErrors.js";

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

function authHeaders(token: string | null | undefined): HeadersInit {
  if (token === null || token === undefined || token.length === 0) return {};
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(token: string | null | undefined): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...authHeaders(token),
  };
}

export async function fetchSessions(token?: string | null): Promise<SessionSummary[]> {
  const res = await fetch("/api/sessions", { headers: authHeaders(token) });
  if (!res.ok) throw new HttpError(res.status, "sessions");
  const body = (await res.json()) as { sessions: SessionSummary[] };
  return body.sessions;
}

export async function createSession(
  input: {
    scenarioSlug: string;
    traineeId?: string;
    seed?: number;
  },
  token?: string | null,
): Promise<{ id: string }> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new HttpError(res.status, "create session");
  const body = (await res.json()) as { session: { id: string } };
  return body.session;
}

export async function fetchAar(
  sessionId: string,
  token?: string | null,
): Promise<AarResponse> {
  const res = await fetch(`/api/sessions/${sessionId}/aar`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new HttpError(res.status, "aar");
  return (await res.json()) as AarResponse;
}

export async function fetchTraineeEvidence(
  traineeId: string,
  token?: string | null,
): Promise<TraineeEvidenceResponse> {
  const res = await fetch(`/api/trainees/${encodeURIComponent(traineeId)}/evidence`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new HttpError(res.status, "evidence");
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
  if (!res.ok) throw new HttpError(res.status, "trend");
  return (await res.json()) as TraineeTrendResponse;
}

export async function submitRatings(
  sessionId: string,
  raterId: string,
  ratings: { domain: AntsDomain; score: number; evidenceEventSeqs: number[] }[],
  token?: string | null,
): Promise<void> {
  const res = await fetch(`/api/sessions/${sessionId}/ratings`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify({ raterId, ratings }),
  });
  if (!res.ok) throw new HttpError(res.status, "ratings");
}
