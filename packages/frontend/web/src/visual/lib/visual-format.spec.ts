import { describe, expect, it } from 'vitest';
import { formatVisualDelta, formatVisualNumber, keyed, niceTicks } from './visual-format';
import { nextVisualSort, sortVisualRows } from './visual-table';

describe('formatVisualNumber', () => {
  it('reads a number with the spec prefix, suffix and compact form', () => {
    expect(formatVisualNumber(1234.5, { prefix: '$' }, 'en')).toBe('$1,234.5');
    expect(formatVisualNumber(1520, { compact: true }, 'en')).toBe('1.5K');
    expect(formatVisualNumber(42, { suffix: '%', decimals: 1 }, 'en')).toBe('42.0%');
  });

  // A minus before the prefix ("−$5"), not inside it ("$-5").
  it('puts a typographic minus before the prefix', () => {
    expect(formatVisualNumber(-5, { prefix: '$' }, 'en')).toBe('−$5');
    expect(formatVisualDelta(-2.5, { suffix: '%' }, 'en')).toBe('−2.5%');
    expect(formatVisualDelta(6, undefined, 'en')).toBe('+6');
  });
});

describe('niceTicks', () => {
  it('rules round steps from zero to just over the highest value', () => {
    expect(niceTicks([3, 87, 42])).toEqual([0, 25, 50, 75, 100]);
  });

  it('reaches under zero when a value does', () => {
    expect(niceTicks([-12, 30])[0]).toBeLessThanOrEqual(-12);
  });

  // All zeros would otherwise divide by nothing and draw no axis.
  it('draws an axis for a flat series', () => {
    expect(niceTicks([0, 0])).toEqual([0, 1]);
  });
});

describe('sortVisualRows', () => {
  const rows = [
    ['item 10', 3],
    ['item 9', null],
    ['Item 2', 12],
  ] as const;

  it('sorts words in natural order and numbers by value, empty cells last', () => {
    expect(sortVisualRows(rows, { column: 0, direction: 'asc' }, 'en').map((r) => r[0])).toEqual([
      'Item 2',
      'item 9',
      'item 10',
    ]);
    expect(sortVisualRows(rows, { column: 1, direction: 'desc' }, 'en').map((r) => r[1])).toEqual([
      12,
      3,
      null,
    ]);
    expect(sortVisualRows(rows, { column: 1, direction: 'asc' }, 'en').map((r) => r[1])).toEqual([
      3,
      12,
      null,
    ]);
  });

  it('cycles a column through largest first, smallest first, then as given', () => {
    const first = nextVisualSort(null, 1, true);
    expect(first).toEqual({ column: 1, direction: 'desc' });
    const second = nextVisualSort(first, 1, true);
    expect(second).toEqual({ column: 1, direction: 'asc' });
    expect(nextVisualSort(second, 1, true)).toBeNull();
  });
});

describe('keyed', () => {
  // Two rows named alike must not share a React key, or one would vanish.
  it('numbers a repeated name instead of reusing its key', () => {
    expect(keyed(['CI', 'Lint', 'CI'], (x) => x).map((k) => k.key)).toEqual(['CI', 'Lint', 'CI·2']);
  });
});
