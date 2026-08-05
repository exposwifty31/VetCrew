import { z } from "zod";

import { antsDomainSchema, scenarioModeSchema } from "./entities.js";
import { triggerDefSchema, vitalParamsSchema } from "./scenario.js";
import { taskDefSchema } from "./tasks.js";

/**
 * Authored scenario contract (vetcrew-scenario-authoring skill):
 * a scenario is content, not code — data a clinician can edit without
 * touching the engine. Structure: patient profile, parametrized vitals
 * model, role objectives (checklist and/or stepped tasks), instructor
 * injection menu, scoring hooks, clinical-review flag, independent versioning.
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

/** Actions the trainee station can take — the sim's verb menu (deterioration scenarios). */
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
    /**
     * Which platform this content belongs to (CLAUDE.md §1.1, D3). Defaults to
     * `practice` so authoring an assessment is always a deliberate act — the
     * locked mode is never something a file falls into by omission.
     */
    mode: scenarioModeSchema.default("practice"),
    /**
     * Fixed PRNG seed. REQUIRED for assessment (see the refinement below):
     * the reducer draws jitter per vital per tick, so a per-session random seed
     * would give two candidates different vitals traces on the same scenario —
     * different numbers to read and call out, at different moments. Cohort
     * comparability is the entire point of the locked platform.
     */
    seed: z.number().int().nonnegative().max(4294967295).optional(),
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
    /** Optional for stepped-task scenarios (Scenario #2) that use the task rail. */
    actions: z.array(scenarioActionSchema).default([]),
    checklist: z.array(checklistItemSchema).default([]),
    /** Stepped task sequence (base-rung SRS). Absent/empty for pure-deterioration demos. */
    tasks: z.array(taskDefSchema).default([]),
    injections: z.array(injectionMenuItemSchema).default([]),
    scoringDimensions: z.array(antsDomainSchema).min(1),
  })
  .superRefine((scenario, ctx) => {
    if (scenario.clinicallyReviewed && (scenario.clinicalReviewer ?? "").trim() === "") {
      ctx.addIssue({
        code: "custom",
        message: "clinically reviewed scenarios must name their reviewer (CLAUDE.md §2.5)",
      });
    }
    if (scenario.actions.length === 0 && scenario.tasks.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "a scenario must define at least one action or one task",
      });
    }
    if (scenario.mode === "assessment") {
      // D2, as amended 2026-08-05: scoring requires every assigned rater to
      // cover every domain the scenario DECLARES, rather than all four ANTS
      // domains. That makes the declared set load-bearing, so an assessment
      // may not declare a token one or two — three is the floor, named
      // deliberately. (All-four was unsatisfiable: no shipped scenario
      // declares team_working, and a solo candidate session generates no
      // events to cite for it; CLAUDE.md §2.4 forbids solo-izing that axis.)
      if (scenario.scoringDimensions.length < 3) {
        ctx.addIssue({
          code: "custom",
          message:
            "an assessment scenario must declare at least 3 ANTS domains — the declared set is what every rater must complete (CLAUDE.md §1.6, D2)",
        });
      }
      if (scenario.seed === undefined) {
        ctx.addIssue({
          code: "custom",
          message:
            "an assessment scenario must carry a fixed seed so every candidate faces an identical run (CLAUDE.md §1.1)",
        });
      }
    }
    const vitalNames = new Set(Object.keys(scenario.engine.vitals));
    const actionIds = new Set(scenario.actions.map((a) => a.id));
    const injectionIds = new Set(scenario.injections.map((i) => i.id));
    const taskIds = new Set(scenario.tasks.map((t) => t.id));
    const roleNames = new Set(scenario.roles);
    for (const [collection, ids] of [
      ["action", scenario.actions.map((a) => a.id)],
      ["injection", scenario.injections.map((i) => i.id)],
      ["checklist item", scenario.checklist.map((c) => c.id)],
      ["task", scenario.tasks.map((t) => t.id)],
    ] as const) {
      const seen = new Set<string>();
      for (const id of ids) {
        if (seen.has(id)) {
          ctx.addIssue({ code: "custom", message: `duplicate ${collection} id: ${id}` });
        }
        seen.add(id);
      }
    }
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
      if (trigger.on.kind === "injection" && !injectionIds.has(trigger.on.injection)) {
        ctx.addIssue({
          code: "custom",
          message: `trigger "${trigger.id}" keys off unknown injection "${trigger.on.injection}"`,
        });
      }
      if (trigger.on.kind === "task_done" && !taskIds.has(trigger.on.taskId)) {
        ctx.addIssue({
          code: "custom",
          message: `trigger "${trigger.id}" keys off unknown task "${trigger.on.taskId}"`,
        });
      }
    }
    for (const item of scenario.checklist) {
      if (item.role !== undefined && !roleNames.has(item.role)) {
        ctx.addIssue({
          code: "custom",
          message: `checklist item "${item.id}" scopes to unknown role "${item.role}"`,
        });
      }
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
    for (const task of scenario.tasks) {
      if (task.body.kind === "escalate" && !triggerIds.has(task.body.abnormalityTriggerId)) {
        ctx.addIssue({
          code: "custom",
          message: `task "${task.id}" escalate body references unknown trigger "${task.body.abnormalityTriggerId}"`,
        });
      }
    }
  });

export type AuthoredScenario = z.infer<typeof authoredScenarioSchema>;
export type ChecklistItemWire = z.infer<typeof checklistItemSchema>;
