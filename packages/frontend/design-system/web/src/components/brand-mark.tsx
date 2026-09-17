import * as React from "react";

import { cn } from "../lib/utils";

/**
 * BrandMark — the geometric eight-arm asterisk.
 *
 * Drawn with `currentColor` so it inherits the ink around it: `text-ink-900` on
 * light chrome, `text-on-inverse` on a dark card. Size it with `size` (px) or a
 * `size-*` utility on `className`.
 */
function BrandMark({
  className,
  size = 24,
  ...props
}: React.ComponentProps<"svg"> & { size?: number }) {
  return (
    <svg
      data-slot="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      role="img"
      aria-label="Brand mark"
      className={cn("text-ink-900", className)}
      {...props}
    >
      <g stroke="currentColor" strokeWidth="4.2" strokeLinecap="round">
        <line x1="24" y1="7" x2="24" y2="41" />
        <line x1="7" y1="24" x2="41" y2="24" />
        <line x1="12" y1="12" x2="36" y2="36" />
        <line x1="36" y1="12" x2="12" y2="36" />
      </g>
    </svg>
  );
}

export { BrandMark };
