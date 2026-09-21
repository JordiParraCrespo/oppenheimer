import { describe, expect, it } from 'vitest';
import { formatElapsed } from '../lib/elapsed';

/**
 * The provisioning clock. The hour is where this earns its keep: a session
 * stuck "starting" since yesterday has to read as broken, and `1247:33` reads
 * as a bug in the clock instead.
 */
describe('formatElapsed', () => {
  it('pads to mm:ss', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(7_000)).toBe('00:07');
    expect(formatElapsed(72_000)).toBe('01:12');
  });

  it('grows an hours field rather than counting past 60 minutes', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
    expect(formatElapsed(3_723_000)).toBe('1:02:03');
  });

  // A clock read a moment before the row it is measuring was written — two
  // machines, two clocks — counts from zero rather than backwards.
  it('never runs backwards', () => {
    expect(formatElapsed(-5_000)).toBe('00:00');
  });
});
