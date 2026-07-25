import * as React from "react";

export type TaskCode = "do" | "report" | "timed" | "approval";
export type TaskState =
  | "available" | "in_progress" | "done" | "error" | "locked" | "released";

/** Route of administration — a scored dimension, independent of dose. */
export type TaskRoute = "IV" | "IM" | "SC" | "PO";

export interface TaskWindow {
  /** e.g. "חלון 15 דק׳". */
  label: string;
  /** e.g. "נותרו 4:12". */
  remaining: string;
  /** Window about to close — adds urgency (position + motion, not hue alone). */
  closing?: boolean;
}

export interface TaskChipProps extends Omit<React.HTMLAttributes<HTMLElement>, "onChange"> {
  /** Task code (mental model, not severity): do / report / timed / approval. */
  code?: TaskCode;
  state?: TaskState;
  title: string;
  detail?: string;
  /** Timed code only — the window + remaining time. */
  window?: TaskWindow;

  // ── Medication task (a `report` chip) scores THREE independent dimensions:
  //    drug (named in `title`) · dose (`report*` value, ml) · route (`route*`).
  //    Never pre-fill or hint the correct answer for any of them.

  /** Report code only — unit label for the value the tech must enter (e.g. "ml"). */
  reportUnit?: string;
  reportValue?: string;
  /** Marks the report field invalid (red + shake) — for format-enforcement.
   *  A WRONG dose is shown invalid but never auto-corrected. */
  reportError?: boolean;
  onReportChange?: (value: string) => void;

  /** Currently selected route. `undefined` = not yet chosen. NEVER pre-filled. */
  route?: TaskRoute;
  /** Route options offered. Presence renders the route selector. ALWAYS include
   *  contraindicated routes so a wrong choice is expressible — the mistake is the
   *  measurement. Defaults to ["IV","IM","SC","PO"]. */
  routeOptions?: TaskRoute[];
  onRouteChange?: (route: TaskRoute) => void;
  /** Marks the CHOSEN route as a logged error (wrong / contraindicated route).
   *  Presentational only — the chip is TOLD this; it does not compute it and does
   *  NOT block selection. A correct dose by the wrong route is a FAIL, not partial
   *  credit. WHICH routes are contraindicated is scenario data pending clinical
   *  sign-off (§2.5); this component never hardcodes it. */
  routeError?: boolean;

  /** Locked state — who holds the task. */
  holder?: string;
  onStart?: () => void;
  /** Approval code — the only permitted action. */
  onCallDoctor?: () => void;
  lang?: "he" | "en";
}

/**
 * Base-rung task chip — matte, contained work-software primitive.
 * @startingPoint section="Base rung" subtitle="Task chip — 4 codes × 6 lifecycle states (matte, contained)" viewport="700x150"
 */
export function TaskChip(props: TaskChipProps): JSX.Element;
