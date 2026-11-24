import { Button, cn } from '@oppenheimer/design-system-web';
import { ArrowDown, ArrowUp, ChevronsUpDown } from '@oppenheimer/design-system-web/icons';
import type { VisualBlock } from '@oppenheimer/shared/schemas/visual';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatVisualNumber, keyed } from '../lib/visual-format';
import { nextVisualSort, sortVisualRows, type VisualSort } from '../lib/visual-table';
import { VisualBlockTitle } from './visual-block-title';

type Table = Extract<VisualBlock, { type: 'table' }>;

/** Rows past this fold under "Show all". */
const FOLD = 8;

/**
 * Rows and columns, sortable by a click on a header (numbers largest first,
 * words A to Z), numbers right-aligned in tabular figures, the first rows
 * shown and the rest a click away. It scrolls sideways inside the card, never
 * the page.
 */
export function VisualTable({ block }: { block: Table }) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<VisualSort>(null);
  const [open, setOpen] = useState(false);
  const numeric = block.columns.map((_, c) =>
    block.rows.every((row) => typeof row[c] === 'number' || row[c] === null),
  );
  const rows = sortVisualRows(block.rows, sort);
  const shown = open ? rows : rows.slice(0, FOLD);
  const columns = keyed(block.columns, (column) => column.label);
  const align = (c: number) => block.columns[c]?.align ?? (numeric[c] ? 'right' : 'left');
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {block.title ? <VisualBlockTitle>{block.title}</VisualBlockTitle> : null}
      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-hover-surface/50">
              {columns.map(({ item: column, key }, c) => {
                const active = sort?.column === c ? sort.direction : null;
                const Icon =
                  active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ChevronsUpDown;
                return (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={
                      active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : undefined
                    }
                    className={cn(
                      'p-0 font-medium text-fg-muted',
                      align(c) === 'right' && 'text-right',
                      align(c) === 'center' && 'text-center',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSort(nextVisualSort(sort, c, numeric[c] ?? false))}
                      title={t('common.visual.sortBy', { column: column.label })}
                      className={cn(
                        'group/sort inline-flex w-full items-center gap-1 px-3 py-2 text-xs whitespace-nowrap transition-colors duration-fast hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        align(c) === 'right' && 'flex-row-reverse',
                        align(c) === 'center' && 'justify-center',
                        active && 'text-fg',
                      )}
                    >
                      {column.label}
                      <Icon
                        aria-hidden
                        className={cn(
                          'size-3 shrink-0 transition-opacity duration-fast',
                          active ? 'opacity-100' : 'opacity-0 group-hover/sort:opacity-60',
                        )}
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, r) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity of their own, and sorting re-keys by content.
                key={`${row.join('\u0000')}-${r}`}
                className="border-t border-border-subtle transition-colors duration-fast hover:bg-hover-surface/50"
              >
                {columns.map(({ item: column, key }, c) => {
                  const cell = row[c] ?? null;
                  return (
                    <td
                      key={key}
                      className={cn(
                        'px-3 py-2 align-top text-fg',
                        align(c) === 'right' && 'text-right',
                        align(c) === 'center' && 'text-center',
                        typeof cell === 'number' && 'figures',
                        // Short cells keep to one line and the table scrolls; prose wraps at a readable width.
                        typeof cell === 'string' && cell.length > 32
                          ? 'min-w-48'
                          : 'whitespace-nowrap',
                        cell === null && 'text-fg-subtle',
                      )}
                    >
                      {cell === null || cell === ''
                        ? t('common.visual.empty')
                        : typeof cell === 'number'
                          ? formatVisualNumber(cell, column.format)
                          : cell}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > FOLD ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start text-fg-muted"
          onClick={() => setOpen(!open)}
        >
          {open ? t('common.visual.showFewer') : t('common.visual.showAll', { rows: rows.length })}
        </Button>
      ) : null}
    </div>
  );
}
