import { z } from "zod";

import { sessionPhaseSchema } from "./contracts.js";
import { taskChipCodeSchema, taskOptionSchema, taskSubmissionSchema } from "./tasks.js";

/**
 * Socket.IO wire contracts for live sessions (Sprint 3).
 * Client intents carry NO seq — the server is the sole sequencing authority.
 */

export const liveRejectCodeSchema = z.enum([
  "fsm",
  "auth",
  "role_bound",
  "phase",
  "validation",
  "not_found",
  "scenario",
]);

export const sessionJoinSchema = z.object({
  sessionId: z.string().uuid(),
  role: z.string().min(1),
  /** Last successfully applied seq; 0 / omitted = cold join. */
  lastSeq: z.number().int().nonnegative().optional(),
  /**
   * Dev-bypass actor stamp only. Ignored when Clerk is enabled; when bypass
   * is active the server still prefers a bound value over this field.
   */
  actorId: z.string().min(1).optional(),
});

/** Attribution (role/actorId) is stamped from the socket binding, never trusted from the client. */
export const clientIntentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("phase_change"),
    phase: sessionPhaseSchema,
  }),
  z.object({
    type: z.literal("action"),
    action: z.string().min(1),
    payload: z.unknown().optional(),
  }),
  z.object({
    type: z.literal("task_start"),
    taskId: z.string().min(1),
  }),
  z.object({
    type: z.literal("task_submit"),
    taskId: z.string().min(1),
    submission: taskSubmissionSchema,
  }),
  z.object({
    type: z.literal("injection"),
    injection: z.string().min(1),
  }),
]);

/**
 * Reject client payloads that still try to smuggle a seq. Zod strips unknown
 * keys on parse, so we must inspect the raw object before schema parsing.
 */
export function parseClientIntent(raw: unknown):
  | { success: true; data: ClientIntent }
  | { success: false; error: string } {
  if (raw !== null && typeof raw === "object" && "seq" in raw) {
    return { success: false, error: "client intents must not include seq" };
  }
  const parsed = clientIntentSchema.safeParse(raw);
  if (!parsed.success) return { success: false, error: "invalid intent" };
  return { success: true, data: parsed.data };
}

/** @deprecated prefer parseClientIntent — kept for test naming continuity */
export const clientIntentStrictSchema = {
  safeParse(raw: unknown) {
    const result = parseClientIntent(raw);
    return result.success
      ? { success: true as const, data: result.data }
      : { success: false as const, error: { message: result.error } };
  },
};

const viewValueFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelHe: z.string().min(1),
  unit: z.string().min(1),
  format: z.string().min(1),
});

const viewChoiceStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelHe: z.string().min(1),
  prompt: z.string().min(1).optional(),
  promptHe: z.string().min(1).optional(),
  options: z.array(taskOptionSchema).min(1),
});

const viewTaskBodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("value_entry"), fields: z.array(viewValueFieldSchema).min(1) }),
  z.object({ kind: z.literal("choice_chain"), steps: z.array(viewChoiceStepSchema).min(1) }),
  z.object({
    kind: z.literal("med_admin"),
    drugLabel: z.string().min(1),
    drugLabelHe: z.string().min(1),
    doseMg: z.number().positive(),
    concentrationMgPerMl: z.number().positive(),
    routes: z.array(taskOptionSchema).min(1),
  }),
  z.object({
    kind: z.literal("tube_choice"),
    panelLabel: z.string().min(1),
    panelLabelHe: z.string().min(1),
    options: z.array(taskOptionSchema).min(1),
  }),
  z.object({ kind: z.literal("step_order"), steps: z.array(taskOptionSchema).min(1) }),
  z.object({
    kind: z.literal("fluids_setup"),
    weightKg: z.number().positive(),
    orderedMlPerHr: z.number().positive(),
    sets: z.array(taskOptionSchema).min(1),
  }),
  z.object({ kind: z.literal("escalate") }),
]);

const taskLifecycleSchema = z.enum(["available", "in_progress", "done", "error"]);

export const roleViewWireSchema = z.object({
  role: z.string().min(1),
  phase: sessionPhaseSchema,
  timeMs: z.number().nonnegative(),
  seq: z.number().int().nonnegative(),
  scenarioSlug: z.string().min(1),
  scenarioVersion: z.string().min(1),
  species: z.string().nullable(),
  vitals: z.record(z.string(), z.number()),
  tasks: z.array(
    z.object({
      id: z.string().min(1),
      code: taskChipCodeSchema,
      title: z.string().min(1),
      titleHe: z.string().min(1),
      instruction: z.string().min(1),
      instructionHe: z.string().min(1),
      hidden: z.boolean(),
      lifecycle: taskLifecycleSchema,
      submission: taskSubmissionSchema.nullable(),
      body: viewTaskBodySchema,
    }),
  ),
});

export const sessionSnapshotSchema = z.object({
  seq: z.number().int().nonnegative(),
  roleView: roleViewWireSchema,
});

export const sessionRejectSchema = z.object({
  code: liveRejectCodeSchema,
  message: z.string().min(1),
});

export const sessionConnectionSchema = z.object({
  status: z.enum(["connected", "reconnecting", "closed"]),
});

export type SessionJoin = z.infer<typeof sessionJoinSchema>;
export type ClientIntent = z.infer<typeof clientIntentSchema>;
export type RoleViewWire = z.infer<typeof roleViewWireSchema>;
export type SessionSnapshot = z.infer<typeof sessionSnapshotSchema>;
export type SessionReject = z.infer<typeof sessionRejectSchema>;
export type LiveRejectCode = z.infer<typeof liveRejectCodeSchema>;

/** Socket.IO event names — keep stringly-typed call sites in sync. */
export const LIVE_EVENTS = {
  join: "session:join",
  intent: "session:intent",
  leave: "session:leave",
  snapshot: "session:snapshot",
  events: "session:events",
  reject: "session:reject",
  connection: "session:connection",
} as const;
