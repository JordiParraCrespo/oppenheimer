import type { ReactNode } from 'react';

/** A block's own heading inside a visual: small, medium weight, never louder than the visual's title. */
export function VisualBlockTitle({ children }: { children?: ReactNode }) {
  if (!children) return <span />;
  return <h4 className="m-0 truncate text-[13px] font-medium text-fg">{children}</h4>;
}
