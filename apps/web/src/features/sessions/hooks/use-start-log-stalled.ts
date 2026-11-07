import { useEffect, useState } from 'react';
import { type StartLogReadState, startLogStallDeadline } from '../lib/start-log-stall';

/**
 * Whether the start log has failed long enough to say so
 * ({@link startLogStallDeadline}).
 *
 * Effect: a timer to the deadline, since no read may come to re-render the
 * pane when it passes (the workspace stream stands the poll down).
 */
export function useStartLogStalled(read: StartLogReadState): boolean {
  const [watchingSince] = useState(Date.now);
  const deadline = startLogStallDeadline(read, watchingSince);
  const [passed, setPassed] = useState<number | null>(null);

  useEffect(() => {
    if (deadline === null) return;
    const timer = setTimeout(() => setPassed(deadline), Math.max(0, deadline - Date.now()));
    return () => clearTimeout(timer);
  }, [deadline]);

  return deadline !== null && passed === deadline;
}
