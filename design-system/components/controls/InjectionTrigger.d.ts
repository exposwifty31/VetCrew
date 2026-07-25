import * as React from "react";

export interface InjectionTriggerProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** Injection name (Hebrew-first). */
  title: string;
  /** One-line description of what firing it does. */
  description?: string;
  /** Neutral category tag (e.g. "סיבוך", "מידע", "ציוד") — never severity-colored. */
  kind?: string;
  icon?: React.ReactNode;
  /** Already fired this session. */
  fired?: boolean;
  /** Time it fired, pre-formatted (e.g. "T+04:12"). */
  firedAt?: string;
  onFire?: () => void;
}

/**
 * Fast-fire instructor injection target.
 * @startingPoint section="Controls" subtitle="Large fast-fire injection trigger (armed + fired states)" viewport="700x150"
 */
export function InjectionTrigger(props: InjectionTriggerProps): JSX.Element;
