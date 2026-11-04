import { useEffect, useEffectEvent, useRef, useState } from 'react';

/**
 * How long the spinner at the top of a chat shows before the earlier turns
 * it stands for are drawn: long enough to read as loading, not as a flicker.
 */
const EARLIER_AFTER_MS = 1000;

/**
 * Draws a chat's earlier turns once the reader scrolls up to the element
 * given to the returned ref: `showEarlier` runs `EARLIER_AFTER_MS` after it
 * comes into view, once however often it is seen meanwhile.
 *
 * Effects: an `IntersectionObserver` on that element, and the timer. An
 * element still in view after the turns were added is not seen again by the
 * observer, so the caller keys it by how many turns are left above it, and
 * the new one is observed afresh.
 */
export function useEarlierOnReach(showEarlier: () => void): (element: HTMLElement | null) => void {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useEffectEvent(showEarlier);
  const reached = useEffectEvent(() => {
    if (timer.current !== null) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      show();
    }, EARLIER_AFTER_MS);
  });
  useEffect(() => {
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) reached();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return setElement;
}
