import { describe, expect, it } from 'vitest';
import { atFoot } from '../lib/stick-to-bottom';

const place = (offset: number, content: number, view = 600) => ({
  contentOffset: { y: offset },
  contentSize: { height: content },
  layoutMeasurement: { height: view },
});

/**
 * Whether a terminal or a chat keeps following its newest line. What breaks
 * if this drifts: every new line pulls a reader who scrolled up to read back
 * to the bottom, or a reader resting a few points short of the end after a
 * fling is left behind while output keeps arriving.
 */
describe('sticking to the foot of a growing list', () => {
  it('follows a reader at the foot, or a line or two short of it', () => {
    expect(atFoot(place(1400, 2000))).toBe(true);
    expect(atFoot(place(1360, 2000))).toBe(true);
  });

  it('lets a reader who scrolled up stay where they are', () => {
    expect(atFoot(place(1000, 2000))).toBe(false);
    expect(atFoot(place(0, 2000))).toBe(false);
  });

  it('counts content shorter than the view, and a bounce past the end, as at the foot', () => {
    expect(atFoot(place(0, 300))).toBe(true);
    expect(atFoot(place(1450, 2000))).toBe(true);
  });
});
