import * as React from "react";

export interface SeverityGlyphProps extends React.SVGAttributes<SVGSVGElement> {
  level?: "normal" | "watch" | "elevated" | "critical";
  /** px size (square). Default 18. */
  size?: number;
  /** If set, the glyph is exposed to AT with this label; otherwise decorative. */
  title?: string;
}

/** Distinct silhouette per severity level — the shape half of color-blind-safe coding. */
export function SeverityGlyph(props: SeverityGlyphProps): JSX.Element;
