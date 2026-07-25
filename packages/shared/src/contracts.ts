import { z } from "zod";

import { taskSubmissionSchema } from "./tasks.js";

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

export const taskStartEventSchema = baseEvent.extend({
  type: z.literal("task_start"),
  role: z.string().min(1),
  actorId: z.string().min(1),
  taskId: z.string().min(1),
});

export const taskSubmitEventSchema = baseEvent.extend({
  type: z.literal("task_submit"),
  role: z.string().min(1),
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  submission: taskSubmissionSchema,
});

export const engineEventSchema = z.discriminatedUnion("type", [
  tickEventSchema,
  actionEventSchema,
  injectionEventSchema,
  phaseChangeEventSchema,
  taskStartEventSchema,
  taskSubmitEventSchema,
]);

export type EngineEventWire = z.infer<typeof engineEventSchema>;
