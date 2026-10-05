'use client';

import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { ClockIcon } from 'lucide-react';
import type * as React from 'react';

import { META_GIVES_WAY, ROW_BUTTON_WITH_ACTION, SidebarRow } from '../internal/sidebar-row';
import { cn } from '../lib/utils';

/**
 * RoutineItem — the sidebar's row in routines mode: the trigger's glyph (a
 * clock for a schedule, the GitHub mark for an event), the name, and on
 * the right a mono `meta` — the run count, "in 45h" for the next run, or
 * "Paused". A running routine colours the glyph green; a paused one dims
 * its name. `lastRun` puts a 6px dot before the meta for how the last run
 * ended (red failed, green running, grey otherwise), named on hover.
 *
 * `action` is the row's ellipsis, as on a `SessionItem`: the trigger of a
 * `DropdownMenu` with Run now, Edit, Pause, Duplicate and Delete, shown on
 * hover, focus or while open (`menuOpen`), hiding the meta while it shows.
 *
 * `RoutineRun` rows list a routine's last runs under it: a state dot, the
 * run's title, and its age. The 2026-10-03 frames stop expanding them in the
 * sidebar (the dot and the menu took their place); they stay while the
 * console still draws them.
 */
function RoutineItem({
  name,
  meta,
  icon,
  running,
  paused,
  active,
  lastRun,
  lastRunLabel,
  action,
  menuOpen,
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
  /** How the last run ended, as a dot before the meta. */
  lastRun?: RoutineRunState;
  /** The dot's name ("Last run: failed"). */
  lastRunLabel?: string;
  /** The row's 20px ellipsis: a `DropdownMenu` trigger. */
  action?: React.ReactNode;
  /** Keeps the row lit and the action visible while its menu is open. */
  menuOpen?: boolean;
}) {
  const withAction = action !== undefined;
  const button = (
    <ButtonPrimitive
      data-slot="routine-item"
      data-active={active || undefined}
      data-paused={paused || undefined}
      role={withAction ? undefined : 'listitem'}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'group/routine flex h-[30px] w-full items-center gap-[9px] rounded-sm px-2.5 text-left text-fg outline-none transition-colors duration-fast ease-standard hover:bg-hover-surface focus-visible:outline-2 focus-visible:outline-ring data-active:bg-active-surface [&_svg]:size-3.5 [&_svg]:shrink-0',
        withAction && ROW_BUTTON_WITH_ACTION,
        className,
      )}
      {...props}
    >
      {/* The clock sits subtle; GitHub's mark is drawn in ink, a little
          softened, until a run turns the glyph green. */}
      <span
        aria-hidden
        className={cn(
          'flex shrink-0',
          running
            ? 'text-success'
            : 'text-fg-subtle [&_[data-brand=github]]:text-fg [&_[data-brand=github]]:opacity-80',
        )}
      >
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
      {meta || lastRun ? (
        <span
          className={cn(
            'figures flex shrink-0 items-center gap-1.5 text-[11px] text-fg',
            withAction && META_GIVES_WAY,
          )}
        >
          {lastRun ? (
            <span
              title={lastRunLabel}
              aria-label={lastRunLabel}
              role={lastRunLabel ? 'img' : undefined}
              className={cn('size-1.5 shrink-0 rounded-pill', RUN_DOT[lastRun])}
            />
          ) : null}
          {meta}
        </span>
      ) : null}
    </ButtonPrimitive>
  );

  if (!withAction) return button;
  return (
    <SidebarRow slot="routine-row" action={action} menuOpen={menuOpen}>
      {button}
    </SidebarRow>
  );
}

type RoutineRunState = 'completed' | 'failed' | 'running';

/** How a run ended, as a dot: the sidebar's last-run dot and every `RoutineRun`. */
const RUN_DOT: Record<RoutineRunState, string> = {
  completed: 'bg-fg-subtle',
  failed: 'bg-danger',
  running: 'bg-success motion-safe:animate-pulse-dot',
};

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
  state?: RoutineRunState;
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
        // A run with no session has nothing to open. Left to itself the row
        // looked exactly like one that does and answered a click with
        // nothing, so the disabled state has to be visible: it stops
        // reacting to the pointer and drops to the subtle weight.
        'disabled:cursor-default disabled:text-fg-subtle disabled:hover:bg-transparent disabled:hover:text-fg-subtle',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-pill',
          RUN_DOT[state],
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
export type { RoutineRunState };
