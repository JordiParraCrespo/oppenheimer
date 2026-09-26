import type * as React from 'react';

import { cn } from '../lib/utils';
import { StatusDot, type StatusState } from './status-dot';

/**
 * RoutineTable — the Routines overview: one row per routine in an 18px
 * card, four columns (the routine with its glyph and agent · model ·
 * project line, the trigger in words, the next run as clock time plus a
 * mono countdown, the status) and an ellipsis. Rows are 54px on a 10px
 * radius and take the hover wash; a paused routine dims its title. Headers
 * are 12.5px subtle text, not a table header.
 *
 * Composed from parts so a screen can render what it has: the head, the
 * rows, or the empty line.
 */
const GRID = 'grid grid-cols-[minmax(0,1.5fr)_minmax(0,1.3fr)_minmax(0,1fr)_96px_32px] items-center gap-3.5 px-3';

function RoutineTable({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="routine-table"
      role="table"
      className={cn('flex flex-col rounded-lg bg-card p-1.5', className)}
      {...props}
    />
  );
}

function RoutineTableHead({
  columns = ['Routine', 'Trigger', 'Next run', 'Status'],
  className,
  ...props
}: React.ComponentProps<'div'> & { columns?: [React.ReactNode, React.ReactNode, React.ReactNode, React.ReactNode] }) {
  return (
    <div
      role="row"
      data-slot="routine-table-head"
      className={cn(GRID, 'h-9 text-[12.5px] text-fg-subtle', className)}
      {...props}
    >
      {columns.map((column, i) => (
        <span key={`${i}-${String(column)}`} role="columnheader">
          {column}
        </span>
      ))}
      <span />
    </div>
  );
}

function RoutineTableRow({
  icon,
  name,
  sub,
  trigger,
  next,
  nextRelative,
  status,
  statusLabel,
  paused,
  action,
  menuOpen,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  icon: React.ReactNode;
  name: React.ReactNode;
  /** "Claude Code · Claude Sonnet 4.6 · XRP Mobile". */
  sub?: React.ReactNode;
  trigger: React.ReactNode;
  /** "Tomorrow, 02:00", "On next event", or "—". */
  next: React.ReactNode;
  /** Mono countdown under it ("in 14h 56m 54s"). */
  nextRelative?: React.ReactNode;
  status: StatusState;
  statusLabel: React.ReactNode;
  paused?: boolean;
  /** The ellipsis (a menu trigger). */
  action?: React.ReactNode;
  menuOpen?: boolean;
}) {
  return (
    <div
      role="row"
      data-slot="routine-table-row"
      data-paused={paused || undefined}
      data-menu-open={menuOpen || undefined}
      className={cn(
        GRID,
        'relative min-h-[54px] cursor-pointer rounded-sm transition-colors duration-fast hover:bg-hover-surface data-menu-open:z-30 data-menu-open:bg-hover-surface',
        className,
      )}
      {...props}
    >
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="flex size-[30px] shrink-0 items-center justify-center rounded-pill bg-hover-surface text-fg [&_svg:not([class*=size-])]:size-3.5"
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col gap-px">
          <span className={cn('truncate text-sm font-medium', paused ? 'text-fg-muted' : 'text-fg')}>{name}</span>
          {sub ? <span className="truncate text-[12.5px] text-fg-subtle">{sub}</span> : null}
        </span>
      </div>
      <span role="cell" className="truncate text-[13px] text-fg-muted">
        {trigger}
      </span>
      <span role="cell" className="flex flex-col gap-px text-[13px] whitespace-nowrap text-fg-muted">
        <span>{next}</span>
        {nextRelative ? <span className="figures text-[11.5px] text-fg-subtle">{nextRelative}</span> : null}
      </span>
      <span role="cell">
        <StatusDot state={status} className={cn('items-center text-[13px]', paused && 'text-fg-muted')}>
          {statusLabel}
        </StatusDot>
      </span>
      <span role="cell" className="flex justify-end [&_button]:size-7 [&_button]:text-fg-muted [&_button:hover]:text-fg">
        {action}
      </span>
    </div>
  );
}

function RoutineTableEmpty({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="routine-table-empty"
      className={cn('flex items-center gap-3.5 px-3.5 py-[18px] text-[13.5px] text-pretty text-fg-muted', className)}
      {...props}
    />
  );
}

export { RoutineTable, RoutineTableEmpty, RoutineTableHead, RoutineTableRow };
