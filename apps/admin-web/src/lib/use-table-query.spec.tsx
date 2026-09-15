import { act, renderHook } from '@testing-library/react';
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTableQuery } from './use-table-query';

/**
 * Every table in the app answers four questions — searched, filtered, sorted,
 * which page — and this hook is where the answers live so a filtered table can
 * be pasted into a message. Two rules are encoded here rather than in each
 * screen, and both are what these tests exist for:
 *
 *  - narrowing the list returns to page one, in the same update;
 *  - the URL is user input, so a hand-edited `?page=-3` or `?filter=bogus`
 *    must not reach a query.
 *
 * Driven through nuqs' own testing adapter rather than a stub, so the parsers,
 * the prefixing and the defaults are the real ones.
 */

function setup(searchParams = '', options: Parameters<typeof useTableQuery>[0] = {}) {
  return renderHook(() => useTableQuery(options), {
    wrapper: withNuqsTestingAdapter({ searchParams }),
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useTableQuery', () => {
  describe('defaults', () => {
    it('starts empty, on page one, unfiltered', () => {
      const { result } = setup();

      expect(result.current.search).toBe('');
      expect(result.current.filters).toEqual([]);
      expect(result.current.page).toBe(1);
      expect(result.current.isFiltered).toBe(false);
    });

    it('reads the query straight out of the URL', () => {
      const { result } = setup('?q=acme&filter=active&page=3');

      expect(result.current.search).toBe('acme');
      expect(result.current.filters).toEqual(['active']);
      expect(result.current.page).toBe(3);
    });

    it('starts searchQuery equal to search so a followed link asks once, now', () => {
      // Waiting out the debounce here would show every reader an unfiltered
      // table for 300ms before the one they were linked to.
      const { result } = setup('?q=acme');

      expect(result.current.searchQuery).toBe('acme');
    });
  });

  describe('the page guard', () => {
    it.each(['?page=0', '?page=-3'])('clamps %s up to the first page', (params) => {
      // The footer would otherwise count backwards and offer "-7–0 of 12".
      const { result } = setup(params);

      expect(result.current.page).toBe(1);
    });

    it('leaves a valid page alone', () => {
      expect(setup('?page=4').result.current.page).toBe(4);
    });
  });

  describe('filter sanitising', () => {
    const filters = ['active', 'paused'] as const;

    it('drops a value outside the allowed set', () => {
      // `?filter=bogus` is one hand-edit or one stale link away, and the screens
      // put these straight into an API query whose Zod schema only knows the
      // real statuses.
      const { result } = setup('?filter=bogus', { filters });

      expect(result.current.filters).toEqual([]);
    });

    it('keeps the good values from a mixed list', () => {
      // Sanitised on the way out rather than in the parser, so one junk value
      // does not discard the whole filter.
      const { result } = setup('?filter=active,bogus,paused', { filters });

      expect(result.current.filters).toEqual(['active', 'paused']);
    });

    it('passes everything through when no allowed set is declared', () => {
      // Team's role facet is a list of ids from the server, so an id that
      // matches nothing simply matches nothing.
      const { result } = setup('?filter=role-1,role-2');

      expect(result.current.filters).toEqual(['role-1', 'role-2']);
    });

    it('counts a sanitised-away filter as unfiltered', () => {
      // Otherwise an empty table claims the reader narrowed it, when what
      // actually happened is their link was stale.
      const { result } = setup('?filter=bogus', { filters });

      expect(result.current.isFiltered).toBe(false);
    });
  });

  describe('the single-valued facet', () => {
    const choice = { choice: 'domain' } as const;

    it('is nothing picked by default', () => {
      expect(setup('', choice).result.current.choice).toBeNull();
    });

    it('reads its own URL key', () => {
      // The leads table narrows by stage *and* by domain, and the two speak
      // different vocabularies — one key holding both would make "which of
      // these is a stage" a guess.
      const { result } = setup('?filter=new&domain=acme.com', choice);

      expect(result.current.filters).toEqual(['new']);
      expect(result.current.choice).toBe('acme.com');
    });

    it.each(['?domain=', '?domain=%20%20'])('reads %s as nothing picked', (params) => {
      // What a hand-edited URL leaves behind. Sent as a filter it asks the
      // endpoint for leads whose domain is the empty string, which is no lead.
      const { result } = setup(params, choice);

      expect(result.current.choice).toBeNull();
      expect(result.current.isFiltered).toBe(false);
    });

    it('resets the page when the choice changes', () => {
      const { result } = setup('?page=4', choice);

      act(() => result.current.setChoice('acme.com'));

      expect(result.current.page).toBe(1);
      expect(result.current.choice).toBe('acme.com');
    });

    it('clears back to nothing picked', () => {
      const { result } = setup('?domain=acme.com', choice);

      act(() => result.current.setChoice(null));

      expect(result.current.choice).toBeNull();
    });

    it('takes the table prefix like every other key', () => {
      const { result } = setup('?leads_domain=acme.com&domain=other', {
        ...choice,
        prefix: 'leads',
      });

      expect(result.current.choice).toBe('acme.com');
    });

    it('leaves a screen that declared no key alone', () => {
      // The parser is registered either way, so the returned shape does not
      // change with the options — but nothing writes a key nobody asked for.
      const { result } = setup('?domain=acme.com');

      expect(result.current.choice).toBeNull();
      expect(result.current.isFiltered).toBe(false);
    });
  });

  describe('isFiltered', () => {
    it('is true when something is searched', () => {
      expect(setup('?q=acme').result.current.isFiltered).toBe(true);
    });

    it('is true when something is filtered', () => {
      expect(setup('?filter=active').result.current.isFiltered).toBe(true);
    });

    it('is true when the single-valued facet is picked', () => {
      expect(setup('?domain=acme.com', { choice: 'domain' }).result.current.isFiltered).toBe(true);
    });

    it('ignores a whitespace-only search', () => {
      // An empty *filtered* table says something different from an empty
      // workspace, and a stray space is not the reader narrowing anything.
      expect(setup('?q=%20%20').result.current.isFiltered).toBe(false);
    });
  });

  describe('returning to page one', () => {
    it('resets the page when the filters change', () => {
      // Page 4 of an unfiltered list is rarely a page of the filtered one, and
      // an out-of-range page renders as "no results" — which reads as "your
      // filter matched nothing".
      const { result } = setup('?page=4');

      act(() => result.current.setFilters(['active']));

      expect(result.current.page).toBe(1);
      expect(result.current.filters).toEqual(['active']);
    });

    it('resets the page when the sort changes', () => {
      const { result } = setup('?page=4', {
        sort: { key: 'name', order: 'asc', keys: ['name'] },
      });

      act(() => result.current.setSort('name', 'desc'));

      expect(result.current.page).toBe(1);
      expect(result.current.sort).toEqual({ key: 'name', order: 'desc' });
    });

    it('resets the page when the search changes', () => {
      const { result } = setup('?page=4');

      act(() => result.current.setSearch('acme'));

      expect(result.current.page).toBe(1);
    });

    it('does not reset the page when the page itself changes', () => {
      const { result } = setup();

      act(() => result.current.setPage(3));

      expect(result.current.page).toBe(3);
    });
  });

  describe('sorting', () => {
    it('reads a sort key the screen declared', () => {
      const { result } = setup('?sort=name&order=asc', {
        sort: { key: 'created', order: 'desc', keys: ['name', 'created'] },
      });

      expect(result.current.sort).toEqual({ key: 'name', order: 'asc' });
    });

    it('falls back to the declared default for a key the endpoint does not accept', () => {
      // A key outside `sort.keys` never reaches the query — the endpoint would
      // reject it, and the table would show an error instead of a sort.
      const { result } = setup('?sort=passwordHash', {
        sort: { key: 'created', order: 'desc', keys: ['name', 'created'] },
      });

      expect(result.current.sort.key).toBe('created');
    });

    it('falls back for an order that is neither asc nor desc', () => {
      const { result } = setup('?order=sideways', {
        sort: { key: 'created', order: 'desc', keys: ['created'] },
      });

      expect(result.current.sort.order).toBe('desc');
    });

    it('still carries a sort pair for a table with inert headers', () => {
      // The returned shape does not change with the options, so a caller never
      // has to check whether `sort` is there.
      const { result } = setup();

      expect(result.current.sort).toEqual({ key: '', order: 'desc' });
    });
  });

  describe('prefixing', () => {
    it('reads its own keys when two tables share a route', () => {
      // Team's members and roles tabs are both `/team` and would otherwise
      // fight over `?q=`.
      const { result } = setup('?members_q=ada&q=other', { prefix: 'members' });

      expect(result.current.search).toBe('ada');
    });

    it('keeps two tables on one route independent', () => {
      // The failure this guards is not a crash: both tabs would simply show
      // each other's search, and filtering one would page the other.
      const { result } = renderHook(
        () => ({
          members: useTableQuery({ prefix: 'members' }),
          roles: useTableQuery({ prefix: 'roles' }),
        }),
        {
          wrapper: withNuqsTestingAdapter({
            searchParams: '?members_q=ada&roles_q=editor&roles_page=3',
          }),
        },
      );

      expect(result.current.members.search).toBe('ada');
      expect(result.current.roles.search).toBe('editor');
      expect(result.current.roles.page).toBe(3);

      act(() => result.current.members.setSearch('grace'));

      expect(result.current.members.search).toBe('grace');
      expect(result.current.roles.search).toBe('editor');
      expect(result.current.roles.page).toBe(3);
    });

    it('an unprefixed table does not read a prefixed key', () => {
      const { result } = setup('?members_q=ada');

      expect(result.current.search).toBe('');
    });
  });

  describe('the search debounce', () => {
    it('updates `search` on the keystroke so the input never lags', () => {
      const { result } = setup();

      act(() => result.current.setSearch('a'));

      expect(result.current.search).toBe('a');
    });

    it('holds `searchQuery` back until typing settles', () => {
      // One request per search rather than one per character.
      const { result } = setup();

      act(() => result.current.setSearch('acme'));
      expect(result.current.searchQuery).toBe('');

      act(() => vi.advanceTimersByTime(300));
      expect(result.current.searchQuery).toBe('acme');
    });

    it('collapses a burst of keystrokes into one settled value', () => {
      const { result } = setup();

      act(() => result.current.setSearch('a'));
      act(() => vi.advanceTimersByTime(100));
      act(() => result.current.setSearch('ac'));
      act(() => vi.advanceTimersByTime(100));
      act(() => result.current.setSearch('acme'));

      // Still nothing 100ms after the last keystroke — the timer restarted.
      act(() => vi.advanceTimersByTime(100));
      expect(result.current.searchQuery).toBe('');

      act(() => vi.advanceTimersByTime(200));
      expect(result.current.searchQuery).toBe('acme');
    });
  });
});
