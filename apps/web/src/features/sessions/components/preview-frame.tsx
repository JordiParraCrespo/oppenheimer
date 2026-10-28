import { cn } from '@oppenheimer/design-system-web';
import type { ReactNode, TransitionEvent } from 'react';
import type { PreviewPhase } from '../hooks/use-preview-pane';

/**
 * The frame the preview pane slides through beside the terminal. Its width
 * runs between nothing and the pane's (`w-110`) on the sidebar's timing; the
 * pane keeps its own width against the frame's right edge, so it moves rather
 * than reflows. `entering` starts from nothing (`starting:w-0`, the frame's
 * first style), `leaving` keeps the pane drawn while the width closes, and
 * the caller moves on in `onTransitionEnd`.
 */
export function PreviewFrame({
  phase,
  onTransitionEnd,
  children,
}: {
  phase: PreviewPhase;
  onTransitionEnd: (event: TransitionEvent<HTMLElement>) => void;
  children: ReactNode;
}) {
  if (phase === 'closed') return null;
  return (
    <div
      className={cn(
        'flex shrink-0 justify-end overflow-hidden transition-[width] duration-base ease-standard motion-reduce:transition-none',
        phase === 'leaving' ? 'w-0' : 'w-110',
        phase === 'entering' && 'starting:w-0',
      )}
      onTransitionEnd={onTransitionEnd}
    >
      {children}
    </div>
  );
}
