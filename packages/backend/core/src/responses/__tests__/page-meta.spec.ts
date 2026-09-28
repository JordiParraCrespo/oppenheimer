import { describe, expect, it } from 'vitest';
import { toPageMeta } from '../page-meta';

describe('toPageMeta', () => {
  it('renames count to total and passes page and limit through', () => {
    expect(toPageMeta({ count: 41, page: 2, limit: 20 })).toEqual({
      total: 41,
      page: 2,
      limit: 20,
      totalPages: 3,
    });
  });

  it('has no pages for an empty set', () => {
    expect(toPageMeta({ count: 0, page: 1, limit: 20 }).totalPages).toBe(0);
  });

  it('does not add a page when the count divides evenly', () => {
    expect(toPageMeta({ count: 40, page: 1, limit: 20 }).totalPages).toBe(2);
  });

  it('answers 0, not Infinity, for a limit of 0', () => {
    expect(toPageMeta({ count: 5, page: 1, limit: 0 }).totalPages).toBe(0);
  });
});
