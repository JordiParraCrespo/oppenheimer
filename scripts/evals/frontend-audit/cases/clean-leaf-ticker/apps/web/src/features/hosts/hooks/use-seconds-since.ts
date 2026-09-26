import { useEffect, useState } from 'react';

/** Whole seconds since `since`, ticking once a second while `since` is set. */
export function useSecondsSince(since: Date | null): number | null {
  const [now, setNow] = useState(() => Date.now());

  // A timer: the clock the label reads. Nothing else re-renders on it.
  useEffect(() => {
    if (!since) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);

  return since ? Math.max(0, Math.floor((now - since.getTime()) / 1000)) : null;
}
