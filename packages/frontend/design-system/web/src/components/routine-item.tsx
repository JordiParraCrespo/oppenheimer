'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { ClockIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '../lib/utils';

/**
 * RoutineItem — the sidebar's row in routines mode: the trigger's glyph (a
 * clock for a schedule, the GitHub mark for an event), the name, and on
 * the right a mono `meta` — the run count, "in 45h" for the next run, or
 * "Paused". A running routine colours the glyph green; a paused one dims
 * its name. The selected routine expands its last runs under it as
 * `RoutineRun` rows: a state dot, the run's title, and its age.
 */
function RoutineItem({
  name,
  meta,
  icon,
  running,
  paused,
  active,
  className,
  ...props
}: Omit<ButtonPrimitive.Props, 'children'> & {
  name: React.ReactNode;
  meta?: React.ReactNode;
  /** Replaces the clock. */
  icon?: React.ReactNode;
  running?: boolean;
  paused?: boolean;
  active?: boolean;
}) {
  return (
    <ButtonPrimitive
      data-slot="routine-item"
      data-active={active || undefined}
      data-paused={paused || undefined}
      role="listitem"
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group/routine flex h-[30px] w-full items-center gap-[9px] rounded-sm px-2.5 text-left text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring data-active:bg-active-surface [&_svg]:size-3.5 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      <span aria-hidden className={cn('flex shrink-0', running ? 'text-success' : 'text-fg-subtle')}>
        {icon ?? <ClockIcon />}
      </span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-operate tracking-[-0.009em] group-data-active/routine:font-medium',
          paused && 'text-fg-subtle',
        )}
      >
        {name}
      </span>
      {meta ? <span className="figures shrink-0 text-[11px] text-fg-subtle">{meta}</span> : null}
    </ButtonPrimitive>
  );
}

function RoutineRunList({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="routine-run-list"
      role="list"
      className={cn('flex flex-col gap-px pt-0.5 pb-1.5 motion-safe:animate-label-in', className)}
      {...props}
    />
  );
}

function RoutineRun({
  title,
  ago,
  state = 'completed',
  active,
  className,
  ...props
}: Omit<ButtonPrimitive.Props, 'children' | 'title'> & {
  title: React.ReactNode;
  /** Mono ("17h", "2d"). */
  ago?: React.ReactNode;
  state?: 'completed' | 'failed' | 'running';
  active?: boolean;
}) {
  return (
    <ButtonPrimitive
      data-slot="routine-run"
      data-state={state}
      data-active={active || undefined}
      role="listitem"
      className={cn(
        'flex h-7 w-full items-center gap-2 rounded-sm pr-2.5 pl-8 text-left text-[12.5px] text-fg-muted outline-none transition-colors duration-fast hover:bg-hover-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-ring data-active:bg-selected-surface data-active:text-fg',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-pill',
          state === 'failed' ? 'bg-danger' : state === 'running' ? 'bg-success motion-safe:animate-pulse-dot' : 'bg-fg-subtle',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {ago ? <span className="figures shrink-0 text-[11px] text-fg-subtle">{ago}</span> : null}
    </ButtonPrimitive>
  );
}

function RoutineRunsEmpty({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="routine-runs-empty"
      className={cn('m-0 pt-1 pr-2.5 pb-1.5 pl-8 text-xs text-fg-subtle', className)}
      {...props}
    />
  );
}

export { RoutineItem, RoutineRun, RoutineRunList, RoutineRunsEmpty };
