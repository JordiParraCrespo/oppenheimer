import { useCallback, useEffect, useRef } from 'react';

/**
 * Calls `callback` once `delay` has passed without another call.
 *
 * The outside system this synchronises with is the timer: a pending `setTimeout`
 * outlives the render that scheduled it, so unmounting has to cancel it or a
 * settled search fires into a component that is gone. That is the whole reason
 * this lives in `hooks/` rather than inline in the field.
 *
 * `useCallback` and the ref are the exception the rule allows: the returned
 * function is handed to an input's `onChange`, and a new identity every render
 * would make the field a re-render path for everything above it — which is the
 * problem the debounce exists to solve.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number,
  cancelKey?: unknown,
): (...args: TArgs) => void {
  const latest = useRef(callback);
  latest.current = callback;

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    void cancelKey;
    // The timer: cancelled when its owner invalidates the pending work, and on
    // unmount so a settled value never lands on a component that has gone.
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
