import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';
import { useCallback, useMemo } from 'react';

/**
 * What the reader has narrowed a table to, held in the URL rather than in
 * `useState`.
 *
 * Every table in the app asked the same four questions — what is searched, what
 * is filtered, how is it sorted, which page — and every one of them answered in
 * component state, so the answers died on reload and could not be sent to
 * anybody. A filtered table is a thing people paste into a message ("the paused
 * domains I mean are here"); losing it to a refresh is the bug this fixes.
 *
 * Two rules are encoded here rather than left to each screen:
 *
 * - **Narrowing the list returns to page one**, in the same update. Page 4 of an
 *   unfiltered list is rarely a page of the filtered one, and an out-of-range
 *   page renders as "no results" — which reads as "your filter matched
 *   nothing". `leads` had this as a `useEffect` with a lint suppression on it;
 *   the other five did not have it at all.
 * - **Typing costs one history entry and one request**, not one of each per
 *   keystroke — and the debounce that makes that true is not here. What a
 *   reader is typing is the *field's* state until it settles, so
 *   `DataTableSearch` holds the half-typed word and calls `setSearch` once per
 *   burst. Keeping the live value here made every character a prop of the
 *   table, and so a re-render of every row, for a request that had not been
 *   made yet.
 *
 *   There is deliberately no second debounce on the way out. One did survive
 *   the move, on the URL write, and it was not free: the field syncs an
 *   incoming `search` back down, so a late write could land after the reader
 *   had typed on and snap the caret string back a burst. A caller that renders
 *   its own input uses `DataTableSearch`; the policy lives in one place.
 *
 * Updates replace the current history entry (nuqs' default). The URL here is
 * for reloading and sharing, not for stepping a filter back one control at a
 * time — a back button that unpicks a facet before leaving the page is a
 * surprise, not a feature.
 */

export type SortOrder = 'asc' | 'desc';

const ORDERS = ['asc', 'desc'] as const;

/** Stable identities, so the parsers do not change on every render. */
const NO_FILTERS: string[] = [];
const NO_SORT_KEYS: readonly string[] = [];

export interface TableSort<TSortKey extends string> {
  key: TSortKey;
  order: SortOrder;
}

export interface TableQueryOptions<TSortKey extends string, TFilter extends string> {
  /**
   * Distinguishes two tables that share one route. Without a prefix they would
   * both read and write the same `?q=` key.
   */
  prefix?: string;
  /**
   * The sort fields the endpoint accepts, and the one it falls back to. Omit
   * it for a table whose headers are inert; nothing then writes `?sort=`.
   */
  sort?: TableSort<TSortKey> & { keys: readonly TSortKey[] };
  /**
   * The values the facet may hold. Anything else in the URL is dropped before
   * this hook returns it.
   *
   * The URL is user input, and `?filter=bogus` is one hand-edit or one stale
   * link away. Domains, leads and the audit log put these straight into an API
   * query whose Zod schema only knows the real statuses, stages and events —
   * so without this a mistyped link answers with a failed request rather than
   * with an unfiltered table.
   *
   * Omit it when the values are not a fixed set the app knows up front. A
   * server-provided id that matches nothing can simply match nothing.
   */
  filters?: readonly TFilter[];
  /**
   * A **second** facet holding one value at a time, under the URL key named
   * here — `choice: 'domain'` reads and writes `?domain=acme.com`.
   *
   * Separate from `filters` rather than folded into it because the two speak
   * different vocabularies and share no list: `?filter=` carries the stages a
   * lead can be in, `?domain=` a hostname. One key holding both would make
   * "which of these is a stage" a guess.
   *
   * One value, not a list, because that is what the endpoint takes: `GET
   * /leads` accepts `siteDomain`, not `siteDomain[]`. The facet is rendered
   * `mode: 'single'` for the same reason.
   *
   * There is no allowed set for it. These values come from the server — a
   * hostname the workspace tracks — so an unknown one simply matches nothing,
   * which is the same answer `filters` gives a screen that declares no set.
   */
  choice?: string;
}

export interface TableQuery<TSortKey extends string, TFilter extends string = string> {
  /**
   * The settled search — what the URL holds, what seeds the field, and what a
   * request reads. One name: it used to have a debounced twin, and once the
   * debounce moved into the field the twin was the same string under a second
   * name that every call site had to remember was an alias.
   */
  search: string;
  setSearch: (value: string) => void;
  filters: TFilter[];
  setFilters: (values: string[]) => void;
  /**
   * The single-valued facet's current value, `null` when nothing is picked.
   * Blank counts as nothing: `?domain=` is what a hand-edited URL leaves
   * behind, and sending it as a filter asks the endpoint for leads whose
   * domain is the empty string.
   */
  choice: string | null;
  setChoice: (value: string | null) => void;
  sort: TableSort<TSortKey>;
  /**
   * Takes a plain `string` because that is what `DataTable` hands back — a
   * column's `sortKey` is untyped there, and narrowing this would make the
   * handler unassignable to it. The parser is the guard that matters: a key
   * outside `sort.keys` never reaches the query, it reads back as the default.
   */
  setSort: (key: string, order: SortOrder) => void;
  page: number;
  setPage: (page: number) => void;
  /**
   * Whether the reader narrowed this table themselves. An empty *filtered*
   * table says something different from an empty workspace, and only one of
   * the two is their doing.
   */
  isFiltered: boolean;
}

export function useTableQuery<TSortKey extends string = string, TFilter extends string = string>(
  options: TableQueryOptions<TSortKey, TFilter> = {},
): TableQuery<TSortKey, TFilter> {
  const { prefix, sort, filters: allowedFilters, choice: choiceKey } = options;

  const sortKeys = (sort?.keys ?? NO_SORT_KEYS) as readonly TSortKey[];
  // A table without a sort still carries the pair, so the shape this returns
  // does not change with the options — it simply never reaches the URL, and no
  // caller passes it to `DataTable`.
  const fallback: TableSort<TSortKey> = sort ?? ({ key: '', order: 'desc' } as TableSort<TSortKey>);

  const parsers = useMemo(
    () => ({
      search: parseAsString.withDefault(''),
      filters: parseAsArrayOf(parseAsString).withDefault(NO_FILTERS),
      sortKey: parseAsStringLiteral(sortKeys).withDefault(fallback.key),
      sortOrder: parseAsStringLiteral(ORDERS).withDefault(fallback.order),
      page: parseAsInteger.withDefault(1),
      // No default: absent and "nothing picked" are the same thing here, and
      // `null` says so without a sentinel.
      choice: parseAsString,
    }),
    // The sort configuration is a constant per screen; re-deriving the parsers
    // on every render would hand `useQueryStates` a new key map each time.
    [sortKeys, fallback.key, fallback.order],
  );

  const urlKeys = useMemo(
    () => ({
      search: withPrefix('q', prefix),
      filters: withPrefix('filter', prefix),
      sortKey: withPrefix('sort', prefix),
      sortOrder: withPrefix('order', prefix),
      page: withPrefix('page', prefix),
      // A screen that declared no key still registers the parser, so the shape
      // this returns does not change with the options. Nothing writes the key
      // until `setChoice` is called, so the URL of a screen without one stays
      // as it was.
      choice: withPrefix(choiceKey ?? 'choice', prefix),
    }),
    [prefix, choiceKey],
  );

  const [query, setQuery] = useQueryStates(parsers, { urlKeys });

  // Sanitised on the way out rather than in the parser, so a link carrying one
  // good value and one junk one still filters by the good one.
  const filters = useMemo(
    () =>
      allowedFilters
        ? query.filters.filter((value): value is TFilter =>
            allowedFilters.includes(value as TFilter),
          )
        : (query.filters as TFilter[]),
    [query.filters, allowedFilters],
  );

  const setSearch = useCallback(
    (value: string) => {
      setQuery({ search: value, page: 1 });
    },
    [setQuery],
  );

  const setFilters = useCallback(
    (values: string[]) => {
      setQuery({ filters: values, page: 1 });
    },
    [setQuery],
  );

  const setChoice = useCallback(
    (value: string | null) => {
      setQuery({ choice: value, page: 1 });
    },
    [setQuery],
  );

  const setSort = useCallback(
    (key: string, order: SortOrder) => {
      setQuery({ sortKey: key as TSortKey, sortOrder: order, page: 1 });
    },
    [setQuery],
  );

  const setPage = useCallback(
    (page: number) => {
      setQuery({ page });
    },
    [setQuery],
  );

  // Trimmed, and blank read as nothing picked: `?domain=` is what a
  // hand-edited URL leaves behind, and passing it on asks the endpoint for
  // leads whose domain is the empty string.
  const choice = query.choice?.trim() || null;

  return {
    search: query.search,
    setSearch,
    filters,
    setFilters,
    choice,
    setChoice,
    // `withDefault` makes both of these non-null, but nuqs cannot prove it for
    // a parser built from a generic list of literals.
    sort: { key: query.sortKey as TSortKey, order: query.sortOrder },
    setSort,
    // The URL is user input now, and `?page=0` or `?page=-3` is one hand-edit
    // away. A page below the first is not a page; the footer would otherwise
    // count backwards from it and offer "-7–0 of 12".
    page: Math.max(1, query.page),
    setPage,
    isFiltered: query.search.trim().length > 0 || filters.length > 0 || choice !== null,
  };
}

function withPrefix(name: string, prefix: string | undefined): string {
  return prefix ? `${prefix}_${name}` : name;
}
