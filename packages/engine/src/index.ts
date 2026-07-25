export { prngInit, prngNext, type PrngDraw } from "./prng.js";
export {
  SESSION_PHASES,
  type ActionEvent,
  type EngineEvent,
  type InjectionEvent,
  type PhaseChangeEvent,
  type SessionPhase,
  type TaskStartEvent,
  type TaskSubmitEvent,
  type TickEvent,
} from "./events.js";
export {
  TASK_LIFECYCLES,
  createTaskRuntime,
  type ChoiceStepDef,
  type FluidSetDef,
  type TaskBodyDef,
  type TaskChipCode,
  type TaskDef,
  type TaskLifecycle,
  type TaskOptionDef,
  type TaskRuntimeState,
  type TaskSubmission,
  type ValueFieldDef,
} from "./tasks.js";
export {
  instructorView,
  roleView,
  type InstructorInjectionItem,
  type InstructorTaskSummary,
  type InstructorView,
  type RoleView,
  type ViewChoiceStep,
  type ViewTask,
  type ViewTaskBody,
  type ViewValueField,
} from "./views.js";
export {
  evaluateTasks,
  type EscalationResult,
  type TaskDimensionResult,
  type TaskEvaluation,
} from "./evaluate-tasks.js";
export { PHASE_TRANSITIONS, canTransition } from "./fsm.js";
export {
  createInitialState,
  reduce,
  replay,
  type EngineState,
  type VitalState,
} from "./reducer.js";
export type {
  InjectionMenuItem,
  ScenarioDef,
  TriggerCondition,
  TriggerDef,
  VitalEffect,
  VitalParams,
} from "./scenario.js";
export {
  evaluateChecklist,
  type ChecklistItemDef,
  type ChecklistItemResult,
  type ChecklistResult,
  type ChecklistRule,
} from "./checklist.js";
export {
  buildAar,
  type AarModel,
  type AarTimelineEntry,
  type AarVitalsSample,
} from "./aar.js";
