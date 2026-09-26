import { useEffect, useState } from 'react';

/** The current time, as a clock that ticks once a minute while `ticking`. */
export function useNow(ticking: boolean): Date {
  const [now, setNow] = useState(() => new Date());

  // A timer: the clock the label reads. Nothing else re-renders on it.
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [ticking]);

  return now;
}
