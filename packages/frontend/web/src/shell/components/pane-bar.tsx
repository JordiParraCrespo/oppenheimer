import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePaneBar } from '../hooks/use-pane';

/**
 * A screen's bar, in the slot the shell keeps above the page frame: it stays
 * put while the page scrolls under it, and the page below is still the
 * shell's, at the measure the route names. A pull request's toolbar is one.
 * The bar is the screen's tree, so its state (a review's pending comments)
 * stays with the screen.
 */
export function PaneBar({ children }: { children: ReactNode }) {
  const bar = usePaneBar();
  return bar ? createPortal(children, bar) : null;
}
