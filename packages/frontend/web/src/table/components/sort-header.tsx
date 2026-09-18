import { cn } from '@oppenheimer/design-system-web';
import { ArrowDown, ArrowUp, ArrowUpDown } from '@oppenheimer/design-system-web/icons';
import type { DataTableColumn, DataTableSort } from '../lib/data-table-types';

/** A sortable column header: the label plus the caret that says which way. */
export function SortHeader<TRow>({
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
