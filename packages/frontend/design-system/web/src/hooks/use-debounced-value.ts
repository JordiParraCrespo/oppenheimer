import { useEffect, useState } from 'react';

/**
 * `value`, once it has held still for `delay`. The value-shaped twin of
 * `useDebouncedCallback`: use it when the settled value is read during render
 * (a query key, an availability check).
 *
 * The outside system is the timer: every change restarts it, so a burst of
 * keystrokes settles once, and unmounting cancels it.
 *
 * Pass a primitive or an identity-stable value: an object literal is new every
 * render, restarts the timer each time and never settles. Compare the two to
 * know whether the reader is still typing:
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
