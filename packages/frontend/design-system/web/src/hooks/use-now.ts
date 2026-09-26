import { useEffect, useState } from 'react';

/**
 * The time, as a timestamp that moves every `intervalMs`.
 *
 * For anything that renders relative to now — "5m" beside a session, a
 * countdown. Reading `Date.now()` or `new Date()` during render instead looks
 * the same and is wrong: the React Compiler caches the result on the inputs it
 * can see, so an age computed from `createdAt` alone stops moving until
 * something unrelated changes. Passing this value in makes the clock an input.
 *
 * The outside system is the timer. Put the hook in the lowest component that
 * reads the time, since every tick re-renders the component that owns it: a
 * list whose rows all show an age ticks once in the list, not once per row.
 */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // The timer: one tick per interval, cleared on unmount.
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}
