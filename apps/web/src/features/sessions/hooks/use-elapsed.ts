import { useEffect, useState } from 'react';
import { formatElapsed } from '../lib/elapsed';

/**
 * How long something has been going on, as a clock that ticks.
 *
 * The interval is the point: a provisioning pane whose clock is frozen reads
 * as a hung app, and the one number that says "the host is still being waited
 * on" is the one nobody has to refresh to see move. It stops when `ticking`
 * goes false — a failed start has a duration, not a clock.
 */
export function useElapsed(since: Date, ticking = true): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;

    // A second is the resolution the pane shows; anything finer is a render
    // per frame for a number that did not change.
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  return formatElapsed(now - since.getTime());
}
