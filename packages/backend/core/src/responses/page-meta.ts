import type { Paginated } from '@oppenheimer/backend-ddd';

/** Where the caller is in a counted result set: the `meta` of a paginated response. */
export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * The `meta` of a page-mode list response, from what the repository returned.
 *
 * `totalPages` is 0 for an empty set and never `Infinity`: every request schema
 * refuses a `limit` of 0 today, and this keeps the answer finite if one ever
 * admits it.
 */
export function toPageMeta(page: Pick<Paginated<unknown>, 'count' | 'page' | 'limit'>): PageMeta {
  return {
    total: page.count,
    page: page.page,
    limit: page.limit,
    totalPages: page.limit > 0 ? Math.ceil(page.count / page.limit) : 0,
  };
}
