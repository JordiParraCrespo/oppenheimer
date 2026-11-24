import type { DeviceInput } from '@oppenheimer/frontend-consumer';

/** Where the reader's pointer was on the device's screen, and when (ms). */
export interface PointerSample {
  x: number;
  y: number;
  t: number;
}

/** A press that moves less than this (a fraction of the screen) is a tap. */
const TAP_SLOP = 0.02;

/** The window the release speed is read over: the last moments of the drag. */
const RELEASE_WINDOW_MS = 80;

/**
 * The release speed, in screens a second, above which a drag was a flick:
 * the finger left the screen moving, and the content should fling on. A slow
 * drag, or one held still before it lifted, falls well under it.
 */
const FLICK_SPEED = 1;

/** DEVICE_SWIPE_MAX_MS: the longest swipe the wire takes. */
const SWIPE_MAX_MS = 10_000;

/**
 * The input a press makes, from its trail: where it went down, where it
 * moved, where it lifted, in order. A press that barely moved is a tap where
 * it lifted. Anything else is a swipe from the first point to the last,
 * played back over the time it took, with momentum when the pointer was
 * still moving fast as it lifted.
 */
export function gestureOf(trail: readonly PointerSample[]): DeviceInput | null {
  const first = trail[0];
  const last = trail.at(-1);
  if (!first || !last) return null;
  if (Math.hypot(last.x - first.x, last.y - first.y) <= TAP_SLOP) {
    return { kind: 'tap', x: last.x, y: last.y };
  }
  const durationMs = Math.min(SWIPE_MAX_MS, Math.max(1, Math.round(last.t - first.t)));
  return {
    kind: 'swipe',
    x: first.x,
    y: first.y,
    toX: last.x,
    toY: last.y,
    durationMs,
    momentum: releaseSpeed(trail) >= FLICK_SPEED,
  };
}

/** How fast the pointer moved over the last RELEASE_WINDOW_MS, in screens a second. */
function releaseSpeed(trail: readonly PointerSample[]): number {
  const last = trail.at(-1);
  if (!last) return 0;
  let from = last;
  for (let i = trail.length - 2; i >= 0; i -= 1) {
    const sample = trail[i];
    if (!sample || last.t - sample.t > RELEASE_WINDOW_MS) break;
    from = sample;
  }
  const elapsed = last.t - from.t;
  if (elapsed <= 0) return 0;
  return (Math.hypot(last.x - from.x, last.y - from.y) / elapsed) * 1000;
}
