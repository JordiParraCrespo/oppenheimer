import { useCallback, useEffect, useRef } from 'react';

/**
 * Calls `callback` once `delay` has passed without another call.
 *
 * The outside system is the timer: a pending `setTimeout` outlives the render
 * that scheduled it, so unmounting cancels it, or a settled search would fire
 * into a component that is gone.
 *
 * `useCallback` and the ref are the exception the rule allows: the returned
 * function goes to an input's `onChange`, and a new identity every render would
 * make the field a re-render path for everything above it.
 *
 * `cancelKey` drops a pending call whenever it changes (`useSearchDraft` passes
 * a revision it bumps when the URL changes under the field). To read the
 * settled value during render, use `useDebouncedValue`.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number,
  cancelKey?: unknown,
): (...args: TArgs) => void {
  // The latest callback, so a timer set a few renders ago calls today's.
  // Written after commit: the React Compiler skips a ref written during render.
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    void cancelKey;
    // The timer: cancelled when `cancelKey` changes, and on unmount.
    clearTimeout(timer.current);
    return () => clearTimeout(timer.current);
  }, [cancelKey]);

  return useCallback(
    (...args: TArgs) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}
