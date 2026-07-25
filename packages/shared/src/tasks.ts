import { z } from "zod";

/**
 * Authored/wire task schemas — mirrors packages/engine/src/tasks.ts.
 * The engine stays zero-dep; zod lives here.
 */

export const taskChipCodeSchema = z.enum(["do", "report", "timed", "approval"]);

export const taskOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelHe: z.string().min(1),
});

export const valueFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelHe: z.string().min(1),
  unit: z.string().min(1),
  format: z.string().min(1),
  expectedMin: z.number(),
  expectedMax: z.number(),
});

export const choiceStepSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelHe: z.string().min(1),
  prompt: z.string().min(1).optional(),
  promptHe: z.string().min(1).optional(),
  options: z.array(taskOptionSchema).min(1),
  expectedOptionId: z.string().min(1),
});

export const fluidSetSchema = taskOptionSchema.extend({
  dropsPerMl: z.number().positive(),
});

export const taskBodySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("value_entry"), fields: z.array(valueFieldSchema).min(1) }),
  z.object({ kind: z.literal("choice_chain"), steps: z.array(choiceStepSchema).min(1) }),
  z.object({
    kind: z.literal("med_admin"),
    drugLabel: z.string().min(1),
    drugLabelHe: z.string().min(1),
    doseMg: z.number().positive(),
    concentrationMgPerMl: z.number().positive(),
    routes: z.array(taskOptionSchema).min(1),
    expectedMl: z.number().positive(),
    expectedRouteId: z.string().min(1),
    criticalRouteIds: z.array(z.string().min(1)),
  }),
  z.object({
    kind: z.literal("tube_choice"),
    panelLabel: z.string().min(1),
    panelLabelHe: z.string().min(1),
    options: z.array(taskOptionSchema).min(1),
    expectedOptionIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal("step_order"),
    steps: z.array(taskOptionSchema).min(1),
    expectedOrder: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal("fluids_setup"),
    weightKg: z.number().positive(),
    orderedMlPerHr: z.number().positive(),
    sets: z.array(fluidSetSchema).min(1),
    expectedSetId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("escalate"),
    abnormalityTriggerId: z.string().min(1),
  }),
]);

export const taskDefSchema = z.object({
  id: z.string().min(1),
  code: taskChipCodeSchema,
  competency: z.string().min(1),
  title: z.string().min(1),
  titleHe: z.string().min(1),
  instruction: z.string().min(1),
  instructionHe: z.string().min(1),
  body: taskBodySchema,
  hidden: z.boolean().optional(),
  /** Owning role; omitted = visible to all trainee roles (solo scenarios). */
  role: z.string().min(1).optional(),
});

export const taskSubmissionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("value_entry"),
    values: z.record(z.string().min(1), z.number()),
  }),
  z.object({
    kind: z.literal("choice_chain"),
    choices: z.record(z.string().min(1), z.string().min(1)),
  }),
  z.object({
    kind: z.literal("med_admin"),
    ml: z.number(),
    routeId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("tube_choice"),
    optionIds: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal("step_order"),
    order: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    kind: z.literal("fluids_setup"),
    setId: z.string().min(1),
    dropsPerMin: z.number(),
  }),
  z.object({ kind: z.literal("escalate") }),
]);

export type TaskDefWire = z.infer<typeof taskDefSchema>;
export type TaskSubmissionWire = z.infer<typeof taskSubmissionSchema>;
