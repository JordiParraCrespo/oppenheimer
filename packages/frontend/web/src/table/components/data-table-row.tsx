import {
  Checkbox,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  IconButton,
  TableCell,
  TableRow,
} from '@oppenheimer/design-system-web';
import { Ellipsis } from '@oppenheimer/design-system-web/icons';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DataTableColumn } from '../lib/data-table-types';

/**
 * One row of the table.
 *
 * A separate component for reading, not for isolation: `toggleOne` writes state
 * that lives in `DataTable`, so a tick re-renders the shell, the body and every
 * row regardless of which file this is in. Nothing is memoised here and nothing
 * should claim to be — a split isolates an update only when the state that
 * update writes moves with it.
 */
export function DataTableRow<TRow>({
  row,
  rowKey,
  columns,
  selected,
  selectable,
  toggleOne,
  rowActions,
  onRowClick,
}: {
  row: TRow;
  rowKey: string;
  columns: DataTableColumn<TRow>[];
  selected: boolean;
  selectable: boolean;
  toggleOne: (key: string) => void;
  rowActions?: (row: TRow) => ReactNode;
  onRowClick?: (row: TRow) => void;
}) {
  const { t } = useTranslation();
  // Resolved per row, not per table: a revoked API token has nothing left to do
  // to it, and a trigger that opens an empty popup reads as a broken menu
  // rather than as "no actions".
  const menu = rowActions?.(row);

  return (
    <TableRow
      data-state={selected ? 'selected' : undefined}
      className={cn('border-border-subtle hover:bg-surface-hover', onRowClick && 'cursor-pointer')}
      onClick={onRowClick ? () => onRowClick(row) : undefined}
    >
      {selectable && (
        <TableCell className="pl-3">
          <Checkbox
            checked={selected}
            onCheckedChange={() => toggleOne(rowKey)}
            // Ticking a row must not also open it.
            onClick={(event) => event.stopPropagation()}
            aria-label={t('table.selectRow')}
          />
        </TableCell>
      )}
      {columns.map((column) => (
        <TableCell
          key={column.key}
          className={cn('py-3.5 text-base text-ink-900', column.align === 'right' && 'text-right')}
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
}
