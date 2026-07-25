import { z } from "zod";

import { sessionPhaseSchema } from "./contracts.js";
import { taskSubmissionSchema } from "./tasks.js";

/**
 * Event bodies WITHOUT seq — the server is the sole sequencing authority
 * (architecture audit R1 / Sprint 3). Clients and sockets send these; the
 * append path stamps contiguous seqs inside a row-locked transaction.
 */

export const tickBodySchema = z.object({
  type: z.literal("tick"),
  dtMs: z.number().int().positive(),
});

export const actionBodySchema = z.object({
  type: z.literal("action"),
  role: z.string().min(1),
  actorId: z.string().min(1),
  action: z.string().min(1),
  payload: z.unknown().optional(),
});

export const injectionBodySchema = z.object({
  type: z.literal("injection"),
  injection: z.string().min(1),
});

export const phaseChangeBodySchema = z.object({
  type: z.literal("phase_change"),
  phase: sessionPhaseSchema,
});

export const taskStartBodySchema = z.object({
  type: z.literal("task_start"),
  role: z.string().min(1),
  actorId: z.string().min(1),
  taskId: z.string().min(1),
});

export const taskSubmitBodySchema = z.object({
  type: z.literal("task_submit"),
  role: z.string().min(1),
  actorId: z.string().min(1),
  taskId: z.string().min(1),
  submission: taskSubmissionSchema,
});

export const engineEventBodySchema = z.discriminatedUnion("type", [
  tickBodySchema,
  actionBodySchema,
  injectionBodySchema,
  phaseChangeBodySchema,
  taskStartBodySchema,
  taskSubmitBodySchema,
]);

export type EngineEventBody = z.infer<typeof engineEventBodySchema>;
