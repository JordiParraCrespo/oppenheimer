import { type TransitionEvent, useState } from 'react';
import { rememberPreviewOpen, storedPreviewOpen } from '../lib/preview-open';

/**
 * Where the preview pane beside a session is in its slide. A pane the reader
 * opens is `entering` until its width transition ends, one they close is
 * `leaving` (still drawn) until it ends; a pane stored open on this device
 * starts `shown`, so a reload does not slide it in again. With reduced motion
 * there is no transition to wait for, so a toggle lands on the end state.
 */
export type PreviewPhase = 'closed' | 'entering' | 'shown' | 'leaving';

export function usePreviewPane() {
  const [phase, setPhase] = useState<PreviewPhase>(() =>
    storedPreviewOpen() ? 'shown' : 'closed',
  );
  const open = phase === 'entering' || phase === 'shown';
  const toggle = (next: boolean) => {
    rememberPreviewOpen(next);
    const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setPhase(next ? (instant ? 'shown' : 'entering') : instant ? 'closed' : 'leaving');
  };
  // Only `entering` and `leaving` run a transition of the frame's own.
  const onTransitionEnd = (event: TransitionEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) setPhase(open ? 'shown' : 'closed');
  };
  return { phase, open, toggle, onTransitionEnd };
}
