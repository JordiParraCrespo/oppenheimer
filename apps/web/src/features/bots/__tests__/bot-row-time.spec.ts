import { describe, expect, it } from 'vitest';
import { botRowTime } from '../lib/row-time';

// Local times, so the reader's day is the one the test means.
const NOW = new Date(2026, 10, 22, 10, 0).getTime();

describe('botRowTime', () => {
  it('says the time today, yesterday by name, the weekday within the week, then the date', () => {
    expect(botRowTime(new Date(2026, 10, 22, 9, 28), NOW, 'en-GB')).toEqual({
      kind: 'text',
      text: '09:28',
    });
    expect(botRowTime(new Date(2026, 10, 21, 23, 59), NOW, 'en-GB')).toEqual({ kind: 'yesterday' });
    expect(botRowTime(new Date(2026, 10, 16, 12, 0), NOW, 'en-GB')).toEqual({
      kind: 'text',
      text: 'Mon',
    });
    expect(botRowTime(new Date(2026, 10, 3, 12, 0), NOW, 'en-GB')).toEqual({
      kind: 'text',
      text: '3 Nov',
    });
    expect(botRowTime(new Date(2025, 10, 3, 12, 0), NOW, 'en-GB')).toEqual({
      kind: 'text',
      text: '3 Nov 2025',
    });
  });
});
