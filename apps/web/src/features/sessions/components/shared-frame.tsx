import type { ReactNode } from 'react';

/**
 * The whole page of a shared session: no console around it, since its
 * holder may have no account, and the terminal's own colour edge to edge.
 */
export function SharedFrame({ children }: { children: ReactNode }) {
  return <div className="flex h-dvh flex-col bg-term-bg">{children}</div>;
}
