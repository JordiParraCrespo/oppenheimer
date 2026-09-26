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
 *
 * `cancelKey` drops a pending call whenever it changes: pass something that
 * says the work queued so far is stale (the kit's `useSearchDraft` passes a
 * revision it bumps when the URL changes under the field). When the settled
 * value is read during render rather than handed up, `useDebouncedValue` is
 * the simpler tool.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number,
  cancelKey?: unknown,
): (...args: TArgs) => void {
  // The latest callback, so a timer set a few renders ago calls today's. It is
  // written after commit rather than during render: a ref written in render is
  // one of the things the React Compiler silently refuses to compile.
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });

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
