import type { ReactNode } from 'react';

/**
 * The shape of the workspace's table block, kept apart from the components that
 * render it.
 *
 * The table is four components — a header bar, a body, a footer, and the shell
 * that owns the selection — and each of them needs a slice of this. Left inside
 * `data-table.tsx` they would all have to import from the file they are
 * composed by.
 */

/**
 * One height for everything in the header, search field included.
 *
 * `SearchInput` has no `sm`-equivalent of the button pill, so a `sm` button
 * (h-7) beside the default field (h-9) left the bar visibly ragged — which is
 * how the three hand-rolled tables ended up each picking a different size. h-9
 * is also exactly what `min-h-15` minus the bar's `py-3` leaves, so the header
 * is 60px tall whatever it happens to hold. Controls a caller passes in —
 * `bulkActions`, the trigger of a menu — take the same size for the same
 * reason.
 */
export const TABLE_HEADER_CONTROL_SIZE = 'default';

/**
 * How long the search field holds a keystroke before it becomes a query.
 *
 * The field owns this, not the hook above it: what a reader types is the
 * field's state until it settles, so a burst of keystrokes costs one render of
 * one input rather than one render of every row. See `DataTableSearch`.
 */
export const TABLE_SEARCH_DEBOUNCE_MS = 300;

export interface DataTableColumn<TRow> {
  key: string;
  label: ReactNode;
  /** Fixed width in px. Columns without one share what is left. */
  width?: number;
  align?: 'left' | 'right';
  /** The API's sort field. Absent makes the header inert. */
  sortKey?: string;
  render: (row: TRow) => ReactNode;
}

export interface DataTableFacetOption {
  value: string;
  label: string;
  /** Tailwind background class for the leading dot, e.g. `bg-status-active`. */
  dotClassName?: string;
}

export interface DataTableFacet {
  label: string;
  options: DataTableFacetOption[];
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * `single` narrows to one option at a time and closes on pick. Use it when
   * the endpoint takes one value — `GET /audit-logs` accepts `event`, not
   * `event[]`, and offering checkboxes for a filter the server cannot honour
   * is a lie the UI tells.
   */
  mode?: 'multi' | 'single';
}

export interface DataTableAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface DataTableSort {
  key: string;
  order: 'asc' | 'desc';
  onChange: (key: string, order: 'asc' | 'desc') => void;
}

export interface DataTablePagination {
  /** 1-based, as the API counts. */
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export interface DataTableSearch {
  /**
   * The settled value — what the URL holds and what a query was last asked
   * with, **not** what is under the cursor. The field keeps the half-typed
   * word itself and hands it over once typing stops, so a keystroke never
   * reaches the rows.
   */
  value: string;
  /** Called with a settled value, once per burst of typing. */
  onChange: (value: string) => void;
  placeholder: string;
}

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getKey: (row: TRow) => string;
  pagination: DataTablePagination;
  search?: DataTableSearch;
  /**
   * The filter pills in the header, left to right. More than one when a list
   * is narrowed along more than one axis — leads by stage *and* by the domain
   * the enquiry came in through.
   */
  facets?: DataTableFacet[];
  actions?: DataTableAction[];
  addAction?: DataTableAction;
  sort?: DataTableSort;
  /**
   * Menu items for a row's overflow menu, rendered inside the popup. Return
   * `null` for a row with nothing to do to it and the trigger goes away with
   * the menu.
   */
  rowActions?: (row: TRow) => ReactNode;
  /**
   * Controls shown while rows are selected, next to the count. Size them
   * `TABLE_HEADER_CONTROL_SIZE` — they share the bar with the search field.
   */
  bulkActions?: (selected: string[], clearSelection: () => void) => ReactNode;
  /**
   * Whether rows can be ticked. Off for a read-only table — an audit entry is
   * a record of something that happened, and there is nothing to do to a
   * selection of them.
   */
  selectable?: boolean;
  onRowClick?: (row: TRow) => void;
  isLoading?: boolean;
  /** A background refetch: the table stays put and dims rather than emptying. */
  isFetching?: boolean;
  /** The empty state's title — usually differs for "no rows" vs "no matches". */
  emptyLabel: string;
  /** Optional icon for the empty state's medium disc. */
  emptyIcon?: ReactNode;
}
