import * as React from 'react';

/**
 * Whether a line-clamped box hides text, for a toggle that should appear only
 * when there is more to show (Show details, Show more). Measured on the
 * clamped box: while `open` the clamp is off and the last answer stands.
 * `content` is what the box shows, so new text is measured again even when
 * the clamped box keeps its size and the observer has nothing to report.
 */
export function useClampedOverflow<T extends HTMLElement>(
  open: boolean,
  content: unknown,
): { ref: React.RefObject<T | null>; overflows: boolean } {
  const ref = React.useRef<T>(null);
  const [overflows, setOverflows] = React.useState(false);

  // The outside system is the laid-out box; `content` is read through it.
  React.useEffect(() => {
    const box = ref.current;
    if (!box || open) return;
    const measure = () => setOverflows(box.scrollHeight > box.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [open, content]);

  return { ref, overflows };
}
