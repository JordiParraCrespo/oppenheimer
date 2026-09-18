import {
  Checkbox,
  cn,
  EmptyState,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@oppenheimer/design-system-web';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DataTableColumn, DataTableSort } from '../lib/data-table-types';
import { DataTableRow } from './data-table-row';
import { SortHeader } from './sort-header';
import { TableSkeleton } from './table-skeleton';

/**
 * The rows, and only the rows.
 *
 * This is the expensive half of the table — one cell per column per row, a
 * dropdown per row, a checkbox per row — and it is a separate component so that
 * a keystroke in the search field stops at the field. That is the one update it
 * is genuinely insulated from, because the live value never leaves
 * `DataTableSearch`.
 *
 * Everything else that moves the shell still comes through here: a facet, a
 * page, a tick, `isFetching`. The selection in particular is state in
 * `DataTable`, so ticking a checkbox re-renders this body and every row in it —
 * with or without the React Compiler. `useTableSelection` says what changing
 * that would take.
 */
export function DataTableBody<TRow>({
  columns,
  rows,
  getKey,
  selected,
  selectable,
  allSelected,
  someSelected,
  toggleAll,
  toggleOne,
  sort,
  rowActions,
  onRowClick,
  isLoading,
  isFetching,
  emptyLabel,
  emptyIcon,
}: {
  columns: DataTableColumn<TRow>[];
  rows: TRow[];
  getKey: (row: TRow) => string;
  selected: ReadonlySet<string>;
  selectable: boolean;
  allSelected: boolean;
  someSelected: boolean;
  toggleAll: () => void;
  toggleOne: (key: string) => void;
  sort?: DataTableSort;
  rowActions?: (row: TRow) => ReactNode;
  onRowClick?: (row: TRow) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  emptyLabel: string;
  emptyIcon?: ReactNode;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    // Skeleton rows rather than the word "Loading": the table keeps its shape,
    // so the page does not jump when the rows land, and an empty result is
    // visibly different from one still on its way.
    return <TableSkeleton columns={columns.length} selectable={selectable} />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState className="py-12">
        <EmptyState.Header>
          {emptyIcon && <EmptyState.Media variant="icon">{emptyIcon}</EmptyState.Media>}
          <EmptyState.Title>{emptyLabel}</EmptyState.Title>
        </EmptyState.Header>
      </EmptyState>
    );
  }

  return (
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
        {rows.map((row) => (
          <DataTableRow
            key={getKey(row)}
            row={row}
            rowKey={getKey(row)}
            columns={columns}
            selected={selected.has(getKey(row))}
            selectable={selectable}
            toggleOne={toggleOne}
            rowActions={rowActions}
            onRowClick={onRowClick}
          />
        ))}
      </TableBody>
    </Table>
  );
}
