import { useEffect, useState } from 'react';

/** How long a live device may show no picture before the pane says why it might not. */
const NO_PICTURE_SLOW_MS = 15_000;

/**
 * Whether the Simulator has been waiting for its device's first picture long
 * enough to say why it might not come: still booting, or an app still
 * building. A timer, armed while `waiting` holds and cleared when it stops.
 */
export function useSlowWait(waiting: boolean): boolean {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setSlow(true), NO_PICTURE_SLOW_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [waiting]);
  return slow;
}
