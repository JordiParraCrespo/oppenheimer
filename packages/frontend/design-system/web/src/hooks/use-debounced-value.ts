import { useEffect, useState } from 'react';

/**
 * `value`, once it has held still for `delay`.
 *
 * The value-shaped twin of `useDebouncedCallback`: reach for this one when
 * the settled value is read during render (a query key, an availability
 * check), and for the callback when it is handed up to someone else.
 *
 * The outside system is the timer. Every change restarts it, so a burst of
 * keystrokes settles once, and unmounting cancels it so a settled value never
 * lands on a component that has gone.
 *
 * Pass a primitive or a value whose identity is stable between renders: an
 * object literal is a new value every render and would restart the timer on
 * each one, so it would never settle.
 *
 * Compare the two to know whether the reader is still typing:
 *
 * ```tsx
 * const settled = useDebouncedValue(address, 400);
 * const typing = settled !== address;
 * ```
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    // The timer: restarted by every change, cancelled on unmount.
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}
