import { describe, expect, it } from 'vitest';
import { formatCountdown, formatElapsed, formatShortDuration } from './format-duration';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatCountdown', () => {
  it('counts down the way the frames do', () => {
    expect(formatCountdown(14 * HOUR + 56 * MINUTE + 54_000, 'en')).toBe('14h 56m 54s');
    expect(formatCountdown(2 * DAY + 3 * HOUR + 5 * MINUTE, 'en')).toBe('2d 3h 05m');
    expect(formatCountdown(4 * MINUTE + 7_000, 'en')).toBe('4m 07s');
  });

  it('writes the units in the reader’s language', () => {
    expect(formatCountdown(4 * MINUTE + 7_000, 'es')).toBe('4min 07s');
  });

  it('stops at zero', () => {
    expect(formatCountdown(-5_000, 'en')).toBe('0m 00s');
  });
});

describe('formatShortDuration', () => {
  it('keeps the largest unit', () => {
    expect(formatShortDuration(30_000, 'en')).toBe('1m');
    expect(formatShortDuration(45 * MINUTE, 'en')).toBe('45m');
    expect(formatShortDuration(5 * HOUR, 'en')).toBe('5h');
    expect(formatShortDuration(3 * DAY, 'en')).toBe('3d');
  });

  it('switches to days where the caller says', () => {
    expect(formatShortDuration(45 * HOUR, 'en')).toBe('2d');
    expect(formatShortDuration(45 * HOUR, 'en', { daysFrom: 48 })).toBe('45h');
  });
});

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

  it('never runs backwards', () => {
    expect(formatElapsed(-5_000)).toBe('00:00');
  });
});
