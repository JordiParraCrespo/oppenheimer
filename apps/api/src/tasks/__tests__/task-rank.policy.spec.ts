import { describe, expect, it } from 'vitest';
import { isRank, rankBetween } from '../domain/task-rank.policy';

/**
 * The board's order is the byte order of these keys, so the property that
 * matters is the one a move relies on: whatever two neighbours a card is dropped
 * between, the new key sorts strictly between them and can be split again.
 */
describe('rankBetween', () => {
  const sorted = (keys: string[]) => [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  it('finds a key between any two neighbours, however many times a gap is split', () => {
    let lower = '';
    let upper: string | null = null;
    const keys: string[] = [];
    // Always into the same gap: the case that makes keys grow.
    for (let i = 0; i < 200; i += 1) {
      const key = rankBetween(lower, upper);
      expect(isRank(key)).toBe(true);
      if (lower) expect(key > lower).toBe(true);
      if (upper !== null) expect(key < upper).toBe(true);
      keys.push(key);
      if (i % 2 === 0) upper = key;
      else lower = key;
    }
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('appends after the last key and before the first without collisions', () => {
    const keys = [rankBetween('', null)];
    for (let i = 0; i < 100; i += 1) keys.push(rankBetween(keys[keys.length - 1], null));
    for (let i = 0; i < 100; i += 1) keys.unshift(rankBetween('', keys[0]));
    expect(sorted(keys)).toEqual(keys);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('refuses neighbours that are out of order, rather than inventing an order', () => {
    expect(() => rankBetween('b', 'a')).toThrow(RangeError);
    expect(() => rankBetween('a', 'a')).toThrow(RangeError);
  });
});
