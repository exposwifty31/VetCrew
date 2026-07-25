import type { EngineEvent, ScenarioDef, TaskSubmission } from "../../src/index.js";

/**
 * Compact stepped task scenario exercising all seven decision-body kinds —
 * the engine-test mirror of the authored base-rung shape (SRS §4).
 */
export const TASK_SCENARIO: ScenarioDef = {
  slug: "test-task-rung",
  version: "0.0.1",
  species: "dog",
  vitals: {
    hr: { initial: 92, target: 92, ratePerSec: 0.5, jitter: 0.4 },
    sys_bp: { initial: 128, target: 128, ratePerSec: 0.5, jitter: 0.6 },
  },
  triggers: [
    {
      id: "t7-abnormality",
      on: { kind: "task_done", taskId: "t6" },
      effects: [
        { vital: "hr", target: 44, ratePerSec: 2 },
        { vital: "sys_bp", target: 195, ratePerSec: 3 },
      ],
    },
  ],
  tasks: [
    {
      id: "t1",
      code: "do",
      competency: "A",
      title: "Initial TPR",
      titleHe: "מדדים ראשוניים",
      instruction: "Enter temp, HR, RR",
      instructionHe: "הזינו חום, דופק, נשימות",
      body: {
        kind: "value_entry",
        fields: [
          {
            id: "temp",
            label: "Temp",
            labelHe: "חום",
            unit: "°C",
            format: "^\\d{2}(\\.\\d)?$",
            expectedMin: 37.5,
            expectedMax: 39.2,
          },
          {
            id: "hr",
            label: "HR",
            labelHe: "דופק",
            unit: "bpm",
            format: "^\\d{2,3}$",
            expectedMin: 70,
            expectedMax: 120,
          },
        ],
      },
    },
    {
      id: "t2",
      code: "timed",
      competency: "B",
      title: "NIBP",
      titleHe: "מדידת לחץ דם",
      instruction: "Set up and take NIBP",
      instructionHe: "בצעו מדידת לחץ דם",
      body: {
        kind: "choice_chain",
        steps: [
          {
            id: "position",
            label: "Positioning",
            labelHe: "תנוחה",
            options: [
              { id: "lateral", label: "Lateral, front limb", labelHe: "שכיבה צידית, רגל קדמית" },
              { id: "standing", label: "Standing", labelHe: "עמידה" },
            ],
            expectedOptionId: "lateral",
          },
          {
            id: "cuff_size",
            label: "Cuff size",
            labelHe: "גודל שרוול",
            options: [
              { id: "cuff3", label: "Cuff #3", labelHe: "שרוול 3" },
              { id: "cuff4", label: "Cuff #4 (larger fits)", labelHe: "שרוול 4 (הגדול שמתאים)" },
            ],
            expectedOptionId: "cuff4",
          },
          {
            id: "error_diagnosis",
            label: "Artifact Detected — cause?",
            labelHe: "Artifact Detected — מה הסיבה?",
            prompt: "Device: Artifact Detected",
            promptHe: "מכשיר: Artifact Detected",
            options: [
              { id: "motion", label: "Patient motion", labelHe: "תזוזת המטופל" },
              { id: "battery", label: "Batteries", labelHe: "סוללות" },
            ],
            expectedOptionId: "motion",
          },
        ],
      },
    },
    {
      id: "t3",
      code: "report",
      competency: "F'",
      title: "Medication",
      titleHe: "מתן תרופה",
      instruction: "Give diphenhydramine 20 mg",
      instructionHe: "מתן דיפנהידרמין 20 מ״ג",
      body: {
        kind: "med_admin",
        drugLabel: "Diphenhydramine",
        drugLabelHe: "דיפנהידרמין",
        doseMg: 20,
        concentrationMgPerMl: 100,
        routes: [
          { id: "iv", label: "IV", labelHe: "IV" },
          { id: "sc", label: "SC", labelHe: "SC" },
          { id: "po", label: "PO", labelHe: "PO" },
        ],
        expectedMl: 0.2,
        expectedRouteId: "sc",
        criticalRouteIds: ["iv"],
      },
    },
    {
      id: "t4",
      code: "report",
      competency: "C",
      title: "Blood draw",
      titleHe: "לקיחת דם",
      instruction: "CBC + biochemistry",
      instructionHe: "ספירה + ביוכימיה",
      body: {
        kind: "tube_choice",
        panelLabel: "CBC + biochemistry",
        panelLabelHe: "ספירה + ביוכימיה",
        options: [
          { id: "edta", label: "EDTA (purple)", labelHe: "EDTA (סגול)" },
          { id: "serum", label: "Serum (red)", labelHe: "סרום (אדום)" },
          { id: "citrate", label: "Citrate (blue)", labelHe: "ציטרט (כחול)" },
        ],
        expectedOptionIds: ["edta", "serum"],
      },
    },
    {
      id: "t5",
      code: "do",
      competency: "D",
      title: "IV catheter",
      titleHe: "צנתר וריד",
      instruction: "Assemble the steps in order",
      instructionHe: "סדרו את השלבים",
      body: {
        kind: "step_order",
        steps: [
          { id: "shave", label: "Shave", labelHe: "גילוח" },
          { id: "disinfect", label: "Disinfect", labelHe: "חיטוי" },
          { id: "insert", label: "Insert", labelHe: "החדרה" },
        ],
        expectedOrder: ["shave", "disinfect", "insert"],
      },
    },
    {
      id: "t6",
      code: "do",
      competency: "E",
      title: "Fluids setup",
      titleHe: "חיבור נוזלים",
      instruction: "150 ml/hr ordered, no pump",
      instructionHe: "הוראה: 150 מ״ל לשעה, ללא משאבה",
      body: {
        kind: "fluids_setup",
        weightKg: 22,
        orderedMlPerHr: 150,
        sets: [
          { id: "regular", label: "Regular set", labelHe: "סט רגיל", dropsPerMl: 20 },
          { id: "burette", label: "Burette", labelHe: "ביורטה", dropsPerMl: 60 },
        ],
        expectedSetId: "regular",
      },
    },
    {
      id: "t7",
      code: "approval",
      competency: "decision",
      title: "Recognise & escalate",
      titleHe: "זיהוי והסלמה",
      instruction: "Escalate when something is wrong",
      instructionHe: "הסלימו כשמשהו חריג",
      hidden: true,
      body: { kind: "escalate", abnormalityTriggerId: "t7-abnormality" },
    },
  ],
};

let seqCounter = 0;

export function resetSeq(): void {
  seqCounter = 0;
}

/** Stamp the next seq onto a fixture event. Input is loosely typed so the
 *  discriminated-union members remain writable without `Omit` collapsing them. */
export function ev(event: { type: EngineEvent["type"] } & Record<string, unknown>): EngineEvent {
  return { ...event, seq: ++seqCounter } as EngineEvent;
}

export function startAndSubmit(taskId: string, submission: TaskSubmission): EngineEvent[] {
  return [
    ev({ type: "task_start", role: "technician", actorId: "tech-1", taskId }),
    ev({ type: "task_submit", role: "technician", actorId: "tech-1", taskId, submission }),
  ];
}

/**
 * The canonical scripted run: correct T1/T2/T4/T5, deliberately WRONG route on
 * T3 (SC-only drug given IV — the fatal-class recorded floor failure) and
 * wrong drip rate on T6 (ml/hr entered as drops/min on a regular set), then
 * escalation 10 ticks after the T6-triggered abnormality.
 */
export function fullRunEvents(): EngineEvent[] {
  resetSeq();
  const events: EngineEvent[] = [
    ev({ type: "phase_change", phase: "briefing" }),
    ev({ type: "phase_change", phase: "running" }),
  ];
  const tick = (n: number) => {
    for (let i = 0; i < n; i++) events.push(ev({ type: "tick", dtMs: 1000 }));
  };
  tick(3);
  events.push(...startAndSubmit("t1", { kind: "value_entry", values: { temp: 38.4, hr: 96 } }));
  tick(4);
  events.push(
    ...startAndSubmit("t2", {
      kind: "choice_chain",
      choices: { position: "lateral", cuff_size: "cuff4", error_diagnosis: "motion" },
    }),
  );
  tick(4);
  events.push(...startAndSubmit("t3", { kind: "med_admin", ml: 0.2, routeId: "iv" }));
  tick(3);
  events.push(...startAndSubmit("t4", { kind: "tube_choice", optionIds: ["edta", "serum"] }));
  tick(3);
  events.push(
    ...startAndSubmit("t5", { kind: "step_order", order: ["shave", "disinfect", "insert"] }),
  );
  tick(3);
  events.push(
    ...startAndSubmit("t6", { kind: "fluids_setup", setId: "regular", dropsPerMin: 150 }),
  );
  // Abnormality fires on the t6 submit; ten ticks pass before the trainee notices.
  tick(10);
  events.push(
    ev({ type: "task_submit", role: "technician", actorId: "tech-1", taskId: "t7", submission: { kind: "escalate" } }),
  );
  tick(2);
  events.push(ev({ type: "phase_change", phase: "debrief" }));
  return events;
}
