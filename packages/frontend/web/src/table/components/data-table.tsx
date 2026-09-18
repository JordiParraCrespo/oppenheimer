import { Card } from '@oppenheimer/design-system-web';
import { useClampedPage } from '../hooks/use-clamped-page';
import { useTableSelection } from '../hooks/use-table-selection';
import type { DataTableProps } from '../lib/data-table-types';
import { DataTableBody } from './data-table-body';
import { DataTableFooter } from './data-table-footer';
import { DataTableHeader } from './data-table-header';

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
 *
 * It was one component of 624 lines holding three things on three different
 * clocks: the search field, the rows, and the selection. One of those is fixed
 * — the field owns what is being typed, so a keystroke reaches nothing here,
 * which is what `data-table-render.spec.tsx` pins. The selection is still shell
 * state and a tick still re-renders the rows; `useTableSelection` says why that
 * is and what changing it would cost.
 */
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
  /**
   * What the rows on screen are a page *of*.
   *
   * `search.value` is the settled search, not what is under the cursor, so this
   * string is rebuilt once per search rather than once per character. That
   * matters more than it looks: a changed identity commits through a
   * render-phase `setSelection`, so a four-letter word used to cost the whole
   * table four extra render passes on top of the four it already paid.
   */
  const queryIdentity = JSON.stringify([
    pagination.page,
    search?.value ?? null,
    facets?.map((facet) => facet.value) ?? null,
    sort ? [sort.key, sort.order] : null,
  ]);

  const selection = useTableSelection({ queryIdentity, pageKeys: rows.map(getKey) });

  useClampedPage({
    page: pagination.page,
    lastPage: Math.max(1, pagination.totalPages),
    isLoading,
    onPageChange: pagination.onPageChange,
  });

  return (
    <Card className="gap-0 overflow-hidden p-0">
      <DataTableHeader
        search={search}
        facets={facets}
        actions={actions}
        addAction={addAction}
        selectedCount={selectable ? selection.selectedOnPage.length : 0}
        selectedOnPage={selection.selectedOnPage}
        clearSelection={selection.clearSelection}
        bulkActions={bulkActions}
      />

      <div className="px-1">
        <DataTableBody
          columns={columns}
          rows={rows}
          getKey={getKey}
          selected={selection.selected}
          selectable={selectable}
          allSelected={selection.allSelected}
          someSelected={selection.someSelected}
          toggleAll={selection.toggleAll}
          toggleOne={selection.toggleOne}
          sort={sort}
          rowActions={rowActions}
          onRowClick={onRowClick}
          isLoading={isLoading}
          isFetching={isFetching}
          emptyLabel={emptyLabel}
          emptyIcon={emptyIcon}
        />
      </div>

      <DataTableFooter pagination={pagination} />
    </Card>
  );
}
