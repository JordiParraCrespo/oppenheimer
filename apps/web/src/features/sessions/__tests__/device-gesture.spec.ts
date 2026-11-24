// @vitest-environment node
import { expect, it } from 'vitest';
import { gestureOf, type PointerSample } from '../lib/device-gesture';

/**
 * What a press on the Simulator's screen sends: a tap, a slow drag that stops
 * where it lifted, or a flick that flings. The drag's real duration goes with
 * it; before, every swipe went out at the device's default 300 ms, after
 * the pointer lifted, with no momentum, whatever the reader did.
 */

/** A drag down the screen from y=0.8 to y=0.3 over `ms`, sampled every 16 ms. */
function drag(ms: number, settleMs = 0): PointerSample[] {
  const trail: PointerSample[] = [];
  for (let t = 0; t <= ms; t += 16) trail.push({ x: 0.5, y: 0.8 - (0.5 * t) / ms, t });
  const end = trail.at(-1) ?? { x: 0.5, y: 0.3, t: ms };
  if (settleMs) trail.push({ ...end, t: end.t + settleMs });
  return trail;
}

it('takes a press that barely moved for a tap where it lifted', () => {
  expect(
    gestureOf([
      { x: 0.4, y: 0.4, t: 0 },
      { x: 0.405, y: 0.41, t: 90 },
    ]),
  ).toEqual({ kind: 'tap', x: 0.405, y: 0.41 });
});

it('sends a flick with its own short duration and momentum', () => {
  const gesture = gestureOf(drag(96));
  expect(gesture).toMatchObject({ kind: 'swipe', y: 0.8, durationMs: 96, momentum: true });
});

it('keeps a slow drag momentum-free, at the pace it was made', () => {
  const gesture = gestureOf(drag(1600));
  expect(gesture).toMatchObject({ kind: 'swipe', durationMs: 1600, momentum: false });
});

it('does not fling a fast drag the reader held still before lifting', () => {
  const gesture = gestureOf(drag(128, 200));
  expect(gesture).toMatchObject({ kind: 'swipe', durationMs: 328, momentum: false });
});

it('cuts a drag held past the wire’s limit to it', () => {
  expect(gestureOf(drag(12_000))).toMatchObject({ durationMs: 10_000 });
});

it('makes nothing of an empty trail', () => {
  expect(gestureOf([])).toBeNull();
});
