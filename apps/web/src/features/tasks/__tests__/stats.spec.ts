import { describe, expect, it } from 'vitest';
import { deltaOf, presetRange, resolveStatsPeriod, ticksFor } from '../lib/stats';

describe('Stats period', () => {
  const today = '2026-10-13';

  it('ends every preset today, the quarter and the year at their first day', () => {
    expect(presetRange('7d', today)).toEqual({ from: '2026-10-07', to: today });
    expect(presetRange('8w', today)).toEqual({ from: '2026-08-19', to: today });
    expect(presetRange('qtd', today)).toEqual({ from: '2026-10-01', to: today });
    expect(presetRange('ytd', today)).toEqual({ from: '2026-01-01', to: today });
  });

  it('takes a custom range only when it is real, ordered and not in the future', () => {
    expect(resolveStatsPeriod({ from: '2026-09-01', to: '2026-09-30' }, today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      preset: null,
    });
    // Ends after today, reversed, or longer than a year and a week: the default preset.
    for (const range of [
      { from: '2026-10-01', to: '2026-10-20' },
      { from: '2026-09-30', to: '2026-09-01' },
      { from: '2025-01-01', to: '2026-10-01' },
    ]) {
      expect(resolveStatsPeriod(range, today).preset).toBe('8w');
    }
    expect(resolveStatsPeriod({ range: '4w' }, today)).toEqual({
      from: '2026-09-16',
      to: today,
      preset: '4w',
    });
  });
});

describe('Stats deltas and ticks', () => {
  it('says whether a change is good by which direction is better', () => {
    expect(deltaOf(12, 10, 'up')).toEqual({ value: '+20%', tone: 'good' });
    expect(deltaOf(12, 10, 'down')).toEqual({ value: '+20%', tone: 'bad' });
    expect(deltaOf(8, 10, 'none')).toEqual({ value: '−20%', tone: 'flat' });
  });

  it('draws no delta without a previous figure, or from zero to something', () => {
    expect(deltaOf(5, null, 'up')).toBeNull();
    expect(deltaOf(null, 5, 'up')).toBeNull();
    expect(deltaOf(5, 0, 'up')).toBeNull();
    expect(deltaOf(0, 0, 'up')).toEqual({ value: '0%', tone: 'flat' });
  });

  it('rules five round ticks from zero that cover the top value', () => {
    expect(ticksFor(0)).toEqual([0, 1, 2, 3, 4]);
    expect(ticksFor(7)).toEqual([0, 2, 4, 6, 8]);
    expect(ticksFor(1_234_000)).toEqual([0, 500_000, 1_000_000, 1_500_000, 2_000_000]);
  });
});
