// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fitWithin } from '../lib/new-session-background';

// A camera photo kept at full size overflows localStorage's quota and the
// background silently fails to survive a reload; the downscale is what keeps it.
describe('fitWithin', () => {
  it('scales the longest edge down to the cap, keeping the aspect ratio', () => {
    expect(fitWithin(6000, 4000, 2560)).toEqual({ width: 2560, height: 1707 });
    expect(fitWithin(3000, 6000, 2560)).toEqual({ width: 1280, height: 2560 });
  });

  it('never enlarges an image already within the cap', () => {
    expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 });
  });
});
