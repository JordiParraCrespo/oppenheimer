import { describe, expect, it, vi } from 'vitest';
import { paginateRows } from './paginate-rows';

/**
 * The slice for lists the server hands over whole — members, roles, API tokens.
 * The clamping is the part worth pinning: a search that shrinks the list must
 * move the reader to the last page that exists rather than stranding them on an
 * empty table that reads as "your filter matched nothing".
 */

const ROWS = Array.from({ length: 25 }, (_, i) => `row-${i + 1}`);

function query(page: number) {
  return { page, setPage: vi.fn() };
}

describe('paginateRows', () => {
  it('cuts the requested page', () => {
    const { rows } = paginateRows(ROWS, 10, query(2));

    expect(rows).toEqual(ROWS.slice(10, 20));
  });

  it('returns a short final page rather than padding it', () => {
    expect(paginateRows(ROWS, 10, query(3)).rows).toEqual([
      'row-21',
      'row-22',
      'row-23',
      'row-24',
      'row-25',
    ]);
  });

  it('reports the totals the table renders', () => {
    const { pagination } = paginateRows(ROWS, 10, query(2));

    expect(pagination).toMatchObject({
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
    });
  });

  it('passes the page setter straight through', () => {
    const q = query(1);

    expect(paginateRows(ROWS, 10, q).pagination.onPageChange).toBe(q.setPage);
  });

  describe('clamping', () => {
    it('shows the last real page when the URL asks past the end', () => {
      // The reader was on page 4 and typed a search that left one page. Showing
      // them page 4 of 1 is an empty table they read as "no matches".
      const { rows, pagination } = paginateRows(ROWS, 10, query(9));

      expect(pagination.page).toBe(3);
      expect(rows).toEqual(ROWS.slice(20));
    });

    it('does not write the clamped page back to the URL', () => {
      // Clamping only fixes what is rendered. Going back to a wider query has
      // to put the reader where they were, which it cannot do if the narrow
      // query rewrote the page.
      const q = query(9);

      paginateRows(ROWS, 10, q);

      expect(q.setPage).not.toHaveBeenCalled();
    });

    it('clamps a zero or negative page up to the first', () => {
      expect(paginateRows(ROWS, 10, query(0)).pagination.page).toBe(1);
      expect(paginateRows(ROWS, 10, query(-3)).pagination.page).toBe(1);
    });
  });

  describe('an empty list', () => {
    it('reports one page rather than zero', () => {
      // `totalPages: 0` renders as "Page 1 of 0", and a pager with no pages has
      // no first page to send the reader back to.
      const { rows, pagination } = paginateRows([], 10, query(1));

      expect(rows).toEqual([]);
      expect(pagination).toMatchObject({ page: 1, total: 0, totalPages: 1 });
    });
  });

  it('fits an exact multiple into whole pages', () => {
    // 20 rows at 10 per page is two pages, not three — the classic off-by-one
    // in a `ceil`-based pager.
    expect(paginateRows(ROWS.slice(0, 20), 10, query(1)).pagination.totalPages).toBe(2);
  });

  it('handles a page size larger than the list', () => {
    const { rows, pagination } = paginateRows(ROWS, 100, query(1));

    expect(rows).toHaveLength(25);
    expect(pagination.totalPages).toBe(1);
  });

  it('does not mutate the list it was given', () => {
    const rows = [...ROWS];

    paginateRows(rows, 10, query(2));

    expect(rows).toEqual(ROWS);
  });
});
