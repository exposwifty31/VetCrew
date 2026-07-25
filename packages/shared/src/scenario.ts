import { z } from "zod";

/**
 * Validation schema for scenario definitions (mirrors
 * packages/engine/src/scenario.ts — the engine stays zero-dep, so the zod
 * side lives here). Server-side gate for authored YAML/JSON scenarios.
 */

export const vitalParamsSchema = z.object({
  initial: z.number(),
  target: z.number(),
  ratePerSec: z.number().nonnegative(),
  jitter: z.number().nonnegative(),
});

export const vitalEffectSchema = z
  .object({
    vital: z.string().min(1),
    target: z.number().optional(),
    ratePerSec: z.number().nonnegative().optional(),
    jitter: z.number().nonnegative().optional(),
  })
  .refine(
    (effect) =>
      effect.target !== undefined || effect.ratePerSec !== undefined || effect.jitter !== undefined,
    { message: "a trigger effect must change at least one of target/ratePerSec/jitter" },
  );

export const triggerConditionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("time"), atMs: z.number().int().nonnegative() }),
  z.object({ kind: z.literal("action"), action: z.string().min(1) }),
  z.object({ kind: z.literal("injection"), injection: z.string().min(1) }),
  z.object({ kind: z.literal("task_done"), taskId: z.string().min(1) }),
]);

export const triggerDefSchema = z.object({
  id: z.string().min(1),
  on: triggerConditionSchema,
  effects: z.array(vitalEffectSchema).min(1),
});

export const scenarioDefSchema = z
  .object({
    slug: z.string().min(1),
    version: z.string().min(1),
    species: z.string().min(1).optional(),
    vitals: z.record(z.string().min(1), vitalParamsSchema),
    triggers: z.array(triggerDefSchema),
  })
  .superRefine((scenario, ctx) => {
    const triggerIds = new Set<string>();
    for (const trigger of scenario.triggers) {
      if (triggerIds.has(trigger.id)) {
        ctx.addIssue({ code: "custom", message: `duplicate trigger id: ${trigger.id}` });
      }
      triggerIds.add(trigger.id);
      for (const effect of trigger.effects) {
        if (!(effect.vital in scenario.vitals)) {
          ctx.addIssue({
            code: "custom",
            message: `trigger "${trigger.id}" targets unknown vital "${effect.vital}"`,
          });
        }
      }
    }
  });

export type ScenarioDefWire = z.infer<typeof scenarioDefSchema>;
