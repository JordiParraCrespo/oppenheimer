import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { searchFlag, searchPage, searchText } from './search-params';

/** A URL is typed by people and by other sites: a wrong shape reads as absent, never as a failed route. */
describe('search params', () => {
  const schema = z.object({ q: searchText, on: searchFlag, page: searchPage });

  it('reads well-formed values', () => {
    expect(schema.parse({ q: 'ada', on: '1', page: '3' })).toEqual({ q: 'ada', on: true, page: 3 });
  });

  it('reads the router’s own re-validated output', () => {
    expect(schema.parse({ on: true, page: 3 })).toEqual({ on: true, page: 3 });
  });

  it('reads anything else as absent', () => {
    expect(schema.parse({ q: '', on: 'yes', page: '0' })).toEqual({});
    expect(schema.parse({ q: 42, on: 0, page: 'two' })).toEqual({});
  });

  it('drops a key the schema does not name', () => {
    expect(schema.parse({ q: 'ada', stray: 'x' })).toEqual({ q: 'ada' });
  });
});
