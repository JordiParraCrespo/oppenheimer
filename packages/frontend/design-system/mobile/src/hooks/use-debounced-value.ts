import { useEffect, useState } from 'react';

/**
 * `value`, once it has stopped changing for `delayMs`. The settled value a
 * field hands down while its own state keeps every keystroke — the mobile
 * twin of the web design system's hook of the same name. Synchronises with a
 * timer.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
