import { describe, expect, it } from 'vitest';
import { deepMerge } from '../deep-merge';

describe('deepMerge', () => {
  it('merges nested objects without mutating inputs', () => {
    const base = { a: 1, nested: { x: 1, y: 2 } };
    const override = { nested: { y: 9 } };
    const result = deepMerge(base, override);
    expect(result).toEqual({ a: 1, nested: { x: 1, y: 9 } });
    expect(base.nested.y).toBe(2);
  });

  it('replaces arrays wholesale', () => {
    expect(deepMerge({ tags: ['a'] }, { tags: ['b', 'c'] })).toEqual({ tags: ['b', 'c'] });
  });

  it('ignores undefined in the override', () => {
    expect(deepMerge({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
  });
});
