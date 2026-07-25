import { z } from "zod";

import { antsDomainSchema } from "./entities.js";
import { triggerDefSchema, vitalParamsSchema } from "./scenario.js";

/**
 * Authored scenario contract (vetcrew-scenario-authoring skill):
 * a scenario is content, not code — data a clinician can edit without
 * touching the engine. Structure: patient profile, parametrized vitals
 * model, role objectives (checklist), instructor injection menu, scoring
 * hooks, clinical-review flag, independent versioning.
 */

export const checklistRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("action_performed"),
    action: z.string().min(1),
    withinMs: z.number().int().positive().optional(),
  }),
  z.object({ kind: z.literal("action_not_performed"), action: z.string().min(1) }),
  z.object({
    kind: z.literal("action_before"),
    action: z.string().min(1),
    before: z.string().min(1),
  }),
]);

export const checklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelHe: z.string().min(1),
  weight: z.number().positive(),
  role: z.string().min(1).optional(),
  rule: checklistRuleSchema,
});

/** Actions the trainee station can take — the sim's verb menu. */
export const scenarioActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelHe: z.string().min(1),
});

/** Instructor injection menu: available, never scheduled. */
export const injectionMenuItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  labelHe: z.string().min(1),
});

export const authoredScenarioSchema = z
  .object({
    slug: z.string().min(1),
    version: z.string().min(1),
    title: z.string().min(1),
    titleHe: z.string().min(1),
    species: z.string().min(1),
    presentingComplaint: z.string().min(1),
    presentingComplaintHe: z.string().min(1),
    /** Liability boundary (CLAUDE.md §2.5): false = internal testing only. */
    clinicallyReviewed: z.boolean(),
    clinicalReviewer: z.string().nullable(),
    roles: z.array(z.string().min(1)).min(1),
    engine: z.object({
      vitals: z.record(z.string().min(1), vitalParamsSchema),
      triggers: z.array(triggerDefSchema),
    }),
    actions: z.array(scenarioActionSchema).min(1),
    checklist: z.array(checklistItemSchema).min(1),
    injections: z.array(injectionMenuItemSchema),
    scoringDimensions: z.array(antsDomainSchema).min(1),
  })
  .superRefine((scenario, ctx) => {
    const vitalNames = new Set(Object.keys(scenario.engine.vitals));
    const actionIds = new Set(scenario.actions.map((a) => a.id));
    const triggerIds = new Set<string>();
    for (const trigger of scenario.engine.triggers) {
      if (triggerIds.has(trigger.id)) {
        ctx.addIssue({ code: "custom", message: `duplicate trigger id: ${trigger.id}` });
      }
      triggerIds.add(trigger.id);
      for (const effect of trigger.effects) {
        if (!vitalNames.has(effect.vital)) {
          ctx.addIssue({
            code: "custom",
            message: `trigger "${trigger.id}" targets unknown vital "${effect.vital}"`,
          });
        }
      }
      if (trigger.on.kind === "action" && !actionIds.has(trigger.on.action)) {
        ctx.addIssue({
          code: "custom",
          message: `trigger "${trigger.id}" keys off unknown action "${trigger.on.action}"`,
        });
      }
    }
    for (const item of scenario.checklist) {
      const referenced =
        item.rule.kind === "action_before"
          ? [item.rule.action, item.rule.before]
          : [item.rule.action];
      for (const action of referenced) {
        if (!actionIds.has(action)) {
          ctx.addIssue({
            code: "custom",
            message: `checklist item "${item.id}" references unknown action "${action}"`,
          });
        }
      }
    }
  });

export type AuthoredScenario = z.infer<typeof authoredScenarioSchema>;
export type ChecklistItemWire = z.infer<typeof checklistItemSchema>;
