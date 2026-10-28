import { useEffect, useState } from 'react';

/**
 * The current time, ticking each minute, for the rows' ages.
 *
 * The outside system is the clock.
 */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  return now;
}
