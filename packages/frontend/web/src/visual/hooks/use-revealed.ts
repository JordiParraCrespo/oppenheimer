import { useEffect, useState } from 'react';

function reducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * False for the first frame a mark is on screen and true from the next, so a
 * bar or a ring can grow from nothing to its value with a CSS transition. A
 * reader who asked for less motion gets the value at once.
 */
export function useRevealed(): boolean {
  const [revealed, setRevealed] = useState(reducedMotion);
  useEffect(() => {
    if (revealed) return;
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setRevealed(true)));
    return () => cancelAnimationFrame(frame);
  }, [revealed]);
  return revealed;
}

/**
 * A figure counting up from zero to `target` over `duration`, eased out, the
 * first time it is shown; the target itself after that and for a reader who
 * asked for less motion. A whole target counts in whole steps.
 */
export function useCountUp(target: number, duration = 700): number {
  const [value, setValue] = useState(() => (reducedMotion() ? target : 0));
  const [done, setDone] = useState(reducedMotion);
  useEffect(() => {
    if (done) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const whole = Number.isInteger(target);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = target * eased;
      setValue(whole ? Math.round(next) : next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else setDone(true);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, done]);
  return value;
}
