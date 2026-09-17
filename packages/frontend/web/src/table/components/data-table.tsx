import {
  Badge,
  Button,
  Card,
  Checkbox,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchInput,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@oppenheimer/design-system-web';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  Filter,
} from '@oppenheimer/design-system-web/icons';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useClampedPage } from '../hooks/use-clamped-page';

/**
 * The workspace's table block: a card whose header carries search, filters and
 * the page's primary action, and swaps to a selection toolbar the moment a row
 * is ticked. Mirrors `DataTableBlock` in `design/crm/shell.js`.
 *
 * Everything the server decides — the page, the ordering, the filter — is a
 * controlled prop, because the rows handed in are one page of a larger set. The
 * one piece of state it owns is the selection, which is a property of the
 * viewport and not of the query.
 *
 * Every list in `apps/web` is built from this — team, roles and API tokens
 * included, which each had their own card-plus-`Table` before, at their own
 * header height and with their own idea of what an empty one looks like.
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

/** One frozen empty set, so an untouched selection has a stable identity. */
const NO_SELECTION: ReadonlySet<string> = new Set();

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

export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getKey: (row: TRow) => string;
  pagination: DataTablePagination;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  };
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

export function DataTable<TRow>({
  columns,
  rows,
  getKey,
  pagination,
  search,
  facets,
  actions,
  addAction,
  sort,
  rowActions,
  bulkActions,
  onRowClick,
  isLoading,
  isFetching,
  emptyLabel,
  emptyIcon,
  selectable = true,
}: DataTableProps<TRow>) {
  const { t } = useTranslation();

  /**
   * The selection belongs to the rows on screen, and only to them.
   *
   * These rows are one page of a server-side query, so a key ticked under a
   * different page, search or filter is no longer something the reader can see
   * — and a bulk action carrying it would change a lead they were never shown.
   * Two things keep that from happening: the selection is stored together with
   * the query it was made under and reads as empty under any other, and what
   * the bulk callbacks receive is intersected with the current page regardless.
   *
   * Storing the identity beside the keys is what makes "drop it when the query
   * moves" a derivation rather than an effect: there is no moment where the
   * old selection renders against the new rows. The reset below then commits
   * the drop, so coming back to the same page later does not resurrect ticks
   * the reader stopped seeing when they left.
   */
  const queryIdentity = JSON.stringify([
    pagination.page,
    search?.value ?? null,
    facets?.map((facet) => facet.value) ?? null,
    sort ? [sort.key, sort.order] : null,
  ]);

  const [selection, setSelection] = useState<{
    identity: string;
    keys: ReadonlySet<string>;
  }>(() => ({ identity: queryIdentity, keys: NO_SELECTION }));
  if (selection.identity !== queryIdentity) {
    setSelection({ identity: queryIdentity, keys: NO_SELECTION });
  }
  const selected = selection.identity === queryIdentity ? selection.keys : NO_SELECTION;

  /** Applies `update` to the selection made under the current query. */
  const updateSelection = (update: (current: ReadonlySet<string>) => ReadonlySet<string>) =>
    setSelection((current) => ({
      identity: queryIdentity,
      keys: update(current.identity === queryIdentity ? current.keys : NO_SELECTION),
    }));

  const pageKeys = rows.map(getKey);
  const allSelected = pageKeys.length > 0 && pageKeys.every((key) => selected.has(key));
  const someSelected = !allSelected && pageKeys.some((key) => selected.has(key));

  const clearSelection = () => updateSelection(() => NO_SELECTION);

  const selectedOnPage = pageKeys.filter((key) => selected.has(key));

  function toggleAll() {
    updateSelection((current) => {
      const next = new Set(current);
      for (const key of pageKeys) {
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  function toggleOne(key: string) {
    updateSelection((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const selectedCount = selectable ? selectedOnPage.length : 0;
  const { page, pageSize, total, totalPages, onPageChange } = pagination;
  const lastPage = Math.max(1, totalPages);
  useClampedPage({ page, lastPage, isLoading, onPageChange });

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div
        className={cn(
          'flex min-h-15 flex-wrap items-center gap-3 border-b border-border-subtle px-4 py-3 transition-colors',
          selectedCount > 0 && 'bg-surface-sunken',
        )}
      >
        {selectedCount > 0 ? (
          <>
            <div className="mr-auto flex items-center gap-2.5">
              <Checkbox
                checked
                indeterminate
                onClick={clearSelection}
                aria-label={t('table.clearSelection')}
              />
              <span className="text-base font-medium text-ink-900">
                {t('table.selected', { count: selectedCount })}
              </span>
            </div>
            {bulkActions?.(selectedOnPage, clearSelection)}
          </>
        ) : (
          <>
            {search && (
              <SearchInput
                containerClassName="w-70"
                size={TABLE_HEADER_CONTROL_SIZE}
                hint={null}
                placeholder={search.placeholder}
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
              />
            )}
            <div className="ml-auto flex items-center gap-2">
              {facets?.map((facet) => (
                <FacetFilter key={facet.label} facet={facet} />
              ))}
              {actions?.map((action) => (
                <Button
                  key={action.label}
                  variant="secondary"
                  size={TABLE_HEADER_CONTROL_SIZE}
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
              {addAction && (
                <Button
                  size={TABLE_HEADER_CONTROL_SIZE}
                  onClick={addAction.onClick}
                  disabled={addAction.disabled}
                >
                  {addAction.icon}
                  {addAction.label}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className="px-1">
        {isLoading ? (
          // Skeleton rows rather than the word "Loading": the table keeps its
          // shape, so the page does not jump when the rows land, and an empty
          // result is visibly different from one still on its way.
          <TableSkeleton columns={columns.length} selectable={selectable} />
        ) : rows.length === 0 ? (
          <EmptyState className="py-12">
            <EmptyState.Header>
              {emptyIcon && <EmptyState.Media variant="icon">{emptyIcon}</EmptyState.Media>}
              <EmptyState.Title>{emptyLabel}</EmptyState.Title>
            </EmptyState.Header>
          </EmptyState>
        ) : (
          <Table className={cn('w-max min-w-full transition-opacity', isFetching && 'opacity-60')}>
            <TableHeader>
              <TableRow className="border-border-subtle hover:bg-transparent">
                {selectable && (
                  <TableHead className="w-11 pl-3">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onCheckedChange={toggleAll}
                      aria-label={t('table.selectPage')}
                    />
                  </TableHead>
                )}
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    style={column.width ? { width: column.width } : undefined}
                    className={column.align === 'right' ? 'text-right' : undefined}
                  >
                    {column.sortKey && sort ? (
                      <SortHeader column={column} sort={sort} sortKey={column.sortKey} />
                    ) : (
                      column.label
                    )}
                  </TableHead>
                ))}
                <TableHead className="w-11" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const key = getKey(row);
                // Resolved per row, not per table: a revoked API token has
                // nothing left to do to it, and a trigger that opens an empty
                // popup reads as a broken menu rather than as "no actions".
                const menu = rowActions?.(row);

                return (
                  <TableRow
                    key={key}
                    data-state={selected.has(key) ? 'selected' : undefined}
                    className={cn(
                      'border-border-subtle hover:bg-surface-hover',
                      onRowClick && 'cursor-pointer',
                    )}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {selectable && (
                      <TableCell className="pl-3">
                        <Checkbox
                          checked={selected.has(key)}
                          onCheckedChange={() => toggleOne(key)}
                          // Ticking a row must not also open it.
                          onClick={(event) => event.stopPropagation()}
                          aria-label={t('table.selectRow')}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          'py-3.5 text-base text-ink-900',
                          column.align === 'right' && 'text-right',
                        )}
                        style={column.width ? { width: column.width } : undefined}
                      >
                        {column.render(row)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {menu && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<IconButton variant="ghost" size="sm" />}
                            aria-label={t('table.rowActions')}
                            // Opening the menu must not also open the row.
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Ellipsis />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">{menu}</DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center gap-3 px-4 py-3 whitespace-nowrap">
        <span className="mr-auto text-sm text-ink-400">
          {t('table.range', { first, last, total })}
        </span>
        <span className="text-sm text-ink-600">
          {t('table.page', { page, totalPages: Math.max(1, totalPages) })}
        </span>
        <IconButton
          size="default"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={t('table.previousPage')}
        >
          <ChevronLeft />
        </IconButton>
        <IconButton
          size="default"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={t('table.nextPage')}
        >
          <ChevronRight />
        </IconButton>
      </div>
    </Card>
  );
}

/**
 * One skeleton per column, at the row height the real table settles into.
 *
 * `role="status"` and the visually-hidden label are not decoration: a skeleton
 * is a stack of empty `div`s, so without them a screen reader hears nothing at
 * all and the `0–0` pagination below reads as a finished, empty result. The
 * bare paragraph this replaced at least said "Loading".
 */
function TableSkeleton({
  columns,
  rows = 5,
  selectable = true,
}: {
  columns: number;
  rows?: number;
  selectable?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={t('common.loading')}
      className="flex flex-col gap-3.5 px-3 py-4"
    >
      {Array.from({ length: rows }, (_, row) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
        <div key={row} className="flex items-center gap-4">
          {selectable && <Skeleton className="size-4 shrink-0 rounded" />}
          {Array.from({ length: columns }, (_, column) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder cells have no identity
            <Skeleton key={column} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function SortHeader<TRow>({
  column,
  sort,
  sortKey,
}: {
  column: DataTableColumn<TRow>;
  sort: DataTableSort;
  sortKey: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.order === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      className={cn(
        // The caret follows the label in every column, right-aligned ones
        // included — `DataTableBlock` in `design/crm/shell.js` does not flip it,
        // and reversing it reads as a different control per column.
        'inline-flex items-center gap-1 text-inherit select-none hover:text-ink-900',
        active && 'text-ink-900',
      )}
      // Clicking the active column flips it; a new column starts ascending,
      // which is what "sort by name" means before a direction is chosen.
      onClick={() => sort.onChange(sortKey, active && sort.order === 'asc' ? 'desc' : 'asc')}
    >
      {column.label}
      <Icon className={cn('size-3', active ? 'text-ink-900' : 'text-ink-400')} />
    </button>
  );
}

function FacetFilter({ facet }: { facet: DataTableFacet }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const single = facet.mode === 'single';

  function toggle(value: string) {
    if (single) {
      // Picking the selected option again clears the filter, which is what the
      // "clear" row does — so the control has no dead click.
      facet.onChange(facet.value.includes(value) ? [] : [value]);
      // One choice is the whole interaction, so the popover gets out of the
      // way rather than sitting over the rows it just filtered. A multi-select
      // stays open: you are usually picking more than one.
      setOpen(false);
      return;
    }
    facet.onChange(
      facet.value.includes(value)
        ? facet.value.filter((entry) => entry !== value)
        : [...facet.value, value],
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="secondary" size={TABLE_HEADER_CONTROL_SIZE} />}>
        <Filter />
        {facet.label}
        {facet.value.length > 0 && (
          <Badge variant="count" className="ml-0.5">
            {facet.value.length}
          </Badge>
        )}
        <ChevronDown />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1.5">
        {facet.options.map((option) => (
          <button
            key={option.value}
            type="button"
            // The dot and the checkbox are both `aria-hidden` decoration, so
            // the selected state has to live on the control itself — otherwise
            // a screen reader hears identical buttons before and after
            // choosing. `aria-pressed` rather than a menu role: these are plain
            // buttons in a popover, not a menu, and `aria-checked` is not valid
            // on one.
            aria-pressed={facet.value.includes(option.value)}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-base text-ink-900 hover:bg-surface-hover"
            onClick={() => toggle(option.value)}
          >
            {single ? (
              <span
                aria-hidden
                className={cn(
                  'size-1.5 flex-none rounded-full',
                  facet.value.includes(option.value) ? 'bg-ink-900' : 'bg-transparent',
                )}
              />
            ) : (
              <Checkbox
                checked={facet.value.includes(option.value)}
                // The row is the control; the box only mirrors it.
                tabIndex={-1}
                aria-hidden
                className="pointer-events-none"
              />
            )}
            {option.dotClassName && (
              <span className={cn('size-1.5 shrink-0 rounded-full', option.dotClassName)} />
            )}
            {option.label}
          </button>
        ))}
        {facet.value.length > 0 && (
          <button
            type="button"
            className="mt-1 w-full rounded-md border-t border-border-subtle px-2.5 pt-2.5 pb-2 text-left text-sm text-ink-600 hover:text-ink-900"
            onClick={() => facet.onChange([])}
          >
            {t('table.clearFilter')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
