import { z } from "zod";

/**
 * Wire contracts shared by server and clients. These mirror the engine's
 * event types (packages/engine/src/events.ts) — the engine stays zero-dep,
 * so the zod schemas live here, and a test keeps the two in sync.
 */

export const sessionPhaseSchema = z.enum([
  "draft",
  "briefing",
  "running",
  "paused",
  "debrief",
  "scored",
  "archived",
]);

export type SessionPhase = z.infer<typeof sessionPhaseSchema>;

const baseEvent = z.object({
  seq: z.number().int().positive(),
});

export const tickEventSchema = baseEvent.extend({
  type: z.literal("tick"),
  dtMs: z.number().int().positive(),
});

export const actionEventSchema = baseEvent.extend({
  type: z.literal("action"),
  role: z.string().min(1),
  actorId: z.string().min(1),
  action: z.string().min(1),
  payload: z.unknown().optional(),
});

export const injectionEventSchema = baseEvent.extend({
  type: z.literal("injection"),
  injection: z.string().min(1),
});

export const phaseChangeEventSchema = baseEvent.extend({
  type: z.literal("phase_change"),
  phase: sessionPhaseSchema,
});

export const engineEventSchema = z.discriminatedUnion("type", [
  tickEventSchema,
  actionEventSchema,
  injectionEventSchema,
  phaseChangeEventSchema,
]);

export type EngineEventWire = z.infer<typeof engineEventSchema>;
