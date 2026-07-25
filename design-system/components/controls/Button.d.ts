import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual role. Primary teal is the default action; danger is destructive-only. */
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** md = 48px default touch target; lg = 56px (instructor triggers); sm = 40px (AAR toolbars). */
  size?: "sm" | "md" | "lg";
  /** Stretch to full container width. */
  block?: boolean;
  /** Icon node rendered at the inline-start (RTL-aware). */
  iconStart?: React.ReactNode;
  /** Icon node rendered at the inline-end. */
  iconEnd?: React.ReactNode;
  /** Render as another element (e.g. "a"). */
  as?: keyof JSX.IntrinsicElements;
  children?: React.ReactNode;
}

/**
 * VetCrew action button. Teal = interactive only.
 * @startingPoint section="Controls" subtitle="Action button — teal primary, secondary, ghost, danger" viewport="700x180"
 */
export function Button(props: ButtonProps): JSX.Element;
