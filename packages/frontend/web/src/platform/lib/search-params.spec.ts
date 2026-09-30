import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { searchFlag, searchPage, searchText } from './search-params';

describe('search params', () => {
  const schema = z.object({ q: searchText, on: searchFlag, page: searchPage });

  it('reads well-formed values', () => {
    expect(schema.parse({ q: 'ada', page: '3' })).toEqual({ q: 'ada', page: 3 });
  });

  it('reads the router’s own re-validated output', () => {
    expect(schema.parse({ page: 3 })).toEqual({ page: 3 });
  });

  // A link writes `1` or `true`; the router hands back `true`. Nothing else is on.
  it.each([
    ['1', true],
    [1, true],
    ['true', true],
    [true, true],
    ['0', undefined],
    ['false', undefined],
    [false, undefined],
    [0, undefined],
    ['yes', undefined],
    [undefined, undefined],
  ])('reads the flag %j as %j', (on, expected) => {
    expect(schema.parse({ on }).on).toBe(expected);
  });

  it('reads anything else as absent', () => {
    expect(schema.parse({ q: '', page: '0' })).toEqual({});
    expect(schema.parse({ q: 42, page: 'two' })).toEqual({});
  });

  it('drops a key the schema does not name', () => {
    expect(schema.parse({ q: 'ada', stray: 'x' })).toEqual({ q: 'ada' });
  });
});
