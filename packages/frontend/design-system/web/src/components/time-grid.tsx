import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * TimeGrid — the popover behind a time or weekday token: eyebrow-labelled
 * groups (Morning, Afternoon…) of 30px pill cells in a fixed column count.
 * Hours are mono; weekday cells switch to sans with `sans`. Past times are
 * disabled rather than hidden so the grid never reflows. The picked cell
 * takes the selected wash in the link blue.
 *
 * Render it inside a `ChipSelectPopup` of 292px with 12px padding.
 */
type TimeGridCell = { value: string; label: React.ReactNode; disabled?: boolean; sans?: boolean };
type TimeGridGroup = { label?: React.ReactNode; cells: TimeGridCell[] };

function TimeGrid({
  groups,
  value,
  onValueChange,
  columns = 4,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'onChange'> & {
  groups: TimeGridGroup[];
  value: string | null;
  onValueChange: (value: string) => void;
  columns?: 4 | 5 | 6 | 7;
}) {
  return (
    <div data-slot="time-grid" className={cn('flex flex-col gap-2', className)} {...props}>
      {groups.map((group, g) => (
        <div key={`${g}-${String(group.label ?? '')}`} className="flex flex-col gap-1">
          {group.label ? <div className={cn('eyebrow', g > 0 && 'mt-1.5')}>{group.label}</div> : null}
          <div
            role="listbox"
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {group.cells.map((cell) => {
              const on = cell.value === value;
              return (
                <button
                  key={cell.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  disabled={cell.disabled}
                  data-on={on || undefined}
                  onClick={() => onValueChange(cell.value)}
                  className={cn(
                    'h-[30px] rounded-pill text-fg outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2 disabled:pointer-events-none disabled:opacity-30',
                    cell.sans ? 'text-[13px]' : 'figures text-[12.5px]',
                    on && 'bg-selected-surface font-medium text-link',
                  )}
                >
                  {cell.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export { TimeGrid };
export type { TimeGridCell, TimeGridGroup };
