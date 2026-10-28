import { type TransitionEvent, useState } from 'react';
import { rememberPreviewOpen, storedPreviewOpen } from '../lib/preview-open';

/**
 * Whether the preview pane beside a session is open, and whether it is still
 * drawn: a pane that closes slides out first, so it stays mounted until its
 * width transition ends (`onTransitionEnd`). With reduced motion there is no
 * transition to wait for, and it goes at once.
 */
export function usePreviewPane() {
  const [open, setOpen] = useState(storedPreviewOpen);
  const [mounted, setMounted] = useState(open);
  const toggle = (next: boolean) => {
    setOpen(next);
    rememberPreviewOpen(next);
    if (next || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setMounted(next);
  };
  const onTransitionEnd = (event: TransitionEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && !open) setMounted(false);
  };
  return { open, mounted: open || mounted, toggle, onTransitionEnd };
}
