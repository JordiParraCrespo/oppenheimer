import * as React from 'react';

/**
 * Whether a box's content runs past it on one axis, for a toggle that should
 * appear only when it does something: `y` for a line-clamped box (Show
 * details, Show more), `x` for a sideways-scrolling one (a code block's
 * Wrap). Measured while `paused` is false; while the toggle is on (the clamp
 * lifted, the lines wrapped) nothing overflows by design, so the last answer
 * stands and the toggle stays to undo itself. `content` is what the box
 * shows, so new text is measured again even when the box keeps its size and
 * the observer has nothing to report.
 */
export function useBoxOverflow<T extends HTMLElement>(
  axis: 'x' | 'y',
  paused: boolean,
  content: unknown,
): { ref: React.RefObject<T | null>; overflows: boolean } {
  const ref = React.useRef<T>(null);
  const [overflows, setOverflows] = React.useState(false);

  // The outside system is the laid-out box; `content` is read through it.
  React.useEffect(() => {
    const box = ref.current;
    if (!box || paused) return;
    const measure = () =>
      setOverflows(
        axis === 'x' ? box.scrollWidth > box.clientWidth + 1 : box.scrollHeight > box.clientHeight + 1,
      );
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [axis, paused, content]);

  return { ref, overflows };
}
