import { ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, CircleCheckIcon, ZapIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';
import { IconButton } from './icon-button';

/**
 * RunsList — the Runs tab: a filter row (status pill tabs with counts,
 * then the facet tokens and a Clear link), a head, a 44px row per run and
 * a paged foot. A row is a state glyph, the run's title, the routine it
 * came from with the zap glyph, and the date plus a mono time. Step-level
 * glyphs (check circle, alert circle) are allowed here because each row is
 * a finished run, not a live state; a run still going shows the pulsing
 * dot instead.
 */
type RunState = 'completed' | 'failed' | 'running';

function RunsList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="runs-list"
      role="table"
      className={cn('flex flex-col rounded-lg bg-card p-1.5', className)}
      {...props}
    />
  );
}

/** The row of status tabs and facet tokens above the runs. */
function RunsListFilters({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="runs-list-filters"
      className={cn('mb-0.5 flex flex-wrap items-center gap-2 border-b border-border-subtle px-1.5 pt-1.5 pb-2', className)}
      {...props}
    />
  );
}

const GRID = 'grid grid-cols-[minmax(0,1fr)_minmax(0,220px)_124px] items-center gap-4 px-3';

function RunsListHead({
  columns = ['Run', 'Routine', 'Time'],
  className,
  ...props
}: React.ComponentProps<'div'> & { columns?: [React.ReactNode, React.ReactNode, React.ReactNode] }) {
  return (
    <div
      role="row"
      data-slot="runs-list-head"
      className={cn(GRID, 'h-9 text-[12.5px] text-fg-subtle', className)}
      {...props}
    >
      {columns.map((column, i) => (
        <span key={`${i}-${String(column)}`} role="columnheader">
          {column}
        </span>
      ))}
    </div>
  );
}

function RunRow({
  state,
  title,
  routine,
  date,
  time,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'title'> & {
  state: RunState;
  title: React.ReactNode;
  routine: React.ReactNode;
  date: React.ReactNode;
  /** Mono ("02:00"). */
  time: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="row"
      data-slot="run-row"
      data-state={state}
      className={cn(
        GRID,
        'h-11 w-full rounded-sm text-left text-sm text-fg outline-none transition-colors duration-fast hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2',
        className,
      )}
      {...props}
    >
      <span role="cell" className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={cn('flex w-4 shrink-0 items-center justify-center', state === 'failed' ? 'text-danger' : 'text-fg-subtle')}
        >
          {state === 'running' ? (
            <span className="size-[7px] rounded-pill bg-success motion-safe:animate-pulse-dot" />
          ) : state === 'failed' ? (
            <CircleAlertIcon className="size-4" />
          ) : (
            <CircleCheckIcon className="size-4" />
          )}
        </span>
        <span className="truncate">{title}</span>
      </span>
      <span role="cell" className="flex min-w-0 items-center gap-[7px] text-[13px] text-fg-muted">
        <ZapIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{routine}</span>
      </span>
      <span role="cell" className="flex gap-2 text-[13px] whitespace-nowrap text-fg-muted">
        <span>{date}</span>
        <span className="figures text-[12.5px]">{time}</span>
      </span>
    </button>
  );
}

function RunsListFoot({
  range,
  onPrevious,
  onNext,
  previousLabel = 'Previous page',
  nextLabel = 'Next page',
  className,
  ...props
}: React.ComponentProps<'div'> & {
  /** "1–10 of 65", mono. */
  range: React.ReactNode;
  onPrevious?: () => void;
  onNext?: () => void;
  previousLabel?: string;
  nextLabel?: string;
}) {
  return (
    <div
      data-slot="runs-list-foot"
      className={cn('flex h-10 items-center gap-1 pr-1.5 pl-3 text-[12.5px] text-fg-subtle', className)}
      {...props}
    >
      <span className="figures">{range}</span>
      <span className="flex-1" />
      <IconButton aria-label={previousLabel} size="sm" onClick={onPrevious} disabled={!onPrevious}>
        <ChevronLeftIcon />
      </IconButton>
      <IconButton aria-label={nextLabel} size="sm" onClick={onNext} disabled={!onNext}>
        <ChevronRightIcon />
      </IconButton>
    </div>
  );
}

function RunsListEmpty({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="runs-list-empty"
      className={cn('m-0 px-3 py-3.5 text-[13px] text-fg-muted', className)}
      {...props}
    />
  );
}

export { RunRow, RunsList, RunsListEmpty, RunsListFilters, RunsListFoot, RunsListHead };
export type { RunState };
