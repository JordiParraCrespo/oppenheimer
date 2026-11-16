import * as React from 'react';

/**
 * Whether a sideways-scrolling box holds a line wider than itself, for a Wrap
 * toggle that should appear only when there is a line to fold. Measured on
 * the box while it is unwrapped; while `wrapped` nothing overflows by design,
 * so the last answer stands and the toggle stays to unwrap. `content` is what
 * the box shows, so new text is measured again even when the box keeps its
 * size and the observer has nothing to report.
 */
export function useWideLines<T extends HTMLElement>(
  wrapped: boolean,
  content: unknown,
): { ref: React.RefObject<T | null>; wide: boolean } {
  const ref = React.useRef<T>(null);
  const [wide, setWide] = React.useState(false);

  // The outside system is the laid-out box; `content` is read through it.
  React.useEffect(() => {
    const box = ref.current;
    if (!box || wrapped) return;
    const measure = () => setWide(box.scrollWidth > box.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [wrapped, content]);

  return { ref, wide };
}
