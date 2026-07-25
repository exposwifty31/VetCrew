import * as React from "react";

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  /** Required accessible name (also the tooltip). */
  label: string;
  /** Icon node (e.g. a Lucide SVG). */
  icon: React.ReactNode;
  variant?: "ghost" | "solid";
  size?: "md" | "lg";
}

/** Square, 44px-minimum icon-only control. */
export function IconButton(props: IconButtonProps): JSX.Element;
